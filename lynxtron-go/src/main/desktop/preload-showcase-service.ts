import { execFileSync, fork, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildShowcaseInstallEnv,
  getShowcaseDependencyStatus as computeShowcaseDependencyStatus,
  getShowcaseTargets,
  hasShowcaseScript,
  hasShowcaseSourceChangesSinceBuild,
  hasShowcaseWebSourceChangesSinceBuild,
  isShowcaseWebBuilt,
} from './showcase-install';
import { readInstallState, writeInstallState } from './preload-config-store';
import type { DebugLogger } from './preload-log';
import { getRuntimeRequire, resolveLynxtronExecutablePath } from './preload-lynxtron-runtime';

type RunningShowcaseRecord = Map<number, ChildProcess>;
type ShowcaseProcessOutputLevel = 'info' | 'warn' | 'error';
export interface ShowcaseProcessOutputEntry {
  level: ShowcaseProcessOutputLevel;
  source: string;
  message: string;
}

const INSTALL_TIMEOUT_MS = 300000;
const PROCESS_OUTPUT_TAIL_LIMIT = 4000;
const PROCESS_OUTPUT_BUFFER_LIMIT = 1000;

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\x1B[PX^_][\s\S]*?\x1B\\|\x1B[^[\]()#;?PX^_]/g;

function resolveCliPath(): string {
  return getRuntimeRequire().resolve('@lynxtron-showcases/cli/dist/index.js');
}

function openExternalUrl(url: string, dbg: DebugLogger) {
  try {
    let command: string;
    let args: string[];
    if (process.platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (process.platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', url];
    } else {
      command = 'xdg-open';
      args = [url];
    }
    const opener = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env },
    });
    opener.unref();
    dbg(`showcase.openExternalUrl: ${url}`);
  } catch (error: any) {
    dbg(`showcase.openExternalUrl error: ${error?.message || String(error)}`);
  }
}

function attachUrlOpener(child: ChildProcess, label: string, dbg: DebugLogger) {
  let opened = false;
  const maybeOpen = (chunk: Buffer | string) => {
    if (opened) return;
    const text = chunk.toString();
    const match = text.match(/https?:\/\/[^\s"']+/i);
    if (!match) return;
    opened = true;
    const url = match[0].replace(/[),.;]+$/, '');
    dbg(`${label}: detected url=${url}`);
    openExternalUrl(url, dbg);
  };
  child.stdout?.on('data', maybeOpen);
  child.stderr?.on('data', maybeOpen);
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_RE, '');
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

function emitOutputLine(
  buffer: ShowcaseProcessOutputEntry[],
  source: string,
  level: ShowcaseProcessOutputLevel,
  message: string,
) {
  const trimmed = message.trimEnd();
  if (!trimmed) return;
  buffer.push({ level, source, message: trimmed });
  if (buffer.length > PROCESS_OUTPUT_BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - PROCESS_OUTPUT_BUFFER_LIMIT);
  }
}

function attachProcessOutput(
  child: ChildProcess,
  source: string,
  outputBuffer: ShowcaseProcessOutputEntry[],
) {
  let stdoutRemainder = '';
  let stderrRemainder = '';

  const emitChunk = (
    level: ShowcaseProcessOutputLevel,
    chunk: Buffer | string,
    readRemainder: () => string,
    writeRemainder: (value: string) => void,
  ) => {
    const text = `${readRemainder()}${stripAnsi(chunk.toString()).replace(/\r/g, '\n')}`;
    const lines = text.split(/\n/);
    writeRemainder(lines.pop() ?? '');
    for (const line of lines) {
      emitOutputLine(outputBuffer, source, level, line);
    }
  };

  const flushRemainders = () => {
    emitOutputLine(outputBuffer, source, 'info', stdoutRemainder);
    emitOutputLine(outputBuffer, source, 'error', stderrRemainder);
    stdoutRemainder = '';
    stderrRemainder = '';
  };

  child.stdout?.on('data', (chunk: Buffer) => {
    emitChunk('info', chunk, () => stdoutRemainder, (value) => { stdoutRemainder = value; });
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    emitChunk('error', chunk, () => stderrRemainder, (value) => { stderrRemainder = value; });
  });
  child.on('error', (error) => {
    emitOutputLine(outputBuffer, source, 'error', error.message);
  });
  child.on('close', (code, signal) => {
    flushRemainders();
    if (code === 0) {
      emitOutputLine(outputBuffer, source, 'info', `process exited with code ${code}`);
    } else if (signal) {
      emitOutputLine(outputBuffer, source, 'warn', `process exited by signal ${signal}`);
    } else {
      emitOutputLine(outputBuffer, source, 'error', `process exited with code ${code ?? 'unknown'}`);
    }
  });
}

