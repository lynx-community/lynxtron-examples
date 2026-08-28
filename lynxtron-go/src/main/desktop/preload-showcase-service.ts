import { execFileSync, fork, spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as tar from 'tar';
import {
  buildShowcaseInstallEnv,
  formatShowcaseInstallNodeCompatibilityError,
  getShowcaseDependencyStatus as computeShowcaseDependencyStatus,
  getShowcaseTargets,
  hasShowcaseScript,
  hasShowcaseWebSourceChangesSinceBuild,
  isNodeVersionSatisfied,
} from './showcase-install';
import { readInstallState, writeInstallState } from './preload-config-store';
import type { DebugLogger } from './preload-log';
import { getAppResourcesPath, getRuntimeRequire, resolveLynxtronExecutablePath } from './preload-lynxtron-runtime';
import { resolveMaterializedShowcasePath } from './showcase-cache';
import {
  resolveShowcaseRunTarget,
  verifyShowcaseRelease,
} from '@lynxtron-examples/cli/dist/showcase-release.js';

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
const BUILTIN_SHOWCASE_URL_PREFIX = 'builtin-showcase://';
const BUILTIN_SHOWCASE_FILE_PREFIX = 'lynxtron-examples-';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]|\x1B[PX^_][\s\S]*?\x1B\\|\x1B[^[\]()#;?PX^_]/g;

function resolveCliPath(): string {
  return getRuntimeRequire().resolve('@lynxtron-examples/cli/dist/index.js');
}

export type ProjectRunPlan =
  | { kind: 'precompiled'; path: string; reason: string }
  | { kind: 'source'; path: string; reason: string; projectKind: 'showcase' | 'custom' };

export function isShowcaseProject(projectRoot: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
    return !!pkg?.showcase;
  } catch {
    return false;
  }
}

/**
 * Only a registered showcase with a verified, source-matched release artifact
 * may take the precompiled short path. Every other project uses the normal
 * source-build path; an existing dist/ directory is only build output and is
 * deliberately not part of this classification.
 */
export function resolveProjectRunPlan(projectRoot: string): ProjectRunPlan {
  const sourcePath = path.join(projectRoot, 'dist', 'desktop');
  if (!isShowcaseProject(projectRoot)) {
    return {
      kind: 'source',
      path: sourcePath,
      reason: 'project is not a released showcase',
      projectKind: 'custom',
    };
  }

  const verification = verifyShowcaseRelease(projectRoot);
  const desktop = verification.status === 'verified'
    ? verification.manifest.artifact.targets.desktop
    : undefined;
  if (verification.status === 'verified' && desktop) {
    return {
      kind: 'precompiled',
      path: path.join(projectRoot, verification.manifest.artifact.root, desktop.root),
      reason: 'showcase source and precompiled artifact match the release manifest',
    };
  }

  return {
    kind: 'source',
    path: sourcePath,
    reason: verification.status === 'verified'
      ? 'verified showcase release has no desktop artifact'
      : verification.reason,
    projectKind: 'showcase',
  };
}

function builtinShowcaseRoots(): string[] {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const detectedResourcesPath = getAppResourcesPath();
  return Array.from(new Set([
    ...(resourcesPath ? [path.join(resourcesPath, 'builtin-showcases')] : []),
    ...(detectedResourcesPath ? [path.join(detectedResourcesPath, 'builtin-showcases')] : []),
    // Lynxtron 0.0.15 does not expose process.resourcesPath to preload. When
    // __dirname is Resources/app.asar, the external resource folder is beside it.
    path.join(path.dirname(__dirname), 'builtin-showcases'),
    path.join(__dirname, 'builtin-showcases'),
  ]));
}

/**
 * Turn the stable URL baked into the Lynx bundle into the versioned tgz that
 * ships beside app.asar. The physical filename is part of the CLI cache key,
 * so a new installer tag cannot reuse an older extracted built-in workspace.
 */
