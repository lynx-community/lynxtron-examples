export interface FileTreeFileNode {
  kind: 'file';
  id: string;
  name: string;
}

export interface FileTreeFolderNode {
  kind: 'folder';
  /** Full path represented by this node, including any compacted segments. */
  path: string;
  /** Display label, for example `src/app`. */
  name: string;
  children: FileTreeNode[];
}

export type FileTreeNode = FileTreeFileNode | FileTreeFolderNode;

interface MutableFolder {
  name: string;
  path: string;
  folders: Map<string, MutableFolder>;
  files: FileTreeFileNode[];
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function compactFolder(initialFolder: MutableFolder): FileTreeFolderNode {
  let folder = initialFolder;
  const names = [folder.name];

  // Match VS Code's compact-folders behaviour: only fold a directory into
  // its sole child when it has no files of its own and no sibling directory.
  while (folder.files.length === 0 && folder.folders.size === 1) {
    folder = Array.from(folder.folders.values())[0];
    names.push(folder.name);
  }

  const children: FileTreeNode[] = [
    ...Array.from(folder.folders.values()).map(compactFolder),
    ...folder.files,
  ];
  children.sort(compareNodes);

  return {
    kind: 'folder',
    path: folder.path,
    name: names.join('/'),
    children,
  };
}

export function buildCompactFileTree(fileIds: string[]): FileTreeNode[] {
  const root: MutableFolder = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  };

  for (const id of fileIds) {
    const parts = id.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let parent = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const name = parts[index];
      let folder = parent.folders.get(name);
      if (!folder) {
        const path = parent.path ? `${parent.path}/${name}` : name;
        folder = { name, path, folders: new Map(), files: [] };
        parent.folders.set(name, folder);
      }
      parent = folder;
    }

    parent.files.push({ kind: 'file', id, name: parts[parts.length - 1] });
  }

  const nodes: FileTreeNode[] = [
    ...Array.from(root.folders.values()).map(compactFolder),
    ...root.files,
  ];
  nodes.sort(compareNodes);
  return nodes;
}
