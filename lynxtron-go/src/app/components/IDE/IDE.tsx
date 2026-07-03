import type { Tab, TreeNode } from '../../store';
import { ActivityBar } from '../../components/Layout/ActivityBar';
import { BottomPanel } from '../../components/Layout/BottomPanel';
import { EditorPanel } from '../../components/Editor/EditorPanel';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { SplitContainer } from '../../components/Layout/SplitContainer';
import { TabBar } from '../../components/TabBar/TabBar';
import { SearchPanel } from '../../components/Search/SearchPanel';

export interface IDEProps {
  rootPath: string;
  tabs: Tab[];
  activeTabId: string | null;
  sidebarPanel: string;
  sidebarRatio: number;
  editorBottomRatio: number;
  bottomPanelOpen: boolean;
  bottomPanelTab?: string;
  dirContents: Map<string, TreeNode[]>;
  expandedDirs: Set<string>;
  onSelectSidebarPanel: (id: string) => void;
  onSidebarRatioChange: (ratio: number) => void;
  onEditorBottomRatioChange: (ratio: number) => void;
  onCloseBottomPanel: () => void;
  onToggleDir: (dirPath: string) => void;
  onOpenFile: (fullPath: string) => void;
  onOpenFileAt: (fullPath: string, options: { line: number; column: number; selectLength: number }) => void;
  onOpenFolderDialog: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  findBar?: any;
}

export function IDE(props: IDEProps) {
  const activeTab = props.tabs.find(t => t.id === props.activeTabId) || null;

  const sidebarContent = props.sidebarPanel === 'explorer' ? (
    <Sidebar
      rootPath={props.rootPath}
      dirContents={props.dirContents}
      expandedDirs={props.expandedDirs}
      activeFilePath={activeTab?.fullPath || null}
      onToggleDir={props.onToggleDir}
      onOpenFile={props.onOpenFile}
      onOpenFolderDialog={props.onOpenFolderDialog}
    />
  ) : props.sidebarPanel === 'search' ? (
    <SearchPanel rootPath={props.rootPath} onOpenFileAt={props.onOpenFileAt} />
  ) : (
    <view className="PanelPlaceholder">
      <text className="PanelPlaceholderText">Coming soon</text>
    </view>
  );

  return (
    <view className="IDEBody">
      <ActivityBar activePanelId={props.sidebarPanel} onSelect={props.onSelectSidebarPanel} />

      <SplitContainer
        direction="horizontal"
        initialRatio={props.sidebarRatio}
        minSizePx={120}
        onRatioChange={props.onSidebarRatioChange}
      >
        {sidebarContent}

        <view className="MainArea">
          <TabBar
            tabs={props.tabs}
            activeTabId={props.activeTabId}
            onSwitchTab={props.onSwitchTab}
            onCloseTab={props.onCloseTab}
          />

          <view className="EditorArea">
            {props.findBar}
            <SplitContainer
              direction="vertical"
              initialRatio={props.editorBottomRatio}
              minSizePx={80}
              collapsed={!props.bottomPanelOpen}
              onRatioChange={props.onEditorBottomRatioChange}
            >
              <EditorPanel activeTabId={props.activeTabId} />
              <BottomPanel
                onClose={props.onCloseBottomPanel}
                rootPath={props.rootPath || undefined}
                activeTabOverride={props.bottomPanelTab}
              />
            </SplitContainer>
          </view>
        </view>
      </SplitContainer>
    </view>
  );
}
