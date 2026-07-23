import ts from 'typescript';
import path from 'path';
import type { DiagnosticMarker } from '../types';

declare const __non_webpack_require__: NodeJS.Require | undefined;

// In-memory file entry
interface FileEntry {
  version: number;
  content: string;
}

const LYNX_GLOBALS_WORKAROUND_FILE = '.lynxtron-go-lynx-globals.d.ts';
const LYNX_GLOBALS_WORKAROUND_SOURCE = `
export {};

declare global {
  interface Console {
    debug(...args: any[]): void;
    error(...args: any[]): void;
    group(label?: string): void;
    groupEnd(): void;
    info(...args: any[]): void;
    log(...args: any[]): void;
    alog(...args: any[]): void;
    warn(...args: any[]): void;
  }

  var console: Console;

  function setTimeout(callback: (...args: unknown[]) => unknown, delay: number): number;
  function setInterval(callback: (...args: unknown[]) => unknown, delay: number): number;
  function clearTimeout(timeoutId: number): void;
  function clearInterval(timeoutId: number): void;
}
`;

interface ProjectConfig {
  key: string;
  projectRoot: string;
  options: ts.CompilerOptions;
  rootFiles: string[];
}

interface BundledToolchainFallback {
  moduleEntries: Map<string, string>;
  typeEntries: Map<string, string>;
}

const TOOLING_CONFIG_FILES = new Set([
  'lynx.config.ts',
  'rspack.config.ts',
  'vitest.config.ts',
]);

let bundledToolchainFallbackCache: BundledToolchainFallback | null = null;

function getRuntimeRequire(): NodeJS.Require | null {
  if (typeof __non_webpack_require__ === 'function') return __non_webpack_require__;
  try {
    return eval('require') as NodeJS.Require;
  } catch {
    return null;
  }
}

