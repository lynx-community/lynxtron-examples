import './QuickPicker.css';
import { fileIcon, type TreeNode, type ShowcaseEntry, SHOWCASE_REGISTRY } from '../../store';
import { filterCommands, type Command } from '../../commands/registry';

type PickerMode = 'files' | 'commands' | 'showcases' | 'url' | 'example' | 'bundleUrl';

interface QuickPickerProps {
  rootPath: string;
  query: string;
  filteredFiles: TreeNode[];
  mode?: PickerMode;
  onQueryChange: (value: string) => void;
  onSelect: (fullPath: string) => void;
  onSelectShowcase?: (entry: ShowcaseEntry) => void;
  onClose: () => void;
}

export function QuickPicker({
  rootPath, query, filteredFiles, mode: modeOverride,
  onQueryChange, onSelect, onSelectShowcase, onClose,
}: QuickPickerProps) {
  // Determine mode: override > query prefix > default
  const mode: PickerMode = modeOverride
    || (query.startsWith('>') ? 'commands' : 'files');

  const commandQuery = mode === 'commands' ? query.slice(1).trim() : '';
  const commands = mode === 'commands' ? filterCommands(commandQuery) : [];

  // Filter showcases by query
  const showcaseQuery = mode === 'showcases' ? query.toLowerCase() : '';
  const showcases = mode === 'showcases'
    ? SHOWCASE_REGISTRY.filter(s =>
        s.name.toLowerCase().includes(showcaseQuery) ||
        s.description.toLowerCase().includes(showcaseQuery) ||
        s.tags.some(t => t.toLowerCase().includes(showcaseQuery))
      )
    : [];

  const handleCommandSelect = (cmd: Command) => {
    cmd.execute();
  };

  const handleConfirm = () => {
    if (mode === 'url') {
      onSelect(query);
    } else if (mode === 'bundleUrl') {
      onSelect(query);
    } else if (mode === 'example') {
      onSelect(query);
    } else if (mode === 'commands' && commands.length > 0) {
      handleCommandSelect(commands[0]);
    } else if (mode === 'showcases' && showcases.length > 0 && onSelectShowcase) {
      onSelectShowcase(showcases[0]);
    } else if (mode === 'files' && filteredFiles.length > 0) {
      onSelect(filteredFiles[0].fullPath);
    }
  };

  const placeholder: Record<PickerMode, string> = {
    files: 'Search files (type > for commands)\u2026',
    commands: 'Type a command\u2026',
    showcases: 'Filter showcases\u2026',
    url: 'Paste showcase URL and press Enter\u2026',
    bundleUrl: 'Paste Lynx bundle URL and press Enter\u2026',
    example: 'Enter example id or relative path\u2026',
  };

  return (
    <view className="PickerOverlay" bindtap={onClose}>
      <view className="PickerModal" catchtap={() => {}}>
        <input
          className="PickerInput"
          value={query}
          bindinput={(e: any) => onQueryChange(e.detail.value)}
          bindconfirm={handleConfirm}
          placeholder={placeholder[mode]}
        />
        <scroll-view className="PickerResults" scroll-y>
          {mode === 'showcases' ? (
            showcases.length > 0 ? showcases.map(s => (
              <view
                key={s.name}
                className="PickerItem PickerShowcase"
                catchtap={() => onSelectShowcase?.(s)}
              >
                <text className="PickerIcon">{'\u{1F4E6}'}</text>
                <view className="PickerItemInfo">
                  <view className="PickerShowcaseHeader">
                    <text className="PickerFileName">{s.name}</text>
                    {s.url.startsWith('file://') && (
                      <text className="PickerBadge">LOCAL</text>
                    )}
                  </view>
                  <text className="PickerFilePath">{s.description}</text>
                  {s.tags.length > 0 && (
                    <text className="PickerTags">{s.tags.join(' \u00B7 ')}</text>
                  )}
                </view>
              </view>
            )) : (
              <view className="PickerHint">
                <text className="PickerHintText">No showcases found.</text>
              </view>
            )
          ) : mode === 'url' ? (
            <view className="PickerHint">
              <text className="PickerHintText">
                Enter a GitHub URL like: https://github.com/user/repo/tree/main/showcases/name
              </text>
            </view>
          ) : mode === 'bundleUrl' ? (
            <view className="PickerHint">
              <text className="PickerHintText">
                Enter a remote Lynx bundle URL like: http://host/path/main.lynx.bundle
              </text>
            </view>
          ) : mode === 'example' ? (
            <view className="PickerHint">
              <text className="PickerHintText">
                Enter an example id or relative path like: view or nested/example
              </text>
            </view>
          ) : mode === 'commands' ? (
            commands.map(cmd => (
              <view
                key={cmd.id}
                className="PickerItem PickerCommand"
                catchtap={() => handleCommandSelect(cmd)}
              >
                <text className="PickerIcon">{'\u25B6'}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{cmd.label}</text>
                  {cmd.keybinding && (
                    <text className="PickerFilePath">{cmd.keybinding}</text>
                  )}
                </view>
              </view>
            ))
          ) : (
            filteredFiles.map(f => (
              <view
                key={f.fullPath}
                className="PickerItem"
                bindtap={() => onSelect(f.fullPath)}
              >
                <text className="PickerIcon">{fileIcon(f.name)}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{f.name}</text>
                  <text className="PickerFilePath">
                    {f.fullPath.replace(rootPath + '/', '')}
                  </text>
                </view>
              </view>
            ))
          )}
        </scroll-view>
      </view>
    </view>
  );
}
