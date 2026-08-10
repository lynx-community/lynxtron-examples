import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export type ShowcaseInstallReason =
  | 'missing-node-modules'
  | 'incomplete-node-modules'
  | 'manifest-changed'
  | 'bootstrapped'
  | 'up-to-date';

export interface ShowcaseInstallPlan {
  command: string;
  args: string[];
  cwd: string;
  manager: 'pnpm';
  requiredNodeModules: string[];
  userConfigPath?: string;
}

export interface ShowcaseDependencyStatus {
  needsInstall: boolean;
  reason: ShowcaseInstallReason;
  fingerprint: string;
  resolvedShowcasePath: string;
  installPlan: ShowcaseInstallPlan;
}

export interface NodeVersionRequirement {
  range: string;
  sourceKind: 'engines' | 'nvmrc';
}

export type ShowcaseTarget = 'desktop' | 'web';

const SOURCE_SKIP_DIRS = new Set([
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

const SOURCE_ROOT_ENTRIES = [
  'src',
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'lynx.config.ts',
  'rspack.config.ts',
  'rsbuild.config.ts',
  'rsbuild.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.desktop.json',
  'tsconfig.web.json',
  'tsconfig.tools.json',
];

function hashFileIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readPackageJson(showcasePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(showcasePath, 'package.json'), 'utf-8'));
}

function hasScript(pkg: any, scriptName: string): boolean {
  return typeof pkg?.scripts?.[scriptName] === 'string' && pkg.scripts[scriptName].trim().length > 0;
}

export function getShowcaseTargets(showcasePath: string): ShowcaseTarget[] {
  const resolvedShowcasePath = path.resolve(showcasePath);
  try {
    const pkg = readPackageJson(resolvedShowcasePath);
    const explicitTargets = Array.isArray(pkg?.showcase?.targets)
      ? pkg.showcase.targets.filter(
          (target: unknown): target is ShowcaseTarget => target === 'desktop' || target === 'web',
        )
      : null;
    if (explicitTargets && explicitTargets.length) {
      return Array.from(new Set(explicitTargets));
    }

    const targets: ShowcaseTarget[] = ['desktop'];
    const hasWebScripts = hasScript(pkg, 'build:web') && (hasScript(pkg, 'start:web') || hasScript(pkg, 'dev:web'));
    const hasWebHost = fs.existsSync(path.join(resolvedShowcasePath, 'src', 'main', 'web'));
    if (hasWebScripts && hasWebHost) {
      targets.push('web');
    }
    return targets;
  } catch {
    return ['desktop'];
  }
}

export function hasShowcaseScript(showcasePath: string, scriptName: string): boolean {
  const resolvedShowcasePath = path.resolve(showcasePath);
  try {
    const pkg = readPackageJson(resolvedShowcasePath);
    return hasScript(pkg, scriptName);
  } catch {
    return false;
  }
}

function hasWorkspaceProtocolDependencyMap(deps: Record<string, string> | undefined): boolean {
  if (!deps) return false;
  return Object.values(deps).some(version => typeof version === 'string' && version.startsWith('workspace:'));
}

function usesWorkspaceProtocol(showcasePath: string): boolean {
  try {
    const pkg = readPackageJson(showcasePath);
    return [
      pkg.dependencies,
      pkg.devDependencies,
      pkg.peerDependencies,
      pkg.optionalDependencies,
    ].some(hasWorkspaceProtocolDependencyMap);
  } catch {
    return false;
  }
}