export function resolveBuiltinShowcaseSourceUrl(
  sourceUrl: string,
  searchRoots: string[] = builtinShowcaseRoots(),
): string {
  if (!sourceUrl.startsWith(BUILTIN_SHOWCASE_URL_PREFIX)) return sourceUrl;

  const parsed = new URL(sourceUrl);
  const name = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+|\/+$/g, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`Invalid built-in showcase URL: ${sourceUrl}`);
  }

  const filenamePrefix = `${BUILTIN_SHOWCASE_FILE_PREFIX}${name}-`;
  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    const matches = fs.readdirSync(root)
      .filter(file => file.startsWith(filenamePrefix) && file.endsWith('.tgz'))
      .sort();
    if (matches.length > 1) {
      throw new Error(`Multiple built-in artifacts found for ${name} in ${root}: ${matches.join(', ')}`);
    }
    if (matches.length === 1) return pathToFileURL(path.join(root, matches[0])).href;
  }

  throw new Error(`Built-in showcase artifact not found for ${name}`);
}

/** Extract the canonical starter and turn it into an ordinary editable project. */
export async function createCustomProjectFromArchive(
  archivePath: string,
  projectsRoot: string,
  files: Record<string, string> = {},
): Promise<string> {
  fs.mkdirSync(projectsRoot, { recursive: true });
  const projectRoot = fs.mkdtempSync(path.join(projectsRoot, 'project-'));
  await tar.x({ file: archivePath, cwd: projectRoot, strip: 1 });

  for (const name of [
    '.lynxtron-release.json', 'dist_precompiled', 'dist', 'output',
    'node_modules', '.lynxtron-go-cache.json',
  ]) {
    fs.rmSync(path.join(projectRoot, name), { recursive: true, force: true });
  }
  const packagePath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  let overlayPackage: any = null;
  if (typeof files['package.json'] === 'string') {
    try { overlayPackage = JSON.parse(files['package.json']); } catch (_) {}
  }
  delete pkg.showcase;
  delete pkg.repository;
  pkg.name = `lynxtron-project-${path.basename(projectRoot).replace(/^project-/, '')}`;
  pkg.version = '0.0.0';
  pkg.private = true;
  if (overlayPackage) {
    if (typeof overlayPackage.name === 'string' && overlayPackage.name) pkg.name = overlayPackage.name;
    pkg.dependencies = { ...(pkg.dependencies ?? {}), ...(overlayPackage.dependencies ?? {}) };
    pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...(overlayPackage.devDependencies ?? {}) };
    if (typeof overlayPackage?.scripts?.build === 'string') {
      pkg.scripts = { ...(pkg.scripts ?? {}), ...overlayPackage.scripts };
    }
  }
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

  for (const [relativePath, contents] of Object.entries(files)) {
    if (relativePath === 'package.json' || !relativePath || path.isAbsolute(relativePath)) continue;
    const target = path.resolve(projectRoot, relativePath);
    const relative = path.relative(projectRoot, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return projectRoot;
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

function readNodeVersion(nodeCommand: string, env: NodeJS.ProcessEnv): string | null {
  try {
    return execFileSync(nodeCommand, ['--version'], {
      env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().replace(/^v/i, '') || null;
  } catch {
    return null;
  }
}

function readDeclaredNodeRange(packageJsonPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return typeof pkg?.engines?.node === 'string' && pkg.engines.node.trim()
      ? pkg.engines.node.trim()
      : null;
  } catch {
    return null;
  }
}

/** Read the compatibility contract from Lynxtron itself; Go owns no range. */
export function resolveLynxtronNodeRange(projectRoot: string): string | null {
  const localPackage = path.join(projectRoot, 'node_modules', '@lynx-js', 'lynxtron', 'package.json');
  if (fs.existsSync(localPackage)) return readDeclaredNodeRange(localPackage);

  const runtimeRequire = getRuntimeRequire();
  try {
    return readDeclaredNodeRange(runtimeRequire.resolve('@lynx-js/lynxtron/package.json'));
  } catch {}

  try {
    let current = path.dirname(runtimeRequire.resolve('@lynx-js/lynxtron'));
    while (true) {
      const packagePath = path.join(current, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        if (pkg?.name === '@lynx-js/lynxtron') {
          return typeof pkg?.engines?.node === 'string' && pkg.engines.node.trim()
            ? pkg.engines.node.trim()
            : null;
        }
      }
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  } catch {
    return null;
  }
}

export function resolveSystemNodeEnv(
  projectRoot: string,
  baseEnv: NodeJS.ProcessEnv,
  dbg?: DebugLogger,
  outputBuffer?: ShowcaseProcessOutputEntry[],
): NodeJS.ProcessEnv {
  const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
  const version = readNodeVersion(nodeCommand, baseEnv);
  if (!version) {
    throw new Error('System Node.js was not detected on PATH. Install Node.js (including npm), restart Lynxtron Go, then retry.');
  }
  const declaredRange = resolveLynxtronNodeRange(projectRoot);
  if (declaredRange && !isNodeVersionSatisfied(version, declaredRange)) {
    throw new Error(formatShowcaseInstallNodeCompatibilityError(version, declaredRange));
  }

  const message = declaredRange
    ? `using system Node ${version} resolved from PATH (@lynx-js/lynxtron declares ${declaredRange})`
    : `using system Node ${version} resolved from PATH (@lynx-js/lynxtron declares no engines.node range)`;
  dbg?.(`project.node: ${message}`);
  if (outputBuffer) emitOutputLine(outputBuffer, 'project.node', 'info', message);
  return { ...baseEnv };
}

async function ensureShowcaseDependencies(
  showcasePath: string,
  dbg: DebugLogger,
  force = false,
  outputBuffer?: ShowcaseProcessOutputEntry[],
  outputSource = 'showcase.install',
  baseEnv: NodeJS.ProcessEnv = showcaseSpawnEnv(showcasePath),
) {
  const status = getShowcaseDependencyStatus(showcasePath, dbg);
  if (!force && !status.needsInstall) {
    return false;
  }

  const commandText = `${status.installPlan.command} ${status.installPlan.args.join(' ')}`;
  const installEnv = resolveSystemNodeEnv(
    showcasePath,
    buildShowcaseInstallEnv(status.installPlan.userConfigPath, baseEnv),
    dbg,
    outputBuffer,
  );
  dbg(
    `showcase.install: cwd=${status.installPlan.cwd} reason=${force ? 'forced' : status.reason} command=${commandText}`
    + (status.installPlan.userConfigPath ? ` userconfig=${status.installPlan.userConfigPath}` : '')
  );
  try {
    if (outputBuffer) {
      emitCommandStart(outputBuffer, outputSource, status.installPlan.cwd, status.installPlan.command, status.installPlan.args);
    }
    await runInstallCommand({
      command: status.installPlan.command,
      args: status.installPlan.args,
      cwd: status.installPlan.cwd,
      env: installEnv,
      outputBuffer,
      outputSource,
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
    emitOutputLine(outputBuffer, outputSource, 'info', 'dependencies installed');
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

export function projectLaunchEnv(
  projectRoot: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ...(isSelfHostTarget(projectRoot) ? { LYNXTRON_FIDDLE_SELF_HOST: '1' } : {}),
    // Lynxtron otherwise routes a second launch to an existing default host
    // window and may discard the project argv entirely.
    LYNXTRON_ALLOW_MULTI: '1',
  };
}

function runInstallCommand(options: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  outputBuffer?: ShowcaseProcessOutputEntry[];
  outputSource?: string;
  timeoutMs?: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    if (options.outputBuffer) {
      attachProcessOutput(child, options.outputSource ?? 'showcase.install', options.outputBuffer);
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
    const timeoutMs = options.timeoutMs ?? INSTALL_TIMEOUT_MS;
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {}
      finish(Object.assign(new Error(`Command timed out after ${timeoutMs}ms: ${options.command} ${options.args.join(' ')}`), {
        stdout,
        stderr,
      }));
    }, timeoutMs);
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
    /**
     * Where a showcase would already be sitting if it has been fetched before,
     * or null. `fetch` wipes and re-extracts its destination every time, so
     * without this every open re-downloads and re-installs a workspace that is
     * already on disk — including opening the same showcase in the other
     * surface seconds later.
     */
    materializedPath: (name: string, sourceUrl?: string) => string | null;
    resolveRegistryPath: (relativePath: string) => string | null;
    readProcessOutput: () => ShowcaseProcessOutputEntry[];
    isRunning: (pid: number) => boolean;
    stop: (pid: number) => boolean;
    /** Classify, build when required, and launch any complete Lynx project. */
    runProject: (projectRoot: string, runtimeExecutable?: string) => Promise<number>;
    /** Create a complete editable project from the installer-bundled starter. */
    createCustomProject: (files?: Record<string, string>) => Promise<string>;
    /** Build (if needed) and launch ONE fiddle of a fiddle-collection showcase. */
    runFiddle: (showcasePath: string, fiddleId: string) => Promise<number>;
    dev: (showcasePath: string) => Promise<number>;
    list: () => Array<{ name: string; description: string; local: boolean }>;
    isShowcase: (dirPath: string) => boolean;
    getTargets: (showcasePath: string) => Array<'desktop' | 'web'>;
    isWebBuilt: (showcasePath: string) => boolean;
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

  const launchProjectTarget = (
    projectRoot: string,
    targetPath: string,
    source: 'project.launch' | 'showcase.precompiled',
    runtimeExecutable?: string,
  ): number => {
    const mainJsPath = path.join(targetPath, 'main.js');
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(`Desktop output is missing main.js: ${targetPath}`);
    }
    const executable = runtimeExecutable || resolveLynxtronExecutablePath(dbg);
    if (!fs.existsSync(executable)) {
      throw new Error(`Lynxtron runtime not found: ${executable}`);
    }
    emitCommandStart(processOutputBuffer, source, projectRoot, executable, [targetPath]);
    const child = spawn(executable, [targetPath], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: projectLaunchEnv(projectRoot),
    });
    attachProcessOutput(child, source, processOutputBuffer);
    return trackRunningShowcase(source, child, `project=${projectRoot} target=${targetPath}`, runningShowcases, dbg);
  };

  const runSourceProject = async (
    projectRoot: string,
    reason: string,
    runtimeExecutable?: string,
  ): Promise<number> => {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) throw new Error(`Project package.json not found: ${pkgPath}`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (typeof pkg?.scripts?.build !== 'string' || !pkg.scripts.build.trim()) {
      throw new Error('Source project package.json must define a build script.');
    }

    emitOutputLine(processOutputBuffer, 'project.classify', 'info', `source build: ${reason}`);
    const buildEnv = resolveSystemNodeEnv(projectRoot, showcaseSpawnEnv(projectRoot), dbg, processOutputBuffer);
    await ensureShowcaseDependencies(
      projectRoot,
      dbg,
      false,
      processOutputBuffer,
      'project.install',
      buildEnv,
    );

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    emitCommandStart(processOutputBuffer, 'project.build', projectRoot, npmCommand, ['run', 'build']);
    await runInstallCommand({
      command: npmCommand,
      args: ['run', 'build'],
      cwd: projectRoot,
      env: buildEnv,
      outputBuffer: processOutputBuffer,
      outputSource: 'project.build',
    });

    const desktopPath = path.join(projectRoot, 'dist', 'desktop');
    for (const requiredFile of ['main.js', 'main.lynx.bundle', 'package.json']) {
      if (!fs.existsSync(path.join(desktopPath, requiredFile))) {
        throw new Error(`Source build did not produce dist/desktop/${requiredFile}`);
      }
    }
    return launchProjectTarget(projectRoot, desktopPath, 'project.launch', runtimeExecutable);
  };

  const runProject = async (projectRoot: string, runtimeExecutable?: string): Promise<number> => {
    const resolvedRoot = path.resolve(projectRoot);
    const plan = resolveProjectRunPlan(resolvedRoot);
    dbg(`project.run: root=${resolvedRoot} kind=${plan.kind} reason=${plan.reason}`);
    if (plan.kind === 'precompiled') {
      emitOutputLine(processOutputBuffer, 'project.classify', 'info', `precompiled showcase: ${plan.reason}`);
      return launchProjectTarget(resolvedRoot, plan.path, 'showcase.precompiled', runtimeExecutable);
    }
    return runSourceProject(resolvedRoot, plan.reason, runtimeExecutable);
  };

  const createCustomProject = async (files: Record<string, string> = {}): Promise<string> => {
    const sourceUrl = resolveBuiltinShowcaseSourceUrl('builtin-showcase://hello-lynxtron');
    if (!sourceUrl.startsWith('file:')) {
      throw new Error(`Built-in starter did not resolve to a local package: ${sourceUrl}`);
    }
    const archivePath = fileURLToPath(sourceUrl);
    const projectsRoot = path.join(os.homedir(), '.lynxtron-go', 'projects');
    const projectRoot = await createCustomProjectFromArchive(archivePath, projectsRoot, files);
    dbg(`project.create: root=${projectRoot} starter=${archivePath} overlays=${Object.keys(files).length}`);
    return projectRoot;
  };

  return {
    bridge: {
      materializedPath: (name: string, sourceUrl?: string): string | null => {
        try {
          return resolveMaterializedShowcasePath(
            path.join(os.homedir(), '.lynxtron-go'),
            name,
            sourceUrl ? resolveBuiltinShowcaseSourceUrl(sourceUrl) : undefined,
          );
        } catch (error: any) {
          dbg(`showcase.materializedPath error: ${error?.message || String(error)}`);
          return null;
        }
      },
      fetch: async (url: string): Promise<string> => {
        try {
          dbg(`showcase.fetch enter url=${url}`);
          const sourceUrl = resolveBuiltinShowcaseSourceUrl(url);
          if (sourceUrl !== url) dbg(`showcase.fetch resolved built-in url=${sourceUrl}`);
          const cliPath = resolveCliPath();
          const appRoot = path.resolve(__dirname, '..', '..');
          const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);
          const workspacePath = path.join(os.homedir(), '.lynxtron-go');
          dbg(`showcase.fetch: cliPath=${cliPath} url=${sourceUrl} ws=${workspacePath}`);
          let result: string;
          try {
            const args = [cliPath, 'fetch', sourceUrl];
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

      runProject,
      createCustomProject,

      // A fiddle collection (showcases/electron-fiddles) is not one app: every
      // fiddle assembles into its own standalone project and runs as its own
      // process. Launching one therefore means assembling+building that project
      // — not building all 44 and opening the collection's home screen.
      runFiddle: async (showcasePath: string, fiddleId: string): Promise<number> => {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(fiddleId)) {
          throw new Error(`Invalid fiddle id: ${fiddleId}`);
        }
        const projectDist = path.join(showcasePath, '.assembled', fiddleId, 'dist', 'desktop');
        const lynxtronExecutable = resolveLynxtronExecutablePath(dbg);

        if (!fs.existsSync(path.join(projectDist, 'main.js'))) {
          // Assemble + build just this one. The assembler is a plain Node
          // script, so run the Lynxtron binary in Node mode rather than
          // depending on a system Node being installed.
          const args = ['scripts/assemble.mjs', fiddleId, '--build'];
          emitCommandStart(processOutputBuffer, 'showcase.runFiddle', showcasePath, lynxtronExecutable, args);
          await runInstallCommand({
            command: lynxtronExecutable,
            args,
            cwd: showcasePath,
            env: { ...process.env, LYNXTRON_RUN_AS_NODE: '1' },
            outputBuffer: processOutputBuffer,
          });
          if (!fs.existsSync(path.join(projectDist, 'main.js'))) {
            throw new Error(`Assembling "${fiddleId}" did not produce ${projectDist}/main.js`);
          }
        }

        emitCommandStart(processOutputBuffer, 'showcase.runFiddle', showcasePath, lynxtronExecutable, [projectDist]);
        const child = spawn(lynxtronExecutable, [projectDist], {
          cwd: showcasePath,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          env: projectLaunchEnv(showcasePath),
        });
        attachProcessOutput(child, 'showcase.runFiddle', processOutputBuffer);
        return trackRunningShowcase('showcase.runFiddle', child, `fiddle=${fiddleId}`, runningShowcases, dbg);
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

      getTargets: (showcasePath: string): Array<'desktop' | 'web'> => getShowcaseTargets(showcasePath),

      isWebBuilt: (showcasePath: string): boolean => resolveShowcaseRunTarget(showcasePath, 'web').kind !== 'missing',

      needsWebSourceRun: (showcasePath: string): boolean => {
        const target = resolveShowcaseRunTarget(showcasePath, 'web');
        return target.kind !== 'precompiled' && hasShowcaseWebSourceChangesSinceBuild(showcasePath);
      },

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
          const runTarget = resolveShowcaseRunTarget(showcasePath, 'web');
          if (runTarget.kind === 'missing') throw new Error(`Showcase web build not found: ${runTarget.reason}`);
          const distWeb = runTarget.path;
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