function emitCommandStart(
  outputBuffer: ShowcaseProcessOutputEntry[],
  source: string,
  cwd: string,
  command: string,
  args: string[],
) {
  emitOutputLine(outputBuffer, source, 'info', `$ ${formatCommand(command, args)}`);
  emitOutputLine(outputBuffer, source, 'info', `cwd: ${cwd}`);
}

function trackRunningShowcase(
  label: string,
  child: ChildProcess,
  detail: string,
  runningShowcases: RunningShowcaseRecord,
  dbg: DebugLogger,
) {
  const pid = child.pid ?? 0;
  dbg(`${label}: launched pid=${pid} ${detail}`);
  child.on('error', (error) => {
    dbg(`${label}: pid=${pid} error=${error.message}`);
    runningShowcases.delete(pid);
  });
  child.on('close', (code, signal) => {
    dbg(`${label}: pid=${pid} exited code=${code} signal=${signal}`);
    runningShowcases.delete(pid);
  });
  runningShowcases.set(pid, child);
  child.unref();
  return pid;
}

function ensureShowcaseSupportsWeb(showcasePath: string) {
  if (!getShowcaseTargets(showcasePath).includes('web')) {
    throw new Error('Showcase does not declare a web target.');
  }
}

function resolveShowcaseWebServerPath(): string {
  return path.join(__dirname, 'showcase-web-server.js');
}

function getShowcaseDependencyStatus(showcasePath: string, dbg: DebugLogger) {
  const status = computeShowcaseDependencyStatus(showcasePath, readInstallState());
  if (status.reason === 'bootstrapped') {
    const installState = readInstallState();
    installState[status.resolvedShowcasePath] = status.fingerprint;
    writeInstallState(installState, dbg);
    dbg(`showcase.install: bootstrapped fingerprint for ${status.resolvedShowcasePath}`);
  }
  return status;
}

async function ensureShowcaseDependencies(
  showcasePath: string,
  dbg: DebugLogger,
  force = false,
  outputBuffer?: ShowcaseProcessOutputEntry[],
) {
  const status = getShowcaseDependencyStatus(showcasePath, dbg);
  if (!force && !status.needsInstall) {
    return false;
  }

  const commandText = `${status.installPlan.command} ${status.installPlan.args.join(' ')}`;
  dbg(
    `showcase.install: cwd=${status.installPlan.cwd} reason=${force ? 'forced' : status.reason} command=${commandText}`
    + (status.installPlan.userConfigPath ? ` userconfig=${status.installPlan.userConfigPath}` : '')
  );
  try {
    if (outputBuffer) {
      emitCommandStart(outputBuffer, 'showcase.install', status.installPlan.cwd, status.installPlan.command, status.installPlan.args);
    }
    await runInstallCommand({
      command: status.installPlan.command,
      args: status.installPlan.args,
      cwd: status.installPlan.cwd,
      env: buildShowcaseInstallEnv(status.installPlan.userConfigPath),
      outputBuffer,
    });
  } catch (error: any) {
    const stdout = formatProcessOutput(error?.stdout);
    const stderr = formatProcessOutput(error?.stderr);
    const detail = [
      stderr ? `stderr:\n${stderr}` : '',
      stdout ? `stdout:\n${stdout}` : '',
    ].filter(Boolean).join('\n\n');
    dbg(`showcase.install failed: command=${commandText}${detail ? ` ${detail.replace(/\n/g, ' | ')}` : ''}`);
    throw new Error(
      detail
        ? `Command failed: ${commandText}\n${detail}`
        : error?.message || `Command failed: ${commandText}`,
    );
  }
  const installState = readInstallState();
  installState[status.resolvedShowcasePath] = status.fingerprint;
  writeInstallState(installState, dbg);
  if (outputBuffer) {
    emitOutputLine(outputBuffer, 'showcase.install', 'info', 'dependencies installed');
  }
  return true;
}


