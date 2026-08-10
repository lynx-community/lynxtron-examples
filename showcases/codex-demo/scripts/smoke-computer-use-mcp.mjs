import { spawn } from 'node:child_process';
import readline from 'node:readline';

const executable = process.env.CODEX_DEMO_COMPUTER_USE_BIN;
const targetApp = process.env.CODEX_DEMO_COMPUTER_USE_SMOKE_APP;
if (!executable) {
  throw new Error('Set CODEX_DEMO_COMPUTER_USE_BIN to the installed OpenComputerUse executable.');
}

const child = spawn(executable, ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let nextId = 1;
let stderr = '';

child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => { stderr += chunk; });

const lines = readline.createInterface({ input: child.stdout });
lines.on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  clearTimeout(waiter.timer);
  if (message.error) waiter.reject(new Error(message.error.message || JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params = {}, timeoutMs = 30_000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after ${timeoutMs}ms${stderr ? `: ${stderr.trim()}` : ''}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    send({ jsonrpc: '2.0', id, method, params });
  });
}

function assertToolSucceeded(name, result) {
  if (!result?.isError) return result;
  const detail = (result.content || [])
    .map((item) => item?.text)
    .filter(Boolean)
    .join('\n');
  throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
}

try {
  const initialized = await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'codex-demo-smoke', version: '1' },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  const listed = await request('tools/list');
  const names = new Set((listed.tools || []).map((tool) => tool.name));
  for (const required of ['list_apps', 'get_app_state']) {
    if (!names.has(required)) throw new Error(`MCP tool is missing: ${required}`);
  }

  assertToolSucceeded(
    'list_apps',
    await request('tools/call', { name: 'list_apps', arguments: {} }, 60_000),
  );
  if (targetApp) {
    assertToolSucceeded(
      'get_app_state',
      await request('tools/call', {
        name: 'get_app_state',
        arguments: { app: targetApp, disableDiff: true },
      }, 60_000),
    );
  }
  console.log(`Computer Use MCP smoke passed (${initialized.serverInfo?.version || 'unknown version'}).`);
} finally {
  for (const waiter of pending.values()) {
    clearTimeout(waiter.timer);
    waiter.reject(new Error('MCP smoke client stopped.'));
  }
  child.kill('SIGTERM');
}
