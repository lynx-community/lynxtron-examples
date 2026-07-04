import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DEBUG_LOG } from './preload-log';
import { readConfig, writeConfig } from './preload-config-store';

function isBinary(buf: Buffer): boolean {
  for (let index = 0; index < Math.min(buf.length, 512); index += 1) {
    if (buf[index] === 0) return true;
  }
  return false;
}

export function createFoundationBridge(dbg?: (msg: string) => void) {
  return {
    platform: process.platform,
    config: {
      get: (key: string) => readConfig()[key] ?? null,
      set: (key: string, value: any) => {
        const config = readConfig();
        config[key] = value;
        writeConfig(config);
      },
    },
    echo: (message: string) => `Echo from PC Service Thread: ${message}`,
    // Enough for the UI to respawn this exact app (new-window-as-new-process):
    // the lynxtron executable plus the app dir it was launched with.
    runtime: {
      execPath: process.execPath,
      appDir: __dirname,
      // Runtime version for the commands-bar version button — only what the
      // engine itself reports (no package-manifest probing: a manifest found
      // on disk isn't necessarily the binary that's running). This service
      // thread's process.versions lacks the lynxtron key, so main.ts hands
      // the value over via LYNXTRON_RUNTIME_VERSION.
      version: (() => {
        const versions = process.versions as Record<string, string | undefined>;
        return versions.lynxtron ?? versions.electron
          ?? process.env.LYNXTRON_RUNTIME_VERSION ?? null;
      })(),
    },
    clipboard: {
      // Lynx <text> has no selection on desktop — copy goes through the OS
      // clipboard tool instead (pbcopy/clip/xclip all read stdin).
      writeText: (text: string): boolean => {
        try {
          const cmd = process.platform === 'darwin' ? 'pbcopy'
            : process.platform === 'win32' ? 'clip' : 'xclip';
          const args = process.platform === 'darwin' || process.platform === 'win32'
            ? [] : ['-selection', 'clipboard'];
          const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
          child.on('error', (error) => dbg?.(`clipboard spawn failed: ${error}`));
          child.stdin.write(text);
          child.stdin.end();
          return true;
        } catch (error) {
          dbg?.(`clipboard write failed: ${error}`);
          return false;
        }
      },
    },
    fs: {
      readdir: (dir: string) => {
        try {
          return fs.readdirSync(dir);
        } catch (error) {
          console.error('[Preload] readdir error:', error);
          return [];
        }
      },
      readdirStat: (dir: string) => {
        try {
          return fs.readdirSync(dir).map(name => ({
            name,
            isDirectory: fs.statSync(path.join(dir, name)).isDirectory(),
          }));
        } catch (error) {
          console.error('[Preload] readdirStat error:', error);
          return [];
        }
      },
      readFile: (filePath: string): string | null => {
        try {
          // Return UTF-8 to avoid ArrayBuffer serialization through the BTS bridge.
          return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
          console.error('[Preload] readFile error:', error);
          // null, not '' — callers must be able to tell "missing/unreadable"
          // from "empty file" or a failed read silently wipes content.
          return null;
        }
      },
      writeFile: (filePath: string, content: string) => {
        try {
          fs.writeFileSync(filePath, content, 'utf-8');
          return true;
        } catch (error) {
          console.error('[Preload] writeFile error:', error);
          return false;
        }
      },
      mkdirp: (dir: string) => {
        try {
          fs.mkdirSync(dir, { recursive: true });
          return true;
        } catch (error) {
          console.error('[Preload] mkdirp error:', error);
          return false;
        }
      },
      tmpdir: () => os.tmpdir(),
      homedir: () => os.homedir(),
      exists: (p: string) => {
        try { return fs.existsSync(p); } catch (_) { return false; }
      },
      join: (...args: string[]) => path.join(...args),
      resolve: (...args: string[]) => path.resolve(...args),
      dirname: (targetPath: string) => path.dirname(targetPath),
      basename: (targetPath: string) => path.basename(targetPath),
      cwd: () => process.cwd(),
      chdir: (dir: string) => {
        try {
          process.chdir(dir);
          return true;
        } catch (error) {
          console.error('[Preload] chdir error:', error);
          return false;
        }
      },
    },
    utils: {
      utf8ByteLength: (value: string): number => Buffer.byteLength(value, 'utf-8'),
      log: (message: string) => {
        // 使用传入的 dbg 接口记录日志，这样会统一写入到 DEBUG_LOG 文件
        if (dbg) {
          dbg(`[App] ${message}`);
        } else {
          // 兜底方案，如果没有 dbg 则使用原来的实现
          const timestamp = new Date().toISOString();
          const logMessage = `[${timestamp}] ${message}\n`;
          console.log('[Preload utils.log]', message);
          try {
            fs.appendFileSync(DEBUG_LOG, logMessage);
          } catch (error) {
            console.error('[Preload] log error:', error);
          }
        }
      },
      // Dev-only verification surfaces (macOS `screencapture`). Gated the
      // same way as the /tmp command channels: never active in user builds.
      screenshotToFile: (outPath: string) => {
        if (process.env.LYNXTRON_FIDDLE_DEV !== '1') return false;
        try {
          execFileSync('/usr/sbin/screencapture', ['-x', '-t', 'png', outPath]);
          return true;
        } catch (error) {
          console.error('[Preload] screenshotToFile error:', error);
          return false;
        }
      },
      screenshotToBase64: () => {
        if (process.env.LYNXTRON_FIDDLE_DEV !== '1') return '';
        try {
          const tmpPath = path.join(os.tmpdir(), 'lynxtron_screenshot_tmp.png');
          execFileSync('/usr/sbin/screencapture', ['-x', '-t', 'png', tmpPath]);
          return fs.readFileSync(tmpPath).toString('base64');
        } catch (error) {
          console.error('[Preload] screenshotToBase64 error:', error);
          return '';
        }
      },
    },
    search: {
      findInFiles: (
        rootPath: string,
        query: string,
      ): Array<{ file: string; line: number; column: number; lineText: string; matchLength: number }> => {
        if (!query || !rootPath) return [];

        const skipDirs = new Set([
          '.git',
          'node_modules',
          'dist',
          'build',
          'output',
          '.DS_Store',
          'coverage',
          '.next',
          '.yarn',
        ]);
        const maxFileSize = 1024 * 1024;
        const maxResults = 200;
        const results: Array<{
          file: string;
          line: number;
          column: number;
          lineText: string;
          matchLength: number;
        }> = [];

        const searchDir = (dir: string) => {
          if (results.length >= maxResults) return;

          let entries: string[];
          try {
            entries = fs.readdirSync(dir);
          } catch {
            return;
          }

          for (const name of entries) {
            if (results.length >= maxResults) return;
            if (skipDirs.has(name)) continue;

            const fullPath = path.join(dir, name);
            let stat;
            try {
              stat = fs.statSync(fullPath);
            } catch {
              continue;
            }

            if (stat.isDirectory()) {
              searchDir(fullPath);
              continue;
            }

            if (!stat.isFile() || stat.size > maxFileSize) {
              continue;
            }

            try {
              const buffer = fs.readFileSync(fullPath);
              if (isBinary(buffer)) continue;

              const text = buffer.toString('utf-8');
              const lines = text.split('\n');
              const queryLower = query.toLowerCase();

              for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                if (results.length >= maxResults) return;
                const column = lines[lineIndex].toLowerCase().indexOf(queryLower);
                if (column !== -1) {
                  results.push({
                    file: fullPath,
                    line: lineIndex,
                    column,
                    lineText: lines[lineIndex].substring(0, 200),
                    matchLength: query.length,
                  });
                }
              }
            } catch {}
          }
        };

        searchDir(rootPath);
        return results;
      },
    },
    exec: {
      /**
       * Streams stdout/stderr line-by-line to onLine callbacks and resolves on exit.
       * Runs asynchronously and returns a handle with a `kill()` method.
       */
      runAsync: (
        cmd: string,
        args: string[],
        opts: {
          cwd?: string;
          env?: Record<string, string>;
          onLine?: (stream: 'stdout' | 'stderr', line: string) => void;
          onExit?: (code: number | null) => void;
        } = {},
      ) => {
        const child = spawn(cmd, args, {
          cwd: opts.cwd,
          env: { ...process.env, ...(opts.env ?? {}) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const emit = (stream: 'stdout' | 'stderr') => {
          let buf = '';
          return (chunk: Buffer) => {
            buf += chunk.toString('utf-8');
            let idx = buf.indexOf('\n');
            while (idx >= 0) {
              opts.onLine?.(stream, buf.slice(0, idx));
              buf = buf.slice(idx + 1);
              idx = buf.indexOf('\n');
            }
          };
        };
        child.stdout?.on('data', emit('stdout'));
        child.stderr?.on('data', emit('stderr'));
        child.on('close', (code) => opts.onExit?.(code));
        return {
          pid: child.pid,
          kill: () => { try { child.kill('SIGTERM'); } catch (_) {} },
        };
      },
    },
  };
}
