import fs from 'fs';
import path from 'path';
import type { DebugLogger } from './preload-log';

const LYNXTRON_PACKAGE_NAME = '@lynx-js/lynxtron';

export function getRuntimeRequire(): NodeRequire {
  return typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__ as NodeRequire
    : require;
}

function getLynxtronExecutableRelativePaths(): string[] {
  switch (process.platform) {
    case 'darwin':
      return [path.join('lynxtron.app', 'Contents', 'MacOS', 'lynxtron')];
    case 'win32':
      return [
        'lynxtron.exe',
        path.join('lynxtron.exe'),
      ];
    default:
      throw new Error(`Unsupported Lynxtron platform: ${process.platform}`);
  }
}

function resolveLynxtronPackageRoot(nativeRequire: NodeRequire): string {
  const entryPath = nativeRequire.resolve(LYNXTRON_PACKAGE_NAME);
  let candidateDir = path.dirname(entryPath);

  while (candidateDir !== path.dirname(candidateDir)) {
    const packageJsonPath = path.join(candidateDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (pkg?.name === LYNXTRON_PACKAGE_NAME) {
          return candidateDir;
        }
      } catch (_) {}
    }
    candidateDir = path.dirname(candidateDir);
  }

  throw new Error(`Unable to resolve package root for ${LYNXTRON_PACKAGE_NAME} from ${entryPath}`);
}

export interface LynxtronRuntimePaths {
  executablePath: string;
  packageEntryPath: string;
}

function findLynxtronExecutable(packageRoot: string, dbg?: DebugLogger): string | null {
  dbg?.(`findLynxtronExecutable called with packageRoot: ${packageRoot}`);
  const relativePaths = getLynxtronExecutableRelativePaths();
  dbg?.(`Looking for executables at relative paths: ${JSON.stringify(relativePaths)}`);
  
  for (const executableRelativePath of relativePaths) {
    const executablePath = path.join(packageRoot, 'dist', executableRelativePath);
    dbg?.(`Checking: ${executablePath}, exists: ${fs.existsSync(executablePath)}`);
    if (fs.existsSync(executablePath)) {
      dbg?.(`Found executable at: ${executablePath}`);
      return executablePath;
    }
  }
  
  // Also check with platform/arch subdirectory
  dbg?.(`Checking with platform/arch subdirectory...`);
  for (const executableRelativePath of relativePaths) {
    const executablePath = path.join(packageRoot, 'dist', process.platform, process.arch, executableRelativePath);
    dbg?.(`Checking: ${executablePath}, exists: ${fs.existsSync(executablePath)}`);
    if (fs.existsSync(executablePath)) {
      dbg?.(`Found executable at: ${executablePath}`);
      return executablePath;
    }
  }
  
  dbg?.(`No executable found`);
  return null;
}

function resolveBundledLynxtronPackageRoot(): string | null {
  const resourcesPath = (process as any).resourcesPath;
  if (!resourcesPath || process.platform !== 'win32') {
    return null;
  }

  const packageRoot = path.join(
    resourcesPath,
    'app',
    'node_modules',
    '@lynx-js',
    'lynxtron',
  );
  if (fs.existsSync(path.join(packageRoot, 'package.json'))) {
    return packageRoot;
  }
  return null;
}

function resolveBundledLynxtronExecutable(): string | null {
  if (process.platform !== 'win32') {
    return null;
  }

  const executablePath = path.join(path.dirname(process.execPath), 'lynxtron.exe');
  if (fs.existsSync(executablePath)) {
    return executablePath;
  }
  return null;
}

export function resolveLynxtronPackageEntryPath(dbg: DebugLogger): string {
  const localRoot = process.env.LYNXTRON_LOCAL_ROOT;
  if (localRoot) {
    const localPackageEntryPath = path.join(localRoot, 'src', 'packages', 'lynxtron', 'lynxtron.js');
    if (fs.existsSync(localPackageEntryPath)) {
      return localPackageEntryPath;
    }
    dbg(`showcase.resolveLynxtronPackageEntryPath: local package entry not found at ${localPackageEntryPath}, falling back to installed package`);
  }

  const bundledPackageRoot = resolveBundledLynxtronPackageRoot();
  if (bundledPackageRoot) {
    dbg(`Using bundled package entry path`);
    return path.join(bundledPackageRoot, 'lynxtron.js');
  }

  // Try asar.unpacked first
  const asarUnpackedResult = tryFindAsarUnpackedExecutable(dbg);
  if (asarUnpackedResult) {
    dbg(`Using asar.unpacked package entry path`);
    return asarUnpackedResult.packageEntryPath;
  }

  // Fall back to normal node_modules resolution
  return path.join(resolveLynxtronPackageRoot(getRuntimeRequire()), 'lynxtron.js');
}

