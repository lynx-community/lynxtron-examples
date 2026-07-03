import './Sidebar.css';
import { fileIcon } from '../../store';
import type { TreeNode } from '../../store';

interface SidebarProps {
  rootPath: string;
  dirContents: Map<string, TreeNode[]>;
  expandedDirs: Set<string>;
  activeFilePath: string | null;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (fullPath: string) => void;
  onOpenFolderDialog: () => void;
}

export function Sidebar({
  rootPath, dirContents, expandedDirs, activeFilePath,
  onToggleDir, onOpenFile, onOpenFolderDialog,
}: SidebarProps) {
  const renderNodes = (dirPath: string, depth: number): any[] => {
    const nodes = dirContents.get(dirPath);
    if (!nodes) return [];
    const items: any[] = [];
    for (const node of nodes) {
      const paddingLeft = depth * 16 + 8;
      if (node.isDirectory) {
        const expanded = expandedDirs.has(node.fullPath);
        items.push(
          <view
            key={node.fullPath}
            className="TreeItem DirItem"
            bindtap={() => onToggleDir(node.fullPath)}
            style={`padding-left: ${paddingLeft}px`}
          >
            <text className="TreeArrow">{expanded ? '\u25BC' : '\u25B6'}</text>
            <text className="TreeName DirName">{node.name}</text>
          </view>
        );
        if (expanded) {
          items.push(...renderNodes(node.fullPath, depth + 1));
        }
      } else {
        const isActive = node.fullPath === activeFilePath;
        items.push(
          <view
            key={node.fullPath}
            className={`TreeItem FileItem${isActive ? ' ActiveFile' : ''}`}
            bindtap={() => onOpenFile(node.fullPath)}
            style={`padding-left: ${paddingLeft + 18}px`}
          >
            <text className="TreeIcon">{fileIcon(node.name)}</text>
            <text className="TreeName">{node.name}</text>
          </view>
        );
      }
    }
    return items;
  };

  return (
    <view className="Sidebar">
      <view className="SidebarHeader">
        <text className="SidebarTitle">EXPLORER</text>
        <view className="OpenFolderBtn" bindtap={onOpenFolderDialog}>
          <text className="OpenFolderBtnText">{'\u2295'}</text>
        </view>
      </view>

      {rootPath ? (
        <view className="RootLabel">
          <text className="RootLabelText">
            {rootPath.split('/').pop()?.toUpperCase() || ''}
          </text>
        </view>
      ) : null}

      <scroll-view className="FileTree" scroll-y>
        {rootPath
          ? renderNodes(rootPath, 0)
          : (
            <view className="EmptyTree">
              <text className="EmptyTreeText">Click {'\u2295'} to open a folder</text>
            </view>
          )
        }
      </scroll-view>
    </view>
  );
}
