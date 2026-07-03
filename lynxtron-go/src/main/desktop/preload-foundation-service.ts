import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DEBUG_LOG } from './preload-log';
import { readConfig, writeConfig } from './preload-config-store';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\x1B[PX^_][\s\S]*?\x1B\\|\x1B[^[\]()#;?PX^_]/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_RE, '');
}

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
      readFile: (filePath: string) => {
        try {
          // Return UTF-8 to avoid ArrayBuffer serialization through the BTS bridge.
          return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
          console.error('[Preload] readFile error:', error);
          return '';
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
      screenshotToFile: (outPath: string) => {
        try {
          execFileSync('/usr/sbin/screencapture', ['-x', '-t', 'png', outPath]);
          return true;
        } catch (error) {
          console.error('[Preload] screenshotToFile error:', error);
          return false;
        }
      },
      screenshotToBase64: () => {
        try {
          const tmpPath = '/tmp/lynxtron_screenshot_tmp.png';
          execFileSync('/usr/sbin/screencapture', ['-x', '-t', 'png', tmpPath]);
          const buffer = fs.readFileSync(tmpPath);
          return stripAnsi(buffer.toString('base64'));
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
  };
}
