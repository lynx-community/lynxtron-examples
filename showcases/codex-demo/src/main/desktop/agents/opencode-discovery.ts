import { constants, accessSync } from 'fs';
import { delimiter, join } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';
import type { BackendInfo } from '../../../shared/agent';

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findOpenCode(): string | null {
  const configured = process.env.OPENCODE_BIN;
  const names = process.platform === 'win32' ? ['opencode.exe', 'opencode.cmd', 'opencode'] : ['opencode'];
  const candidates = [
    ...(configured ? [configured] : []),
    ...String(process.env.PATH ?? '').split(delimiter).flatMap((dir) => names.map((name) => join(dir, name))),
    join(homedir(), '.opencode', 'bin', names[0]),
    join('/opt/homebrew/bin', names[0]),
    join('/usr/local/bin', names[0]),
  ];

  for (const candidate of candidates) {
    if (candidate && isExecutable(candidate)) return candidate;
  }
  return null;
}

export function probeOpenCode(): BackendInfo {
  const command = findOpenCode();
  if (!command) {
    return {
      id: 'opencode',
      label: 'OpenCode',
      description: 'Open-source coding agent through ACP',
      transport: 'acp-stdio',
      status: 'missing',
      detail: 'Install OpenCode or set OPENCODE_BIN to its executable.',
    };
  }

  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5_000 });
  if (result.error || result.status !== 0) {
    return {
      id: 'opencode',
      label: 'OpenCode',
      description: 'Open-source coding agent through ACP',
      transport: 'acp-stdio',
      status: 'error',
      command,
      detail: result.error?.message ?? (result.stderr.trim() || `Exited with ${result.status}`),
    };
  }

  return {
    id: 'opencode',
    label: 'OpenCode',
    description: 'Open-source coding agent through ACP',
    transport: 'acp-stdio',
    status: 'ready',
    version: result.stdout.trim(),
    command,
  };
}