function findNearestAncestorWithFile(startPath: string, fileName: string): string | null {
  let current = path.resolve(startPath);
  const homeDir = path.resolve(os.homedir());
  while (true) {
    if (current === homeDir) return null;
    if (fs.existsSync(path.join(current, fileName))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readPackageNodeRequirement(packageJsonPath: string): NodeVersionRequirement | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (typeof pkg?.engines?.node === 'string' && pkg.engines.node.trim()) {
      return {
        range: pkg.engines.node.trim(),
        sourceKind: 'engines',
      };
    }
  } catch {}
  return null;
}

function readNvmrcNodeRequirement(nvmrcPath: string): NodeVersionRequirement | null {
  try {
    const raw = fs.readFileSync(nvmrcPath, 'utf-8').trim();
    if (raw) {
      return {
        range: raw,
        sourceKind: 'nvmrc',
      };
    }
  } catch {}
  return null;
}

export function getNodeVersionRequirement(targetPath: string): NodeVersionRequirement | null {
  let current = path.resolve(targetPath);
  while (true) {
    const packageRequirement = readPackageNodeRequirement(path.join(current, 'package.json'));
    if (packageRequirement) {
      return packageRequirement;
    }

    const nvmrcRequirement = readNvmrcNodeRequirement(path.join(current, '.nvmrc'));
    if (nvmrcRequirement) {
      return nvmrcRequirement;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function parseVersionParts(rawVersion: string): number[] | null {
  const normalized = rawVersion.trim().replace(/^v/i, '').replace(/-.*$/, '');
  if (!normalized) return null;
  const parts = normalized.split('.');
  if (parts.some(part => !/^\d+$/.test(part))) {
    return null;
  }
  return [
    Number(parts[0] ?? 0),
    Number(parts[1] ?? 0),
    Number(parts[2] ?? 0),
  ];
}

function compareVersionParts(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function tokenizeNodeRange(range: string): string[] {
  return range.split(/\s+/).map(token => token.trim()).filter(Boolean);
}

function matchesVersionPrefix(versionParts: number[], rawPrefix: string): boolean {
  const normalizedPrefix = rawPrefix.replace(/^v/i, '').replace(/\.x$/i, '').replace(/\.\*$/i, '');
  if (!normalizedPrefix) return false;
  const prefixParts = normalizedPrefix.split('.');
  if (prefixParts.some(part => !/^\d+$/.test(part))) {
    return false;
  }
  return prefixParts.every((part, index) => versionParts[index] === Number(part));
}

function satisfiesComparator(versionParts: number[], token: string): boolean | null {
  const comparatorMatch = token.match(/^(>=|<=|>|<|=|\^|~)(.+)$/);
  if (!comparatorMatch) return null;

  const operator = comparatorMatch[1];
  const targetParts = parseVersionParts(comparatorMatch[2]);
  if (!targetParts) return null;

  const compared = compareVersionParts(versionParts, targetParts);
  switch (operator) {
    case '>':
      return compared > 0;
    case '>=':
      return compared >= 0;
    case '<':
      return compared < 0;
    case '<=':
      return compared <= 0;
    case '=':
      return compared === 0;
    case '^':
      return versionParts[0] === targetParts[0] && compared >= 0;
    case '~':
      return (
        versionParts[0] === targetParts[0] &&
        versionParts[1] === targetParts[1] &&
        compared >= 0
      );
    default:
      return null;
  }
}

function satisfiesRangeToken(versionParts: number[], token: string): boolean {
  if (token === '*' || token.toLowerCase() === 'latest') {
    return true;
  }

  const comparatorResult = satisfiesComparator(versionParts, token);
  if (comparatorResult !== null) {
    return comparatorResult;
  }

  if (/[x*]$/i.test(token) || /^\d+(?:\.\d+){0,2}$/.test(token.replace(/^v/i, ''))) {
    return matchesVersionPrefix(versionParts, token);
  }

  return false;
}

export function isNodeVersionSatisfied(currentVersion: string, range: string): boolean {
  const versionParts = parseVersionParts(currentVersion);
  if (!versionParts) return false;

  const disjunctions = range.split('||').map(part => part.trim()).filter(Boolean);
  if (!disjunctions.length) return true;

  return disjunctions.some(part => tokenizeNodeRange(part).every(token => satisfiesRangeToken(versionParts, token)));
}

function describeNodeVersionRange(range: string): string {
  const trimmed = range.trim();
  const atLeastMatch = trimmed.match(/^>=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (atLeastMatch) {
    return atLeastMatch[1] ? `${atLeastMatch[1]} or newer` : trimmed;
  }

  if (/^v?\d+(?:\.\d+){0,2}$/.test(trimmed)) {
    return `${trimmed.replace(/^v/i, '')}.x`;
  }

  return trimmed;
}

// pnpm runs with Lynxtron-as-node (not the system Node), so version errors
// must point at the runtime — telling users to `brew install node` fixes
// nothing here.
export function formatNodeVersionRequirementError(
  requirement: NodeVersionRequirement,
  currentVersion: string | null,
): string {
  const installHint = describeNodeVersionRange(requirement.range);
  if (!currentVersion) {
    return `Lynxtron's Node.js runtime was not detected. Reinstall or update Lynxtron and retry.`;
  }

  return `Lynxtron's Node.js version ${currentVersion} does not satisfy required version ${requirement.range}. Update Lynxtron to a build shipping Node ${installHint}.`;
}

export function getShowcaseInstallPlan(showcasePath: string): ShowcaseInstallPlan {
  const resolvedShowcasePath = path.resolve(showcasePath);
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const workspaceRoot = usesWorkspaceProtocol(resolvedShowcasePath)
    ? findNearestAncestorWithFile(resolvedShowcasePath, 'pnpm-workspace.yaml')
    : null;
  const userConfigRoot = findNearestAncestorWithFile(resolvedShowcasePath, '.npmrc');
  const userConfigPath = userConfigRoot ? path.join(userConfigRoot, '.npmrc') : undefined;

  // Packaged Lynxtron installs bundle pnpm and shim `node`/`pnpm` onto PATH,
  // but never `npm` — Finder-launched apps inherit no user PATH, so any
  // `npm install` here fails with `spawn npm ENOENT`. Standalone showcases
  // (no pnpm-workspace ancestor) therefore also install via pnpm.
  if (!workspaceRoot) {
    return {
      command: pnpmCommand,
      args: ['install'],
      cwd: resolvedShowcasePath,
      manager: 'pnpm',
      requiredNodeModules: [path.join(resolvedShowcasePath, 'node_modules')],
      ...(userConfigPath ? { userConfigPath } : {}),
    };
  }

  const relativeShowcasePath = path.relative(workspaceRoot, resolvedShowcasePath).split(path.sep).join('/');
  return {
    command: pnpmCommand,
    args: ['install', '--filter', `./${relativeShowcasePath}...`],
    cwd: workspaceRoot,
    manager: 'pnpm',
    requiredNodeModules: [
      path.join(workspaceRoot, 'node_modules'),
      path.join(resolvedShowcasePath, 'node_modules'),
    ],
    ...(userConfigPath ? { userConfigPath } : {}),
  };
}

export function buildShowcaseInstallEnv(
  userConfigPath: string | undefined,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  if (!userConfigPath) return env;

  // npm registry config inherited from parent package-manager processes has
  // higher priority than the userconfig file written for preview workspaces.
  for (const key of Object.keys(env)) {
    const normalized = key.toLowerCase();
    if (normalized === 'npm_config_registry' || normalized === 'npm_config_userconfig') {
      delete env[key];
    }
  }
  env.NPM_CONFIG_USERCONFIG = userConfigPath;
  return env;
}

export function getShowcaseInstallFingerprint(showcasePath: string): string {
  const resolvedShowcasePath = path.resolve(showcasePath);
  const installPlan = getShowcaseInstallPlan(resolvedShowcasePath);
  const fingerprint: Record<string, string | null> = {
    packageJson: hashFileIfExists(path.join(resolvedShowcasePath, 'package.json')),
    packageLock: hashFileIfExists(path.join(resolvedShowcasePath, 'package-lock.json')),
    npmShrinkwrap: hashFileIfExists(path.join(resolvedShowcasePath, 'npm-shrinkwrap.json')),
  };

  if (installPlan.cwd !== resolvedShowcasePath) {
    fingerprint.workspacePackageJson = hashFileIfExists(path.join(installPlan.cwd, 'package.json'));
    fingerprint.workspaceLock = hashFileIfExists(path.join(installPlan.cwd, 'pnpm-lock.yaml'));
    fingerprint.workspaceManifest = hashFileIfExists(path.join(installPlan.cwd, 'pnpm-workspace.yaml'));
  }

  return JSON.stringify(fingerprint);
}

function getLatestMtimeMs(targetPath: string): number {
  if (!fs.existsSync(targetPath)) return 0;
  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return 0;
  }

  if (stat.isFile()) {
    return stat.mtimeMs;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  let latest = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(targetPath);
  } catch {
    return 0;
  }

  for (const name of entries) {
    if (SOURCE_SKIP_DIRS.has(name)) continue;
    latest = Math.max(latest, getLatestMtimeMs(path.join(targetPath, name)));
  }

  return latest;
}

export function hasShowcaseSourceChangesSinceBuild(showcasePath: string): boolean {
  const resolvedShowcasePath = path.resolve(showcasePath);
  const desktopMainPath = path.join(resolvedShowcasePath, 'dist', 'desktop', 'main.js');
  if (!fs.existsSync(desktopMainPath)) {
    return true;
  }

  let buildMtimeMs = 0;
  try {
    buildMtimeMs = fs.statSync(desktopMainPath).mtimeMs;
  } catch {
    return true;
  }

  let latestSourceMtimeMs = 0;
  for (const entry of SOURCE_ROOT_ENTRIES) {
    latestSourceMtimeMs = Math.max(
      latestSourceMtimeMs,
      getLatestMtimeMs(path.join(resolvedShowcasePath, entry)),
    );
  }

  return latestSourceMtimeMs > buildMtimeMs;
}

export function isShowcaseWebBuilt(showcasePath: string): boolean {
  const resolvedShowcasePath = path.resolve(showcasePath);
  return fs.existsSync(path.join(resolvedShowcasePath, 'dist', 'web', 'index.html'));
}

export function hasShowcaseWebSourceChangesSinceBuild(showcasePath: string): boolean {
  const resolvedShowcasePath = path.resolve(showcasePath);
  const webIndexPath = path.join(resolvedShowcasePath, 'dist', 'web', 'index.html');
  if (!fs.existsSync(webIndexPath)) {
    return true;
  }

  let buildMtimeMs = 0;
  try {
    buildMtimeMs = Math.max(
      fs.statSync(webIndexPath).mtimeMs,
      getLatestMtimeMs(path.join(resolvedShowcasePath, 'dist', 'web')),
    );
  } catch {
    return true;
  }

  let latestSourceMtimeMs = 0;
  for (const entry of SOURCE_ROOT_ENTRIES) {
    latestSourceMtimeMs = Math.max(
      latestSourceMtimeMs,
      getLatestMtimeMs(path.join(resolvedShowcasePath, entry)),
    );
  }

  return latestSourceMtimeMs > buildMtimeMs;
}

export function getShowcaseDependencyStatus(
  showcasePath: string,
  installState: Record<string, string>,
): ShowcaseDependencyStatus {
  const resolvedShowcasePath = path.resolve(showcasePath);
  const fingerprint = getShowcaseInstallFingerprint(resolvedShowcasePath);
  const installPlan = getShowcaseInstallPlan(resolvedShowcasePath);
  const recordedFingerprint = installState[resolvedShowcasePath];

  if (installPlan.requiredNodeModules.some(nodeModulesPath => !fs.existsSync(nodeModulesPath))) {
    return {
      needsInstall: true,
      reason: 'missing-node-modules',
      fingerprint,
      resolvedShowcasePath,
      installPlan,
    };
  }

  // A `node_modules` directory can exist while its contents are a broken
  // shell: pnpm creates the symlink layout up front and populates the store
  // afterwards, so an install killed mid-way (network flake, 5 min timeout,
  // user quit) leaves dangling symlinks that pass `existsSync` on the dir
  // itself but resolve to nothing. The observable failure is `sh: cross-env:
  // command not found` at `pnpm start`, because the package's manifest lists
  // dependencies whose install-time bin never landed. Verify every declared
  // dependency actually resolves before trusting the tree.
  if (isNodeModulesIncomplete(resolvedShowcasePath)) {
    return {
      needsInstall: true,
      reason: 'incomplete-node-modules',
      fingerprint,
      resolvedShowcasePath,
      installPlan,
    };
  }

  if (!recordedFingerprint) {
    return {
      needsInstall: false,
      reason: 'bootstrapped',
      fingerprint,
      resolvedShowcasePath,
      installPlan,
    };
  }

  if (recordedFingerprint !== fingerprint) {
    return {
      needsInstall: true,
      reason: 'manifest-changed',
      fingerprint,
      resolvedShowcasePath,
      installPlan,
    };
  }

  return {
    needsInstall: false,
    reason: 'up-to-date',
    fingerprint,
    resolvedShowcasePath,
    installPlan,
  };
}

function isNodeModulesIncomplete(showcasePath: string): boolean {
  const nodeModulesDir = path.join(showcasePath, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) return true;

  let pkg: any;
  try {
    pkg = readPackageJson(showcasePath);
  } catch {
    return false;
  }

  const declared: string[] = [
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.devDependencies ?? {}),
  ];
  if (!declared.length) return false;

  for (const name of declared) {
    // `existsSync` follows symlinks, so a dangling pnpm symlink into a
    // half-populated `.pnpm` store reports false. Checking the package's
    // own `package.json` (rather than just the directory) additionally
    // rejects the case where the store dropped the manifest but kept the
    // folder — that would still be unusable.
    if (!fs.existsSync(path.join(nodeModulesDir, name, 'package.json'))) {
      return true;
    }
  }
  return false;
}
