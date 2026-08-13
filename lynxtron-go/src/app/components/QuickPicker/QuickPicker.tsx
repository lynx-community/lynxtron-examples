import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';
import './QuickPicker.css';
import { PlatformOverlay } from '../shared/PlatformOverlay';
import { fileIcon, type TreeNode, type ShowcaseEntry, SHOWCASE_REGISTRY } from '../../store';
import { filterCommands } from '../../commands/registry';
import { valueFromPasteEvent } from './paste';

type PickerMode = 'files' | 'commands' | 'showcases' | 'url' | 'example' | 'bundleUrl';

const PLACEHOLDER: Record<PickerMode, string> = {
  files: 'Search files (type > for commands)…',
  commands: 'Type a command…',
  showcases: 'Filter showcases…',
  url: 'Paste showcase URL and press Enter…',
  bundleUrl: 'Paste Lynx bundle URL and press Enter…',
  example: 'Enter example id or relative path…',
};

/**
 * Path shown under a file row. The Fiddle surface has no workspace root and
 * its rows already carry relative ids, so guard the prefix strip: `replace`
 * with a plain string replaces the FIRST match anywhere, and an empty root
 * turned "src/app/App.tsx" into "srcapp/App.tsx".
 */
function relativeTo(rootPath: string, fullPath: string): string {
  if (!rootPath) return fullPath;
  const prefix = rootPath.replace(/\/+$/, '') + '/';
  return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;
}

