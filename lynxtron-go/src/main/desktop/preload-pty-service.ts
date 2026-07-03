import { spawn, type ChildProcess } from 'child_process';
import os from 'os';
import type { DebugLogger } from './preload-log';

interface PtySession {
  proc: ChildProcess;
  outputBuffer: string;
  alive: boolean;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\x1B[PX^_][\s\S]*?\x1B\\|\x1B[^[\]()#;?PX^_]/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_RE, '');
}

function resolveShell(): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      shell: process.env.ComSpec || 'cmd.exe',
      args: [],
    };
  }

  return {
    shell: process.env.SHELL || '/bin/zsh',
    args: ['-l'],
  };
}

function formatCdCommand(dir: string): string {
  if (process.platform === 'win32') {
    return `cd /d ${JSON.stringify(dir)}\r\n`;
  }
  return `cd ${JSON.stringify(dir)}\n`;
}

export interface PtyService {
  bridge: {
    create: (id: string, cwd: string) => boolean;
    write: (id: string, data: string) => void;
    read: (id: string) => string;
    kill: (id: string) => void;
    isAlive: (id: string) => boolean;
    cd: (id: string, dir: string) => void;
  };
  dispose: () => void;
}

export function createPtyService(dbg: DebugLogger): PtyService {
  const sessions = new Map<string, PtySession>();

  const killSession = (id: string) => {
    const session = sessions.get(id);
    if (!session) return;
    try {
      session.proc.kill();
    } catch (_) {}
    sessions.delete(id);
    dbg(`pty[${id}] killed`);
  };

  return {
    bridge: {
      create: (id: string, cwd: string): boolean => {
        if (sessions.has(id)) return true;

        try {
          const { shell, args } = resolveShell();
          const proc = spawn(shell, args, {
            cwd: cwd || os.homedir(),
            env: { ...process.env, TERM: 'xterm-256color', COLUMNS: '120', LINES: '30' },
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          const session: PtySession = { proc, outputBuffer: '', alive: true };
          proc.on('error', error => {
            session.alive = false;
            session.outputBuffer += `\n[Process failed: ${error.message}]\n`;
            dbg(`pty[${id}] error: ${error.message}`);
          });
          proc.stdout?.on('data', (chunk: Buffer) => {
            session.outputBuffer += stripAnsi(chunk.toString('utf-8'));
          });
          proc.stderr?.on('data', (chunk: Buffer) => {
            session.outputBuffer += stripAnsi(chunk.toString('utf-8'));
          });
          proc.on('exit', code => {
            session.alive = false;
            session.outputBuffer += `\n[Process exited with code ${code}]\n`;
            dbg(`pty[${id}] exited code=${code}`);
          });
          sessions.set(id, session);
          dbg(`pty[${id}] created shell=${shell} cwd=${cwd} pid=${proc.pid}`);
          return true;
        } catch (error) {
          dbg(`pty.create error: ${error}`);
          return false;
        }
      },
      write: (id: string, data: string): void => {
        const session = sessions.get(id);
        if (session?.alive && session.proc.stdin) {
          session.proc.stdin.write(data, 'utf-8');
        }
      },
      read: (id: string): string => {
        const session = sessions.get(id);
        if (!session) return '';
        const output = session.outputBuffer;
        session.outputBuffer = '';
        return output;
      },
      kill: (id: string): void => {
        killSession(id);
      },
      isAlive: (id: string): boolean => sessions.get(id)?.alive ?? false,
      cd: (id: string, dir: string): void => {
        const session = sessions.get(id);
        if (session?.alive && session.proc.stdin) {
          session.proc.stdin.write(formatCdCommand(dir), 'utf-8');
        }
      },
    },
    dispose: () => {
      for (const id of sessions.keys()) {
        killSession(id);
      }
    },
  };
}