// Only the app itself (lynxtron-go) gets the self-host flag: it badges the
// child window and waives the singleton lock. Leaking it into every showcase
// spawn would silently disable single-instance for unrelated apps.
function isSelfHostTarget(showcasePath: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(showcasePath, 'package.json'), 'utf-8'));
    return pkg?.name === 'lynxtron-go';
  } catch (_) {
    return false;
  }
}

function showcaseSpawnEnv(showcasePath: string): NodeJS.ProcessEnv {
  return isSelfHostTarget(showcasePath)
    ? { ...process.env, LYNXTRON_FIDDLE_SELF_HOST: '1' }
    : { ...process.env };
}

function runInstallCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  outputBuffer?: ShowcaseProcessOutputEntry[];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    if (options.outputBuffer) {
      attachProcessOutput(child, 'showcase.install', options.outputBuffer);
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error?: Error & { stdout?: string; stderr?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve();
      }
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {}
      finish(Object.assign(new Error(`Command timed out after ${INSTALL_TIMEOUT_MS}ms: ${options.command} ${options.args.join(' ')}`), {
        stdout,
        stderr,
      }));
    }, INSTALL_TIMEOUT_MS);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout = appendProcessOutputTail(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = appendProcessOutputTail(stderr, chunk);
    });
    child.on('error', (error: Error) => {
      finish(Object.assign(error, { stdout, stderr }));
    });
    child.on('close', (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
      finish(Object.assign(new Error(`Command failed with ${suffix}: ${options.command} ${options.args.join(' ')}`), {
        stdout,
        stderr,
      }));
    });
  });
}

function runBufferedCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  source: string;
  outputBuffer?: ShowcaseProcessOutputEntry[];
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    if (options.outputBuffer) {
      attachProcessOutput(child, options.source, options.outputBuffer);
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error?: Error & { stdout?: string; stderr?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    };
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {}
      finish(Object.assign(new Error(`Command timed out after ${options.timeoutMs}ms: ${formatCommand(options.command, options.args)}`), {
        stdout,
        stderr,
      }));
    }, options.timeoutMs);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error: Error) => {
      finish(Object.assign(error, { stdout, stderr }));
    });
    child.on('close', (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`;
      finish(Object.assign(new Error(`Command failed with ${suffix}: ${formatCommand(options.command, options.args)}`), {
        stdout,
        stderr,
      }));
    });
  });
}

function appendProcessOutputTail(current: string, chunk: Buffer | string): string {
  const next = current + chunk.toString();
  return next.length > PROCESS_OUTPUT_TAIL_LIMIT ? next.slice(-PROCESS_OUTPUT_TAIL_LIMIT) : next;
}

function formatProcessOutput(output: unknown): string {
  if (!output) return '';
  const text = Buffer.isBuffer(output) ? output.toString('utf-8') : String(output);
  const trimmed = text.trim();
  if (!trimmed) return '';
  const lines = trimmed.split(/\r?\n/);
  const tail = lines.slice(-40).join('\n');
  return tail.length > PROCESS_OUTPUT_TAIL_LIMIT ? tail.slice(-PROCESS_OUTPUT_TAIL_LIMIT) : tail;
}

export interface ShowcaseService {
  bridge: {
    fetch: (url: string) => Promise<string>;
    resolveRegistryPath: (relativePath: string) => string | null;
    readProcessOutput: () => ShowcaseProcessOutputEntry[];
    run: (showcasePath: string) => number;
    start: (showcasePath: string) => Promise<number>;
    dev: (showcasePath: string) => Promise<number>;
    list: () => Array<{ name: string; description: string; local: boolean }>;
    isShowcase: (dirPath: string) => boolean;
    isBuilt: (dirPath: string) => boolean;
    getTargets: (showcasePath: string) => Array<'desktop' | 'web'>;
    isWebBuilt: (showcasePath: string) => boolean;
    needsSourceRun: (showcasePath: string) => boolean;
    needsWebSourceRun: (showcasePath: string) => boolean;
    needsInstall: (showcasePath: string) => boolean;
    installDependencies: (showcasePath: string) => Promise<boolean>;
    runWeb: (showcasePath: string) => number;
    startWeb: (showcasePath: string) => Promise<number>;
    devWeb: (showcasePath: string) => Promise<number>;
  };
  dispose: () => void;
}

export function createShowcaseService(dbg: DebugLogger): ShowcaseService {
  const runningShowcases: RunningShowcaseRecord = new Map();
  const processOutputBuffer: ShowcaseProcessOutputEntry[] = [];

  return {
    bridge: {
      fetch: async (url: string): Promise<string> => {
        try {
          dbg(`showcase.fetch enter url=${url}`);
          const cliPath = resolveCliPath();
          const appRoot = path.resolve(__dirname, '..', '..');
          const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);
          const workspacePath = path.join(os.homedir(), '.lynxtron-go');
          dbg(`showcase.fetch: cliPath=${cliPath} url=${url} ws=${workspacePath}`);
          let result: string;
          try {
            const args = [cliPath, 'fetch', url];
            emitCommandStart(processOutputBuffer, 'showcase.fetch', appRoot, lynxtronExecutable, args);
            const output = await runBufferedCommand({
              command: lynxtronExecutable,
              args,
              cwd: appRoot,
              env: { ...process.env, LYNXTRON_WORKSPACE: workspacePath, LYNXTRON_RUN_AS_NODE: '1' },
              timeoutMs: 300000,
              source: 'showcase.fetch',
              outputBuffer: processOutputBuffer,
            });
            result = output.stdout;
          } catch (error: any) {
            dbg(`showcase.fetch CLI stderr: ${error.stderr?.toString() || 'none'}`);
            dbg(`showcase.fetch CLI stdout: ${error.stdout?.toString() || 'none'}`);
            dbg(`showcase.fetch CLI error: ${error?.message || String(error)}`);
            throw error;
          }
          dbg(`showcase.fetch raw result: ${result.trim() || '(empty)'}`);
          const events = result.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
          const success = events.find((event: any) => event.type === 'fetch-success');
          if (success) return success.path;
          const failed = events.find((event: any) => event.type === 'fetch-error');
          throw new Error(failed?.error || 'Fetch failed');
        } catch (error: any) {
          dbg(`showcase.fetch error: ${error?.message || String(error)}`);
          if (error?.stack) {
            dbg(`showcase.fetch stack: ${String(error.stack).replace(/\n/g, ' | ')}`);
          }
          throw error;
        }
      },

      resolveRegistryPath: (relativePath: string): string | null => {
        if (!relativePath) return null;
        try {
          const appRoot = path.resolve(__dirname, '..', '..');
          const monorepoRoot = path.resolve(appRoot, '..');
          const candidate = path.resolve(monorepoRoot, relativePath);
          if (!fs.existsSync(candidate)) return null;
          return candidate;
        } catch (error: any) {
          dbg(`showcase.resolveRegistryPath error: ${error?.message || String(error)}`);
          return null;
        }
      },

      readProcessOutput: (): ShowcaseProcessOutputEntry[] => processOutputBuffer.splice(0, processOutputBuffer.length),

      isRunning: (pid: number): boolean => runningShowcases.has(pid),

      stop: (pid: number): boolean => {
        const child = runningShowcases.get(pid);
        if (!child) return false;
        // Children spawn detached (own process group), so kill the group:
        // signalling only the direct child orphans `sh -c "build && launch"`
        // chains — the launched app survived Stop with its window open.
        if (process.platform === 'win32') {
          try {
            spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
            return true;
          } catch (_) { /* fall through */ }
        }
        let ok = false;
        try { process.kill(-pid, 'SIGTERM'); ok = true; } catch (_) {}
        try { child.kill('SIGTERM'); ok = true; } catch (_) {}
        return ok;
      },

      run: (showcasePath: string): number => {
        dbg(`showcase.run called with showcasePath: ${showcasePath}`);
        try {
          const distDesktop = path.join(showcasePath, 'dist', 'desktop');
          dbg(`showcase.run: distDesktop=${distDesktop}`);
          const mainJsPath = path.join(distDesktop, 'main.js');
          dbg(`showcase.run: checking main.js at ${mainJsPath} exists: ${fs.existsSync(mainJsPath)}`);
          if (!fs.existsSync(mainJsPath)) {
            throw new Error('Showcase not built. dist/desktop/main.js not found.');
          }
          dbg(`showcase.run: calling resolveLynxtronExecutablePath...`);
          const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);
          dbg(`showcase.run: lynxtronExecutable=${lynxtronExecutable}`);
          dbg(`showcase.run: checking if executable exists: ${fs.existsSync(lynxtronExecutable)}`);
          emitCommandStart(processOutputBuffer, 'showcase.run', showcasePath, lynxtronExecutable, [distDesktop]);
          dbg(`showcase.run: spawning process...`);
          const child = spawn(lynxtronExecutable, [distDesktop], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: showcaseSpawnEnv(showcasePath),
          });
          dbg(`showcase.run: process spawned, pid: ${child.pid}`);
          attachProcessOutput(child, 'showcase.run', processOutputBuffer);
          const pid = trackRunningShowcase('showcase.run', child, `path=${distDesktop}`, runningShowcases, dbg);
          dbg(`showcase.run: returning pid: ${pid}`);
          return pid;
        } catch (error: any) {
          dbg(`showcase.run error: ${error.message}`);
          dbg(`showcase.run stack: ${error.stack}`);
          throw error;
        }
      },

      start: async (showcasePath: string): Promise<number> => {
        try {
          await ensureShowcaseDependencies(showcasePath, dbg, false, processOutputBuffer);
          const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          dbg(`showcase.start: cwd=${showcasePath} command=${npmCommand} start`);
          emitCommandStart(processOutputBuffer, 'showcase.start', showcasePath, npmCommand, ['start']);
          const child = spawn(npmCommand, ['start'], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: showcaseSpawnEnv(showcasePath),
          });
          attachProcessOutput(child, 'showcase.start', processOutputBuffer);
          return trackRunningShowcase('showcase.start', child, `cwd=${showcasePath}`, runningShowcases, dbg);
        } catch (error: any) {
          dbg(`showcase.start error: ${error.message}`);
          throw error;
        }
      },

      dev: async (showcasePath: string): Promise<number> => {
        try {
          await ensureShowcaseDependencies(showcasePath, dbg, false, processOutputBuffer);
          const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          dbg(`showcase.dev: cwd=${showcasePath} command=${npmCommand} run dev`);
          emitCommandStart(processOutputBuffer, 'showcase.dev', showcasePath, npmCommand, ['run', 'dev']);
          const child = spawn(npmCommand, ['run', 'dev'], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: showcaseSpawnEnv(showcasePath),
          });
          attachProcessOutput(child, 'showcase.dev', processOutputBuffer);
          return trackRunningShowcase('showcase.dev', child, `cwd=${showcasePath}`, runningShowcases, dbg);
        } catch (error: any) {
          dbg(`showcase.dev error: ${error.message}`);
          throw error;
        }
      },

      list: (): Array<{ name: string; description: string; local: boolean }> => {
        try {
          const cliPath = resolveCliPath();
          const appRoot = path.resolve(__dirname, '..', '..');
          const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);
          const workspacePath = path.join(os.homedir(), '.lynxtron-go');
          const result = execFileSync(lynxtronExecutable, [cliPath, 'list'], {
            env: { ...process.env, LYNXTRON_WORKSPACE: workspacePath, LYNXTRON_RUN_AS_NODE: '1' },
            encoding: 'utf-8',
            timeout: 10000,
          });
          const events = result.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
          const listEvent = events.find((event: any) => event.type === 'list');
          return listEvent?.showcases ?? [];
        } catch (error: any) {
          dbg(`showcase.list error: ${error.message}`);
          return [];
        }
      },

      isShowcase: (dirPath: string): boolean => {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'));
          return !!pkg.showcase;
        } catch {
          return false;
        }
      },

      isBuilt: (dirPath: string): boolean => fs.existsSync(path.join(dirPath, 'dist', 'desktop', 'main.js')),

      getTargets: (showcasePath: string): Array<'desktop' | 'web'> => getShowcaseTargets(showcasePath),

      isWebBuilt: (showcasePath: string): boolean => isShowcaseWebBuilt(showcasePath),

      needsSourceRun: (showcasePath: string): boolean => hasShowcaseSourceChangesSinceBuild(showcasePath),

      needsWebSourceRun: (showcasePath: string): boolean => hasShowcaseWebSourceChangesSinceBuild(showcasePath),

      needsInstall: (showcasePath: string): boolean => getShowcaseDependencyStatus(showcasePath, dbg).needsInstall,

      installDependencies: async (showcasePath: string): Promise<boolean> => {
        try {
          return await ensureShowcaseDependencies(showcasePath, dbg, true, processOutputBuffer);
        } catch (error: any) {
          dbg(`showcase.installDependencies error: ${error.message}`);
          throw error;
        }
      },

      runWeb: (showcasePath: string): number => {
        try {
          ensureShowcaseSupportsWeb(showcasePath);
          const distWeb = path.join(showcasePath, 'dist', 'web');
          if (!isShowcaseWebBuilt(showcasePath)) {
            throw new Error('Showcase web build not found. dist/web/index.html not found.');
          }
          const serverScript = resolveShowcaseWebServerPath();
          if (!fs.existsSync(serverScript)) {
            throw new Error(`Web server entry missing: ${serverScript}`);
          }
          const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);
          emitCommandStart(processOutputBuffer, 'showcase.runWeb', showcasePath, lynxtronExecutable, [serverScript, distWeb]);
          const child = spawn(lynxtronExecutable, [serverScript, distWeb], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            detached: true,
            env: { ...process.env, LYNXTRON_RUN_AS_NODE: '1' },
          });
          attachUrlOpener(child, 'showcase.runWeb', dbg);
          attachProcessOutput(child, 'showcase.runWeb', processOutputBuffer);
          child.on('message', (message: any) => {
            if (message?.type === 'listening' && typeof message.url === 'string') {
              dbg(`showcase.runWeb: server ready url=${message.url}`);
              openExternalUrl(message.url, dbg);
            }
          });
          return trackRunningShowcase('showcase.runWeb', child, `cwd=${showcasePath} distWeb=${distWeb}`, runningShowcases, dbg);
        } catch (error: any) {
          dbg(`showcase.runWeb error: ${error.message}`);
          throw error;
        }
      },

      startWeb: async (showcasePath: string): Promise<number> => {
        try {
          ensureShowcaseSupportsWeb(showcasePath);
          if (!hasShowcaseScript(showcasePath, 'start:web')) {
            throw new Error('Showcase start:web script not found.');
          }
          await ensureShowcaseDependencies(showcasePath, dbg, false, processOutputBuffer);
          const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          emitCommandStart(processOutputBuffer, 'showcase.startWeb', showcasePath, npmCommand, ['run', 'start:web']);
          const child = spawn(npmCommand, ['run', 'start:web'], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: { ...process.env },
          });
          attachUrlOpener(child, 'showcase.startWeb', dbg);
          attachProcessOutput(child, 'showcase.startWeb', processOutputBuffer);
          return trackRunningShowcase('showcase.startWeb', child, `cwd=${showcasePath}`, runningShowcases, dbg);
        } catch (error: any) {
          dbg(`showcase.startWeb error: ${error.message}`);
          throw error;
        }
      },

      devWeb: async (showcasePath: string): Promise<number> => {
        try {
          ensureShowcaseSupportsWeb(showcasePath);
          if (!hasShowcaseScript(showcasePath, 'dev:web')) {
            throw new Error('Showcase dev:web script not found.');
          }
          await ensureShowcaseDependencies(showcasePath, dbg, false, processOutputBuffer);
          const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          emitCommandStart(processOutputBuffer, 'showcase.devWeb', showcasePath, npmCommand, ['run', 'dev:web']);
          const child = spawn(npmCommand, ['run', 'dev:web'], {
            cwd: showcasePath,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            env: { ...process.env },
          });
          attachUrlOpener(child, 'showcase.devWeb', dbg);
          attachProcessOutput(child, 'showcase.devWeb', processOutputBuffer);
          return trackRunningShowcase('showcase.devWeb', child, `cwd=${showcasePath}`, runningShowcases, dbg);
        } catch (error: any) {
          dbg(`showcase.devWeb error: ${error.message}`);
          throw error;
        }
      },
    },
    dispose: () => {
      for (const [, child] of runningShowcases) {
        try {
          child.kill();
        } catch (_) {}
      }
      runningShowcases.clear();
    },
  };
}
