export interface FileTreeDirectoryRow {
  kind: 'directory';
  path: string;
  name: string;
  depth: number;
  expanded: boolean;
}

export interface FileTreeFileRow {
  kind: 'file';
  path: string;
  name: string;
  depth: number;
}

export type FileTreeRow = FileTreeDirectoryRow | FileTreeFileRow;

interface MutableDirectory {
  name: string;
  path: string;
  directories: Map<string, MutableDirectory>;
  files: Array<{ name: string; path: string }>;
}

function createDirectory(name: string, path: string): MutableDirectory {
  return { name, path, directories: new Map(), files: [] };
}

function compareNames(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

/**
 * Derive a visible directory tree from the Fiddle's path-keyed file map.
 * Directories are implicit in EditorIds, so switching snapshots naturally
 * rebuilds the tree without a second filesystem state model.
 */
export function flattenFileTree(
  filePaths: string[],
  collapsedDirectories: ReadonlySet<string>,
): FileTreeRow[] {
  const root = createDirectory('', '');

  for (const filePath of filePaths) {
    const segments = filePath.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let directory = root;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const name = segments[i];
      const path = directory.path ? `${directory.path}/${name}` : name;
      let child = directory.directories.get(name);
      if (!child) {
        child = createDirectory(name, path);
        directory.directories.set(name, child);
      }
      directory = child;
    }
    directory.files.push({ name: segments[segments.length - 1], path: filePath });
  }

  const rows: FileTreeRow[] = [];
  const append = (directory: MutableDirectory, depth: number) => {
    const directories = [...directory.directories.values()].sort(compareNames);
    const files = [...directory.files].sort(compareNames);

    for (const child of directories) {
      const expanded = !collapsedDirectories.has(child.path);
      rows.push({
        kind: 'directory',
        path: child.path,
        name: child.name,
        depth,
        expanded,
      });
      if (expanded) append(child, depth + 1);
    }
    for (const file of files) {
      rows.push({ kind: 'file', path: file.path, name: file.name, depth });
    }
  };

  append(root, 0);
  return rows;
}