function getAppResourcesPath(dbg?: DebugLogger): string | null {
  if (process.platform === 'darwin') {
    // macOS: .app/Contents/Resources
    const appPath = process.execPath;
    if (appPath.endsWith('.app/Contents/MacOS/') || appPath.includes('.app/Contents/MacOS/')) {
      const contentsDir = path.dirname(path.dirname(appPath));
      const resourcesPath = path.join(contentsDir, 'Resources');
      dbg?.(`macOS resources path detected: ${resourcesPath}`);
      return resourcesPath;
    }
  } else if (process.platform === 'win32') {
    // Windows: resources
    const exeDir = path.dirname(process.execPath);
    const resourcesPath = path.join(exeDir, 'resources');
    dbg?.(`Windows resources path detected: ${resourcesPath}`);
    return resourcesPath;
  }
  return null;
}

function tryFindAsarUnpackedExecutable(dbg?: DebugLogger): LynxtronRuntimePaths | null {
  const resourcesPath = getAppResourcesPath(dbg);
  if (!resourcesPath) {
    return null;
  }

  const asarUnpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', LYNXTRON_PACKAGE_NAME);
  dbg?.(`Checking asar.unpacked path: ${asarUnpackedPath}`);
  
  const packageJsonPath = path.join(asarUnpackedPath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    dbg?.(`asar.unpacked package.json not found at ${packageJsonPath}`);
    return null;
  }

  const executablePath = findLynxtronExecutable(asarUnpackedPath, dbg);
  if (executablePath) {
    dbg?.(`Found asar.unpacked executable at: ${executablePath}`);
    return {
      executablePath,
      packageEntryPath: path.join(asarUnpackedPath, 'lynxtron.js'),
    };
  }
  
  dbg?.(`asar.unpacked executable not found`);
  return null;
}

export function resolveLynxtronRuntimePaths(dbg: DebugLogger): LynxtronRuntimePaths {
  dbg(`resolveLynxtronRuntimePaths called`);
  dbg(`process.platform: ${process.platform}, process.arch: ${process.arch}`);
  const localRoot = process.env.LYNXTRON_LOCAL_ROOT;
  dbg(`LYNXTRON_LOCAL_ROOT: ${localRoot}`);
  if (localRoot) {
    const localPackageRoot = path.join(localRoot, 'src', 'packages', 'lynxtron');
    dbg(`Looking for local executable at: ${localPackageRoot}`);
    const localExecutablePath = findLynxtronExecutable(localPackageRoot, dbg);
    dbg(`Local executable found: ${localExecutablePath}`);
    if (localExecutablePath) {
      dbg(`Using local executable`);
      return {
        executablePath: localExecutablePath,
        packageEntryPath: path.join(localPackageRoot, 'lynxtron.js'),
      };
    }
    dbg(`showcase.resolveLynxtronRuntimePaths: local executable not found, falling back to installed package`);
  }

  const bundledPackageRoot = resolveBundledLynxtronPackageRoot();
  const bundledExecutablePath = resolveBundledLynxtronExecutable();
  if (bundledPackageRoot && bundledExecutablePath) {
    dbg(`Using bundled Windows Lynxtron executable`);
    return {
      executablePath: bundledExecutablePath,
      packageEntryPath: path.join(bundledPackageRoot, 'lynxtron.js'),
    };
  }

  // Try asar.unpacked first (packaged app)
  dbg(`Checking for asar.unpacked...`);
  const asarUnpackedResult = tryFindAsarUnpackedExecutable(dbg);
  if (asarUnpackedResult) {
    dbg(`Using asar.unpacked executable`);
    return asarUnpackedResult;
  }

  // Fall back to normal node_modules resolution
  dbg(`Resolving installed package...`);
  const packageRoot = resolveLynxtronPackageRoot(getRuntimeRequire());
  dbg(`packageRoot: ${packageRoot}`);
  const executablePath = findLynxtronExecutable(packageRoot, dbg);
  dbg(`executablePath: ${executablePath}`);
  if (!executablePath) {
    const expectedPaths = getLynxtronExecutableRelativePaths()
      .map((relativePath) => path.join(packageRoot, 'dist', process.platform, process.arch, relativePath))
      .join(', ');
    dbg(`Executable not found, expected paths: ${expectedPaths}`);
    throw new Error(`Lynxtron executable not found. Expected one of: ${expectedPaths}`);
  }

  const result = {
    executablePath,
    packageEntryPath: path.join(packageRoot, 'lynxtron.js'),
  };
  dbg(`resolveLynxtronRuntimePaths returning: ${JSON.stringify(result)}`);
  return result;
}

export function resolveLynxtronExecutablePath(dbg: DebugLogger): string {
  dbg(`resolveLynxtronExecutablePath called`);
  const result = resolveLynxtronRuntimePaths(dbg).executablePath;
  dbg(`resolveLynxtronExecutablePath returning: ${result}`);
  return result;
}
