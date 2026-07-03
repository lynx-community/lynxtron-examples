import { fork, type ChildProcess } from 'child_process';
import path from 'path';
import type { DebugLogger } from './preload-log';

export interface ExtensionHostService {
  bridge: {
    updateFile: (uri: string, text: string, version: number, languageId: string) => void;
    getDiagnostics: (uri: string) => string | null;
    clearDiagnostics: (uri: string) => void;
  };
  start: () => void;
  dispose: () => void;
}

export function createExtensionHostService(dbg: DebugLogger): ExtensionHostService {
  let extHost: ChildProcess | null = null;
  const latestDiagnostics = new Map<string, string>();

  const ensureExtHost = () => {
    if (extHost && extHost.exitCode === null) return;

    const hostPath = path.join(__dirname, 'extension-host.js');
    dbg(`Forking ExtHost from: ${hostPath}`);
    extHost = fork(hostPath, [], {
      silent: true,
      env: { ...process.env, LYNXTRON_RUN_AS_NODE: '1' },
    });
    dbg(`ExtHost PID: ${extHost.pid}`);

    extHost.stdout?.on('data', (chunk: Buffer) => {
      dbg(`[ExtHost:out] ${chunk.toString().trimEnd()}`);
    });
    extHost.stderr?.on('data', (chunk: Buffer) => {
      dbg(`[ExtHost:err] ${chunk.toString().trimEnd()}`);
    });

    extHost.on('message', (message: any) => {
      if (message?.type === 'diagnostics' && message.uri) {
        dbg(`Received diagnostics for ${message.uri}: ${message.markers?.length} markers`);
        latestDiagnostics.set(message.uri, JSON.stringify(message));
      }
    });

    extHost.on('exit', (code: number | null, signal: string | null) => {
      dbg(`ExtHost exited code=${code} signal=${signal}`);
      extHost = null;
    });
  };

  return {
    bridge: {
      updateFile: (uri: string, text: string, version: number, languageId: string) => {
        try {
          dbg(`ls.updateFile called: uri=${uri} lang=${languageId} len=${text.length} extHost=${extHost?.pid ?? 'null'}`);
          ensureExtHost();
          extHost?.send({ type: 'textChanged', uri, text, version, languageId });
          dbg(`ls.updateFile sent to ExtHost PID=${extHost?.pid}`);
        } catch (error) {
          dbg(`ls.updateFile error: ${error}`);
        }
      },
      getDiagnostics: (uri: string): string | null => latestDiagnostics.get(uri) ?? null,
      clearDiagnostics: (uri: string) => {
        latestDiagnostics.delete(uri);
      },
    },
    start: ensureExtHost,
    dispose: () => {
      if (extHost && extHost.exitCode === null) {
        dbg('Process exiting, killing ExtHost');
        extHost.kill();
      }
      extHost = null;
    },
  };
}
