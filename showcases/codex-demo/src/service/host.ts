import type { StartTaskInput } from '../shared/agent';
import {
  SERVICE_PROTOCOL_VERSION,
  type ServiceRequest,
  type ServiceResponse,
} from '../shared/service-protocol';
import { AgentRuntime } from '../main/desktop/agents/runtime';
import { TaskStore } from '../main/desktop/agents/task-store';

if (!process.send) throw new Error('Codex Service Host requires an IPC parent channel.');

const send = (message: unknown) => process.send?.(message);

const tasksFile = process.env.CODEX_DEMO_TASKS_FILE;
if (!tasksFile) throw new Error('CODEX_DEMO_TASKS_FILE is required.');

const runtime = new AgentRuntime(
  new TaskStore(tasksFile),
  (event) => send({
    protocolVersion: SERVICE_PROTOCOL_VERSION,
    kind: 'event',
    name: 'agent:event',
    payload: event,
  }),
  process.env.OPENCODE_CONFIG_DIR,
  process.env.CODEX_DEMO_COMPUTER_USE_BIN,
  process.env.OPENCODE_BIN && process.env.CODEX_DEMO_OPENCODE_VERSION ? {
    id: 'opencode',
    label: 'OpenCode',
    description: 'Open-source coding agent through ACP',
    transport: 'acp-stdio',
    status: 'ready',
    version: process.env.CODEX_DEMO_OPENCODE_VERSION,
    command: process.env.OPENCODE_BIN,
  } : undefined,
);

function stringValue(value: unknown): string {
  return String(value ?? '');
}

async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case 'agent:listBackends': return runtime.listBackends();
    case 'agent:listTasks': return runtime.listTasks();
    case 'agent:eventsSince': return runtime.eventsSince(Number(params.cursor ?? 0));
    case 'agent:timelinePage': return runtime.timelinePage(
      stringValue(params.taskId),
      params.before === undefined ? undefined : Number(params.before),
      Number(params.limit ?? 50),
    );
    case 'review:snapshot': return runtime.reviewSnapshot(stringValue(params.taskId), stringValue(params.traceId) || undefined);
    case 'review:fileDiff': return runtime.fileDiff(stringValue(params.taskId), stringValue(params.path), stringValue(params.traceId) || undefined);
    case 'workspace:snapshot': return runtime.workspaceSnapshot(stringValue(params.taskId));
    case 'workspace:file': return runtime.workspaceFile(stringValue(params.taskId), stringValue(params.path));
    case 'workspace:filePath': return runtime.workspaceFilePath(stringValue(params.taskId), stringValue(params.path));
    case 'agent:startTask': return runtime.startTask(params as unknown as StartTaskInput);
    case 'agent:loadTask': return runtime.loadTask(stringValue(params.taskId));
    case 'agent:prompt':
      runtime.startPrompt(stringValue(params.taskId), stringValue(params.text));
      return { accepted: true };
    case 'agent:cancel':
      runtime.cancel(stringValue(params.taskId));
      return { cancelled: true };
    case 'agent:permission':
      runtime.respondPermission(stringValue(params.requestId), params.optionId ? stringValue(params.optionId) : undefined);
      return { resolved: true };
    case 'agent:setConfigOption': return runtime.setConfigOption(
      stringValue(params.taskId),
      stringValue(params.configId),
      typeof params.value === 'boolean' ? params.value : stringValue(params.value),
    );
    case 'service:dispose':
      runtime.dispose();
      return { disposed: true };
    default: throw new Error(`Unknown service method: ${method}`);
  }
}

process.on('message', (message: unknown) => {
  if (!message || typeof message !== 'object') return;
  const request = message as Partial<ServiceRequest>;
  if (request.protocolVersion !== SERVICE_PROTOCOL_VERSION || request.kind !== 'request' || !request.requestId || !request.method) return;
  void dispatch(request.method, request.payload ?? {}).then(
    (value) => {
      const response: ServiceResponse = {
        protocolVersion: SERVICE_PROTOCOL_VERSION,
        kind: 'response',
        requestId: request.requestId!,
        ok: true,
        value,
      };
      send(response);
    },
    (error) => {
      const response: ServiceResponse = {
        protocolVersion: SERVICE_PROTOCOL_VERSION,
        kind: 'response',
        requestId: request.requestId!,
        ok: false,
        error: {
          code: 'SERVICE_REQUEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      };
      send(response);
    },
  );
});

send({
  protocolVersion: SERVICE_PROTOCOL_VERSION,
  kind: 'ready',
  pid: process.pid,
});

process.once('exit', () => runtime.dispose());