/** One activatable row, flattened across modes so the keyboard sees one list. */
interface PickerRow {
  key: string;
  activate: () => void;
}

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

  // The free-text modes (url / bundleUrl / example) have no rows — Enter submits
  // whatever was typed, so the arrows have nothing to walk.
  const rows: PickerRow[] =
    mode === 'commands' ? commands.map(c => ({ key: c.id, activate: () => c.execute() }))
    : mode === 'showcases' ? showcases.map(s => ({ key: s.name, activate: () => onSelectShowcase?.(s) }))
    : mode === 'files' ? filteredFiles.map(f => ({ key: f.fullPath, activate: () => onSelect(f.fullPath) }))
    : [];

  /**
   * Track the highlighted row by its key rather than its index, the way cmdk
   * tracks a value: as the query narrows the list, the same row stays selected
   * instead of the highlight sliding onto whatever now occupies that position.
   */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeIndex = Math.max(0, rows.findIndex(r => r.key === activeKey));
  const activeRowKey = rows.length ? rows[activeIndex].key : null;

  const move = useCallback((delta: number) => {
    if (!rows.length) return;
    // Wrap around, like cmdk's `loop`: past the last row, Down returns to the first.
    const next = (activeIndex + delta + rows.length) % rows.length;
    setActiveKey(rows[next].key);
  }, [rows, activeIndex]);

  const handleConfirm = useCallback(() => {
    if (mode === 'url' || mode === 'bundleUrl' || mode === 'example') {
      onSelect(query);
      return;
    }
    // Activate what is highlighted, rather than blindly the first row.
    if (rows.length) rows[activeIndex].activate();
  }, [mode, query, onSelect, rows, activeIndex]);

  const handlePaste = useCallback((event: any) => {
    const nextValue = valueFromPasteEvent(query, event);
    if (nextValue !== null) onQueryChange(nextValue);
  }, [query, onQueryChange]);
  // Lynxtron's native event exists ahead of @lynx-js/types' InputProps entry.
  const nativePasteProps = { bindpaste: handlePaste } as any;

  /**
   * Lynx `<input>` exposes only blur/confirm/focus/input/selection, so the
   * arrows cannot be read off the field itself. `global-bindkeydown` fires
   * regardless of which node holds focus, which is exactly what a palette needs
   * while its query field is focused. It is bound on the overlay, which only
   * exists while the palette is open.
   */
  const handleKeyDown = useCallback((e: any) => {
    const key = String(e?.key ?? e?.detail?.key ?? '');
    if (key === 'ArrowDown') move(1);
    else if (key === 'ArrowUp') move(-1);
    else if (key === 'Home') { if (rows.length) setActiveKey(rows[0].key); }
    else if (key === 'End') { if (rows.length) setActiveKey(rows[rows.length - 1].key); }
    else if (key === 'Escape') onClose();
    else if (key === 'Enter') handleConfirm();
  }, [move, rows, onClose, handleConfirm]);

  // When the selected row filters out (or the mode changes), fall back to the
  // first row so Enter always has a defined target. Declared after the
  // callbacks above: Lynx's TDZ is strict about effects referencing them.
  useEffect(() => {
    if (!rows.length) {
      if (activeKey !== null) setActiveKey(null);
    } else if (!rows.some(r => r.key === activeKey)) {
      setActiveKey(rows[0].key);
    }
  }, [rows, activeKey]);

  /**
   * Focus the query the moment the palette opens.
   *
   * A palette you have to click into has not opened — every keystroke of the
   * thing you came to type goes nowhere. Lynx has no autofocus attribute, so
   * this is the element's `focus` method through the selector query.
   *
   * It retries, and it stops on `bindfocus` rather than on the invoke's own
   * success callback, because that callback reports OK whether or not focus
   * landed: invoking `focus` — and `setFocus` — on a palette that was
   * demonstrably not focused returned success both times. The only honest
   * signal that the field has focus is the field saying so.
   */
  const focusedRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const onFieldFocus = useCallback(() => {
    focusedRef.current = true;
    setFocused(true);
  }, []);

  useEffect(() => {
    let tries = 0;
    let timer: any = null;
    const attempt = () => {
      if (focusedRef.current) return;
      // ~1s of trying, then stop. The field stays clickable, and a retry loop
      // with no end is worse than a palette you click once.
      if (tries++ > 12) return;
      try {
        // @ts-ignore — SelectorQuery is a runtime global, not in the app types.
        lynx.createSelectorQuery()
          .select('#picker-query')
          .invoke({ method: 'focus', params: {}, success: () => {}, fail: () => {} })
          .exec();
      } catch (_) { /* no query available — the field is still clickable */ }
      timer = setTimeout(attempt, 80);
    };
    attempt();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const rowClass = (key: string, extra?: string) =>
    `PickerItem${extra ? ' ' + extra : ''}${key === activeRowKey ? ' PickerItem--active' : ''}`;

  return (
    <PlatformOverlay priority={400}>
      <view className="PickerOverlay" bindtap={onClose} global-bindkeydown={handleKeyDown}>
        <view className="PickerModal" catchtap={() => {}}>
        <input
          id="picker-query"
          className={'PickerInput' + (focused ? ' PickerInput--focused' : '')}
          value={query}
          bindfocus={onFieldFocus}
          bindinput={(e: any) => onQueryChange(e.detail.value)}
          {...nativePasteProps}
          bindconfirm={handleConfirm}
          placeholder={PLACEHOLDER[mode]}
        />
        {/* Keep the highlighted row visible as the arrows walk past the fold. */}
        <scroll-view className="PickerResults" scroll-y scroll-to-index={activeIndex}>
          {mode === 'showcases' ? (
            showcases.length > 0 ? showcases.map(s => (
              <view
                key={s.name}
                className={rowClass(s.name, 'PickerShowcase')}
                // Hover moves the selection too, so pointer and keyboard never
                // disagree about what Enter would activate.
                bindmouseenter={() => setActiveKey(s.name)}
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
                  <text className="PickerDesc">{s.description}</text>
                  {s.tags.length > 0 && (
                    <text className="PickerTags">{s.tags.join(' · ')}</text>
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
                className={rowClass(cmd.id, 'PickerCommand')}
                bindmouseenter={() => setActiveKey(cmd.id)}
                catchtap={() => cmd.execute()}
              >
                <text className="PickerIcon">{'▶'}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{cmd.label}</text>
                </view>
                {cmd.keybinding && <text className="PickerKeys">{cmd.keybinding}</text>}
              </view>
            ))
          ) : (
            filteredFiles.map(f => (
              <view
                key={f.fullPath}
                className={rowClass(f.fullPath)}
                bindmouseenter={() => setActiveKey(f.fullPath)}
                bindtap={() => onSelect(f.fullPath)}
              >
                <text className="PickerIcon">{fileIcon(f.name)}</text>
                <view className="PickerItemInfo">
                  <text className="PickerFileName">{f.name}</text>
                  {/* Only when it says something the name does not. On the
                      Fiddle surface a file's "path" IS its id, so this printed
                      the name a second time on every row. */}
                  {relativeTo(rootPath, f.fullPath) !== f.name ? (
                    <text className="PickerFilePath" text-maxline="1">
                      {relativeTo(rootPath, f.fullPath)}
                    </text>
                  ) : null}
                </view>
              </view>
            ))
          )}
        </scroll-view>
        {/* The palette's behaviours are otherwise invisible. */}
        <view className="PickerFooter">
          <text className="PickerFooterText">
            {rows.length > 0 ? (
              <text className="PickerFooterText">
                <text className="PickerFooterKey">{'↑↓'}</text> to move
                {'  ·  '}
                <text className="PickerFooterKey">Enter</text> to open
              </text>
            ) : (
              <text className="PickerFooterText">
                <text className="PickerFooterKey">Enter</text> to submit
              </text>
            )}
            {mode === 'files' ? (
              <text className="PickerFooterText">
                {'  ·  '}
                <text className="PickerFooterKey">{'>'}</text> for commands
              </text>
            ) : null}
            {'  ·  '}
            <text className="PickerFooterKey">Esc</text> to close
          </text>
        </view>
        </view>
      </view>
    </PlatformOverlay>
  );
}
