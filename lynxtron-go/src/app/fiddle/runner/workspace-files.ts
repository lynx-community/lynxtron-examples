export interface WorkspaceDirectoryEntry {
  name: string;
  isDirectory: boolean;
}

export interface WorkspaceFileSystem {
  join?: (left: string, right: string) => string;
  readdir?: (dir: string) => string[];
  readdirStat?: (dir: string) => WorkspaceDirectoryEntry[];
  readFile?: (filePath: string) => string | null;
}

export interface WorkspaceTextFile {
  rel: string;
  content: string;
}

const EDITABLE_FILE = /\.(cjs|mjs|js|jsx|ts|tsx|css|scss|less|json|html|md|mdx|txt|xml|svg|ya?ml|toml)$/i;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'output',
  'build',
  '.git',
  '.rspeedy',
  '.turbo',
  '.cache',
  'coverage',
]);
const SKIP_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.tsbuildinfo',
]);
const MAX_WALK_DEPTH = 24;
const MAX_FILE_BYTES = 120 * 1024;

export function isEditableWorkspaceFile(name: string): boolean {
  return EDITABLE_FILE.test(name) && !SKIP_FILES.has(name);
}

function listEntries(fs: WorkspaceFileSystem, dir: string): WorkspaceDirectoryEntry[] {
  if (typeof fs.readdirStat === 'function') {
    try {
      return fs.readdirStat(dir) ?? [];
    } catch (_) {
      return [];
    }
  }

  // Compatibility with older preload bridges that only exposed readdir.
  // Editable-looking names are treated as files; everything else is walked as
  // a possible directory. The current bridge always provides readdirStat.
  try {
    return (fs.readdir?.(dir) ?? []).map(name => ({
      name,
      isDirectory: !isEditableWorkspaceFile(name),
    }));
  } catch (_) {
    return [];
  }
}

/**
 * Collect every editable source/text file in a showcase workspace.
 *
 * Generated output, dependencies, hidden entries, binary files, and oversized
 * text files stay out of the Fiddle. The depth guard protects against symlink
 * cycles; unlike the old two-level/14-file budget, it does not truncate normal
 * showcase source trees such as src/main/desktop.
 */
export function collectWorkspaceTextFiles(
  fs: WorkspaceFileSystem,
  workspaceRoot: string,
): WorkspaceTextFile[] {
  const collected: WorkspaceTextFile[] = [];
  const visited = new Set<string>();

  const walk = (dir: string, relPrefix: string, depth: number) => {
    if (depth > MAX_WALK_DEPTH || visited.has(dir)) return;
    visited.add(dir);

    const entries = listEntries(fs, dir)
      .filter(entry => entry?.name && !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(entry => !entry.isDirectory);
    const directories = entries.filter(entry => entry.isDirectory);

    for (const entry of files) {
      if (!isEditableWorkspaceFile(entry.name)) continue;
      const path = fs.join?.(dir, entry.name) ?? `${dir}/${entry.name}`;
      try {
        const content = fs.readFile?.(path);
        if (typeof content !== 'string' || content.length > MAX_FILE_BYTES) continue;
        collected.push({ rel: relPrefix + entry.name, content });
      } catch (_) {}
    }

    for (const entry of directories) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const path = fs.join?.(dir, entry.name) ?? `${dir}/${entry.name}`;
      walk(path, `${relPrefix}${entry.name}/`, depth + 1);
    }
  };

  walk(workspaceRoot, '', 0);
  return collected;
}