function findPackageRoot(startPath: string): string | null {
  let current = path.dirname(startPath);

  while (true) {
    if (ts.sys.fileExists(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function findHighestNodeModulesDir(startPath: string): string | null {
  let current = path.dirname(startPath);
  let found: string | null = null;

  while (true) {
    if (path.basename(current) === 'node_modules') found = current;
    const parent = path.dirname(current);
    if (parent === current) return found;
    current = parent;
  }
}

function findDirectPackageDir(nodeModulesRoot: string, packageName: string): string | null {
  const packageDir = path.join(nodeModulesRoot, ...packageName.split('/'));
  return ts.sys.fileExists(path.join(packageDir, 'package.json')) ? packageDir : null;
}

function findHoistedPnpmPackageDir(nodeModulesRoot: string, packageName: string): string | null {
  const packageDir = path.join(nodeModulesRoot, '.pnpm', 'node_modules', ...packageName.split('/'));
  return ts.sys.fileExists(path.join(packageDir, 'package.json')) ? packageDir : null;
}

function pnpmPackagePrefix(packageName: string): string {
  return packageName.startsWith('@')
    ? `@${packageName.slice(1).replace('/', '+')}@`
    : `${packageName}@`;
}

function sortByPathName(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function findPnpmPackageDir(nodeModulesRoot: string, packageName: string): string | null {
  const pnpmRoot = path.join(nodeModulesRoot, '.pnpm');
  if (!ts.sys.directoryExists(pnpmRoot)) return null;

  const prefix = pnpmPackagePrefix(packageName);
  const matches = ts.sys.getDirectories(pnpmRoot)
    .map((dir) => (path.isAbsolute(dir) ? dir : path.join(pnpmRoot, dir)))
    .filter((dir) => path.basename(dir).startsWith(prefix))
    .sort(sortByPathName)
    .reverse();

  for (const dir of matches) {
    const packageDir = path.join(dir, 'node_modules', ...packageName.split('/'));
    if (ts.sys.fileExists(path.join(packageDir, 'package.json'))) {
      return packageDir;
    }
  }

  return null;
}

function findInstalledPackageDir(nodeModulesRoot: string, packageName: string): string | null {
  return findDirectPackageDir(nodeModulesRoot, packageName)
    ?? findHoistedPnpmPackageDir(nodeModulesRoot, packageName)
    ?? findPnpmPackageDir(nodeModulesRoot, packageName);
}

function resolvePackageRootFromRequest(
  runtimeRequire: NodeJS.Require,
  request: string,
): string | null {
  try {
    const resolved = runtimeRequire.resolve(request);
    return findPackageRoot(resolved);
  } catch {
    return null;
  }
}

function resolveBundledToolchainFallback(): BundledToolchainFallback {
  if (bundledToolchainFallbackCache) return bundledToolchainFallbackCache;

  const empty = { moduleEntries: new Map<string, string>(), typeEntries: new Map<string, string>() };
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    bundledToolchainFallbackCache = empty;
    return bundledToolchainFallbackCache;
  }

  const typescriptRoot = resolvePackageRootFromRequest(runtimeRequire, 'typescript');
  const nodeModulesRoot = typescriptRoot ? findHighestNodeModulesDir(typescriptRoot) : null;
  if (!nodeModulesRoot) {
    bundledToolchainFallbackCache = empty;
    return bundledToolchainFallbackCache;
  }

  const reactRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/react/package.json')
    ?? resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/react')
    ?? findInstalledPackageDir(nodeModulesRoot, '@lynx-js/react');
  const lynxTypesRoot = findInstalledPackageDir(nodeModulesRoot, '@lynx-js/types');
  const reactTypesRoot = findInstalledPackageDir(nodeModulesRoot, '@types/react');
  const nodeTypesRoot = findInstalledPackageDir(nodeModulesRoot, '@types/node');
  const rspeedyRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/rspeedy/package.json')
    ?? findInstalledPackageDir(nodeModulesRoot, '@lynx-js/rspeedy');
  const reactRsbuildPluginRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/react-rsbuild-plugin/package.json')
    ?? findInstalledPackageDir(nodeModulesRoot, '@lynx-js/react-rsbuild-plugin');
  const rsbuildCoreRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@rsbuild/core/package.json')
    ?? resolvePackageRootFromRequest(runtimeRequire, '@rsbuild/core')
    ?? findInstalledPackageDir(nodeModulesRoot, '@rsbuild/core');
  const rsdoctorRspackPluginRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@rsdoctor/rspack-plugin/package.json')
    ?? resolvePackageRootFromRequest(runtimeRequire, '@rsdoctor/rspack-plugin')
    ?? findInstalledPackageDir(nodeModulesRoot, '@rsdoctor/rspack-plugin');
  const rspackCoreRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@rspack/core/package.json')
    ?? resolvePackageRootFromRequest(runtimeRequire, '@rspack/core')
    ?? findInstalledPackageDir(nodeModulesRoot, '@rspack/core');
  const rspackCliRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@rspack/cli/package.json')
    ?? resolvePackageRootFromRequest(runtimeRequire, '@rspack/cli')
    ?? findInstalledPackageDir(nodeModulesRoot, '@rspack/cli');
  const lynxtronRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/lynxtron')
    ?? findInstalledPackageDir(nodeModulesRoot, '@lynx-js/lynxtron');
  const lynxtronDevPluginsRoot =
    resolvePackageRootFromRequest(runtimeRequire, '@lynx-js/lynxtron-dev-plugins/rspack')
    ?? findInstalledPackageDir(nodeModulesRoot, '@lynx-js/lynxtron-dev-plugins');

  const moduleEntries = new Map<string, string>();
  const typeEntries = new Map<string, string>();

  const addModule = (name: string, filePath: string | null | undefined) => {
    if (!filePath) return;
    if (!ts.sys.fileExists(filePath)) return;
    moduleEntries.set(name, filePath);
  };

  const addType = (name: string, filePath: string | null | undefined) => {
    if (!filePath) return;
    if (!ts.sys.fileExists(filePath)) return;
    typeEntries.set(name, filePath);
  };

  addModule('@lynx-js/react', reactRoot ? path.join(reactRoot, 'types/react.d.ts') : null);
  addModule('@lynx-js/react/jsx-runtime', reactRoot ? path.join(reactRoot, 'runtime/jsx-runtime/index.d.ts') : null);
  addModule('@lynx-js/react/jsx-dev-runtime', reactRoot ? path.join(reactRoot, 'runtime/jsx-dev-runtime/index.d.ts') : null);
  addModule('@lynx-js/types', lynxTypesRoot ? path.join(lynxTypesRoot, 'types/index.d.ts') : null);
  addType('@lynx-js/types', lynxTypesRoot ? path.join(lynxTypesRoot, 'types/index.d.ts') : null);
  addType('node', nodeTypesRoot ? path.join(nodeTypesRoot, 'index.d.ts') : null);

  addModule('react', reactTypesRoot ? path.join(reactTypesRoot, 'index.d.ts') : null);
  addModule('react/jsx-runtime', reactTypesRoot ? path.join(reactTypesRoot, 'jsx-runtime.d.ts') : null);
  addModule('react/jsx-dev-runtime', reactTypesRoot ? path.join(reactTypesRoot, 'jsx-dev-runtime.d.ts') : null);

  addModule('@lynx-js/rspeedy', rspeedyRoot ? path.join(rspeedyRoot, 'dist/index.d.ts') : null);
  addModule('@lynx-js/react-rsbuild-plugin', reactRsbuildPluginRoot ? path.join(reactRsbuildPluginRoot, 'dist/index.d.ts') : null);
  addModule('@rsbuild/core', rsbuildCoreRoot ? path.join(rsbuildCoreRoot, 'dist-types/index.d.ts') : null);
  addModule('@rsdoctor/rspack-plugin', rsdoctorRspackPluginRoot ? path.join(rsdoctorRspackPluginRoot, 'dist/index.d.ts') : null);
  addModule('@rspack/core', rspackCoreRoot ? path.join(rspackCoreRoot, 'dist/index.d.ts') : null);
  addModule('@rspack/cli', rspackCliRoot ? path.join(rspackCliRoot, 'dist/index.d.ts') : null);

  addModule('@lynx-js/lynxtron', lynxtronRoot ? path.join(lynxtronRoot, 'apis/lynxtron.d.ts') : null);
  addModule(
    '@lynx-js/lynxtron/context-bridge',
    lynxtronRoot ? path.join(lynxtronRoot, 'apis/api/context-bridge.d.ts') : null,
  );
  addModule(
    '@lynx-js/lynxtron-dev-plugins/rspack',
    lynxtronDevPluginsRoot ? path.join(lynxtronDevPluginsRoot, 'dist/rspack.d.ts') : null,
  );
  addModule(
    '@lynx-js/lynxtron-dev-plugins/rspeedy',
    lynxtronDevPluginsRoot ? path.join(lynxtronDevPluginsRoot, 'dist/rspeedy.d.ts') : null,
  );

  bundledToolchainFallbackCache = { moduleEntries, typeEntries };
  return bundledToolchainFallbackCache;
}

function shouldUseBundledModuleFallback(
  resolved: ts.ResolvedModule | undefined,
  fallbackPath: string | undefined,
): fallbackPath is string {
  if (!fallbackPath || !ts.sys.fileExists(fallbackPath)) return false;
  if (!resolved) return true;

  return /\.(?:[cm]?js|jsx)$/.test(resolved.resolvedFileName);
}

function needsLynxGlobalsWorkaround(options: ts.CompilerOptions): boolean {
  if (!options.types?.includes('@lynx-js/types')) return false;

  // An omitted lib list uses TypeScript's defaults, which already include DOM.
  // Lynx app configs explicitly choose an ES-only lib to avoid browser globals.
  if (!options.lib) return false;

  return !options.lib.some((libPath) => path.basename(libPath).toLowerCase() === 'lib.dom.d.ts');
}

class LanguageServiceHost implements ts.LanguageServiceHost {
  private files = new Map<string, FileEntry>();
  private rootFiles: string[];
  private options: ts.CompilerOptions;
  private projectRoot: string;
  private bundledFallback: BundledToolchainFallback;

  constructor(
    projectRoot: string,
    options: ts.CompilerOptions,
    rootFiles: string[],
    bundledFallback: BundledToolchainFallback,
  ) {
    this.projectRoot = projectRoot;
    this.options = options;
    this.rootFiles = [...new Set(rootFiles)];
    this.bundledFallback = bundledFallback;

    // @lynx-js/types@3.8 declares the timer functions outside declare global
    // and exports Console without declaring the global console variable. Keep
    // Lynx projects free of DOM types while making the runtime globals visible.
    if (needsLynxGlobalsWorkaround(options)) {
      this.files.set(path.join(projectRoot, LYNX_GLOBALS_WORKAROUND_FILE), {
        version: 0,
        content: LYNX_GLOBALS_WORKAROUND_SOURCE,
      });
    }
  }

  updateFile(filePath: string, content: string, version: number) {
    this.files.set(filePath, { version, content });
  }

  setRootFiles(rootFiles: string[]): void {
    this.rootFiles = [...new Set(rootFiles)];
  }

  getScriptFileNames(): string[] {
    return [...new Set([...this.rootFiles, ...this.files.keys()])];
  }

  getScriptVersion(fileName: string): string {
    return String(this.files.get(fileName)?.version ?? 0);
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    const entry = this.files.get(fileName);
    if (entry) return ts.ScriptSnapshot.fromString(entry.content);
    if (ts.sys.fileExists(fileName)) {
      const text = ts.sys.readFile(fileName);
      if (text !== undefined) return ts.ScriptSnapshot.fromString(text);
    }
    return undefined;
  }

  getCurrentDirectory(): string {
    return this.projectRoot;
  }

  getCompilationSettings(): ts.CompilerOptions {
    return this.options;
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return ts.getDefaultLibFilePath(options);
  }

  fileExists(path: string): boolean {
    if (this.files.has(path)) return true;
    return ts.sys.fileExists(path);
  }

  readFile(path: string): string | undefined {
    const entry = this.files.get(path);
    if (entry) return entry.content;
    return ts.sys.readFile(path);
  }

  readDirectory(
    path: string, extensions?: readonly string[],
    exclude?: readonly string[], include?: readonly string[], depth?: number,
  ): string[] {
    return ts.sys.readDirectory(path, extensions, exclude, include, depth);
  }

  directoryExists(dirPath: string): boolean {
    return ts.sys.directoryExists(dirPath);
  }

  getDirectories(dirPath: string): string[] {
    return ts.sys.getDirectories(dirPath);
  }

  resolveModuleNames(moduleNames: string[], containingFile: string): Array<ts.ResolvedModule | undefined> {
    return moduleNames.map((moduleName) => {
      const resolved = ts.resolveModuleName(moduleName, containingFile, this.options, this).resolvedModule;
      const fallbackPath = this.bundledFallback.moduleEntries.get(moduleName);
      if (shouldUseBundledModuleFallback(resolved, fallbackPath)) {
        return {
          resolvedFileName: fallbackPath,
          extension: ts.Extension.Dts,
          isExternalLibraryImport: true,
        };
      }
      if (resolved) return resolved;
      if (!fallbackPath || !ts.sys.fileExists(fallbackPath)) return undefined;

      return {
        resolvedFileName: fallbackPath,
        extension: ts.Extension.Dts,
        isExternalLibraryImport: true,
      };
    });
  }

  resolveTypeReferenceDirectives(
    typeReferenceDirectiveNames: string[] | readonly ts.FileReference[],
    containingFile: string,
  ): Array<ts.ResolvedTypeReferenceDirective | undefined> {
    return typeReferenceDirectiveNames.map((directive) => {
      const typeName = typeof directive === 'string' ? directive : directive.fileName;
      const resolved = ts.resolveTypeReferenceDirective(typeName, containingFile, this.options, this)
        .resolvedTypeReferenceDirective;
      if (resolved) return resolved;

      const fallbackPath = this.bundledFallback.typeEntries.get(typeName);
      if (!fallbackPath || !ts.sys.fileExists(fallbackPath)) return undefined;

      return {
        primary: true,
        resolvedFileName: fallbackPath,
        isExternalLibraryImport: true,
        packageId: {
          name: typeName,
          subModuleName: path.relative(path.dirname(fallbackPath), fallbackPath),
          version: '0',
        },
      };
    });
  }
}

function defaultCompilerOptions(): ts.CompilerOptions {
  // Default options — permissive enough to work for most projects
  return {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    // Standalone/Fiddle JavaScript has no tsconfig. Enable semantic checking
    // there so unresolved names such as `asdf` surface as diagnostics; an
    // applicable project tsconfig still remains authoritative.
    checkJs: true,
    strict: false,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
  };
}

function uniquePaths(paths: readonly string[] | undefined): string[] {
  return [...new Set(paths ?? [])];
}

function canResolveNodeTypes(projectRoot: string, options: ts.CompilerOptions): boolean {
  const resolved = ts.resolveTypeReferenceDirective(
    'node',
    path.join(projectRoot, '__types__.ts'),
    options,
    ts.sys,
  );
  return resolved.resolvedTypeReferenceDirective !== undefined;
}

function findWorkspaceNodeTypesRoot(projectRoot: string): string | null {
  let current = projectRoot;

  while (true) {
    const pnpmRoot = path.join(current, 'node_modules/.pnpm');
    if (ts.sys.directoryExists(pnpmRoot)) {
      const matches = ts.sys.getDirectories(pnpmRoot)
        .map((dir) => (path.isAbsolute(dir) ? dir : path.join(pnpmRoot, dir)))
        .filter((dir) => path.basename(dir).startsWith('@types+node@'))
        .sort(sortByPathName)
        .reverse();

      for (const dir of matches) {
        const typeRoot = path.join(dir, 'node_modules/@types');
        if (ts.sys.directoryExists(path.join(typeRoot, 'node'))) {
          return typeRoot;
        }
      }
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function withWorkspaceTypeRoots(projectRoot: string, options: ts.CompilerOptions): ts.CompilerOptions {
  if (!options.types?.includes('node')) return options;
  if (canResolveNodeTypes(projectRoot, options)) return options;

  const discoveredTypeRoot = findWorkspaceNodeTypesRoot(projectRoot);
  if (!discoveredTypeRoot) return options;

  const typeRoots = uniquePaths([...uniquePaths(options.typeRoots), discoveredTypeRoot]);
  const nextOptions = { ...options, typeRoots };

  return canResolveNodeTypes(projectRoot, nextOptions) ? nextOptions : options;
}

function parseProjectConfig(configPath: string): ts.ParsedCommandLine | null {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
  );

  return parsed && !parsed.errors.length ? parsed : null;
}

function parsedConfigIncludesFile(parsed: ts.ParsedCommandLine, filePath: string): boolean {
  const targetPath = path.resolve(filePath);
  return parsed.fileNames.some((candidate) => path.resolve(candidate) === targetPath);
}

function findApplicableConfigPath(filePath: string): string | null {
  const configNames = TOOLING_CONFIG_FILES.has(path.basename(filePath))
    ? ['tsconfig.tools.json', 'tsconfig.json']
    : ['tsconfig.json', 'tsconfig.tools.json'];
  const seen = new Set<string>();
  let current = path.dirname(path.resolve(filePath));

  while (true) {
    for (const configName of configNames) {
      const configPath = path.join(current, configName);
      if (seen.has(configPath) || !ts.sys.fileExists(configPath)) continue;
      seen.add(configPath);

      const parsed = parseProjectConfig(configPath);
      if (parsed && parsedConfigIncludesFile(parsed, filePath)) {
        return configPath;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function loadProjectConfig(filePath: string): ProjectConfig {
  const configPath = findApplicableConfigPath(filePath);

  if (configPath) {
    const parsed = parseProjectConfig(configPath);

    if (parsed) {
      const projectRoot = path.dirname(configPath);
      return {
        key: configPath,
        projectRoot,
        options: withWorkspaceTypeRoots(projectRoot, parsed.options),
        rootFiles: parsed.fileNames,
      };
    }
  }

  return {
    key: path.dirname(filePath),
    projectRoot: path.dirname(filePath),
    options: defaultCompilerOptions(),
    rootFiles: [filePath],
  };
}

function tsDiagnosticToMarker(
  diag: ts.Diagnostic,
  sourceFile: ts.SourceFile,
  source: string,
): DiagnosticMarker | null {
  if (diag.start === undefined || diag.length === undefined) return null;

  const start = sourceFile.getLineAndCharacterOfPosition(diag.start);
  const end = sourceFile.getLineAndCharacterOfPosition(diag.start + diag.length);

  const severity =
    diag.category === ts.DiagnosticCategory.Error   ? 'error'   :
    diag.category === ts.DiagnosticCategory.Warning ? 'warning' : 'info';

  return {
    startLine: start.line,
    startChar: start.character,
    endLine: end.line,
    endChar: end.character,
    severity,
    message: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
    source,
    code: diag.code,
  };
}

export class TypeScriptLanguageService {
  // One LanguageService instance per tsconfig root (keyed by config path or project root)
  private instances = new Map<string, {
    host: LanguageServiceHost;
    service: ts.LanguageService;
  }>();

  private getOrCreateInstance(filePath: string): { host: LanguageServiceHost; service: ts.LanguageService } {
    const project = loadProjectConfig(filePath);

    if (!this.instances.has(project.key)) {
      const host = new LanguageServiceHost(
        project.projectRoot,
        project.options,
        project.rootFiles,
        resolveBundledToolchainFallback(),
      );
      const service = ts.createLanguageService(host);
      this.instances.set(project.key, { host, service });
    }

    const instance = this.instances.get(project.key)!;
    instance.host.setRootFiles(project.rootFiles);
    return instance;
  }

  updateFile(filePath: string, content: string, version: number): void {
    const { host } = this.getOrCreateInstance(filePath);
    host.updateFile(filePath, content, version);
  }

  getDiagnostics(filePath: string): DiagnosticMarker[] {
    const { service } = this.getOrCreateInstance(filePath);

    let rawDiags: ts.Diagnostic[];
    try {
      rawDiags = [
        ...service.getSyntacticDiagnostics(filePath),
        ...service.getSemanticDiagnostics(filePath),
      ];
    } catch (_) {
      return [];
    }

    const program = service.getProgram();
    const sourceFile = program?.getSourceFile(filePath);
    if (!sourceFile) return [];

    const source = filePath.endsWith('.js') || filePath.endsWith('.jsx')
      ? 'javascript' : 'typescript';

    return rawDiags
      .map(d => tsDiagnosticToMarker(d, sourceFile, source))
      .filter((m): m is DiagnosticMarker => m !== null);
  }
}
