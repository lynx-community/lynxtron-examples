import { useState, useRef, useCallback } from '@lynx-js/react';
import { Button, Icon, InputGroup, AppToaster } from '../bp';
import { isSafeRelativePath } from '../state/FiddleState';
import { searchNpm, parseDependencies, addDependency, removeDependency, type NpmSearchResult } from './npm-search';
import { DEFAULT_EDITORS } from '../types';
import type { FiddleFile } from '../state/FiddleState';
import './FiddleSidebar.css';

// Upstream sidebar-file-tree validation: supported editor extensions only,
// package.json is reserved.
const VALID_EXT = /\.(cjs|js|mjs|html|css|json|jsx|ts|tsx)$/;

export function validateNewFileName(name: string, existing: string[]): string | null {
  if (!isSafeRelativePath(name)) return 'Path must stay inside the fiddle';
  if (!VALID_EXT.test(name)) return 'Unsupported file extension';
  if (name === 'package.json') return 'package.json is reserved';
  if (existing.includes(name)) return 'File already exists';
  return null;
}

export interface FiddleSidebarProps {
  rootPath: string | null;
  files: Map<string, FiddleFile>;
  activeEditorId: string | null;
  onSelectEditor: (id: string) => void;
  onToggleEditor: (id: string) => void;
  onResetLayout: () => void;
  onAddFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onRenameFile: (oldId: string, newId: string) => void;
  onSetFileContent: (id: string, content: string) => void;
}

/**
 * Upstream sidebar-file-tree.tsx: an "Editors" folder header with Add-file
 * and Reset-Layout buttons, one row per file (lexicographic) with a document
 * icon, filename, eye visibility toggle plus rename/delete actions, and a
 * Modules section backed by npm search.
 */
export function FiddleSidebar(props: FiddleSidebarProps) {
  const editors = Array.from(props.files.values()).sort((a, b) => a.id.localeCompare(b.id));
  const [moduleQuery, setModuleQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NpmSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  // Add AND rename are INLINE input rows in the tree (no modal, no overlay) —
  // the native editors never need to detach for either flow.
  const [addingName, setAddingName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const addError = addingName && addingName.trim()
    ? validateNewFileName(addingName.trim(), editors.map(e => e.id))
    : null;
  const renameError = renaming && renaming.name.trim() && renaming.name.trim() !== renaming.id
    ? validateNewFileName(renaming.name.trim(), editors.map(e => e.id))
    : null;
  const commitAdd = useCallback((raw: string) => {
    const name = raw.trim();
    if (!name) { setAddingName(null); return; }
    if (validateNewFileName(name, editors.map(e => e.id))) return; // keep row open, error shown
    props.onAddFile(name);
    setAddingName(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editors.map(e => e.id).join('|'), props.onAddFile]);
  const commitRename = useCallback((raw: string) => {
    if (!renaming) return;
    const name = raw.trim();
    if (!name || name === renaming.id) { setRenaming(null); return; } // unchanged → cancel
    if (validateNewFileName(name, editors.map(e => e.id))) return; // keep row open, error shown
    props.onRenameFile(renaming.id, name);
    setRenaming(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming, editors.map(e => e.id).join('|'), props.onRenameFile]);

  const packageJson = props.files.get(DEFAULT_EDITORS.PACKAGE)?.currentText ?? '';
  const installed = parseDependencies(packageJson);
  const installedNames = Object.keys(installed).sort();

  const runSearch = useCallback((q: string) => {
    setModuleQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const trimmed = q.trim();
    if (!trimmed) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      searchNpm(trimmed)
        .then(results => { setSearchResults(results); setSearching(false); })
        .catch(() => { setSearchResults([]); setSearching(false); });
    }, 300);
  }, []);

  const handleAddModule = useCallback((r: NpmSearchResult) => {
    const next = addDependency(packageJson, r.name, r.version);
    if (!next) {
      AppToaster.show({ message: 'package.json is not valid JSON', intent: 'danger', icon: 'error' });
      return;
    }
    props.onSetFileContent(DEFAULT_EDITORS.PACKAGE, next);
    setModuleQuery('');
    setSearchResults([]);
    AppToaster.show({ message: `Added ${r.name}@^${r.version}`, intent: 'success', icon: 'tick' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageJson, props.onSetFileContent]);

  const handleRemoveModule = useCallback((name: string) => {
    const next = removeDependency(packageJson, name);
    if (next) props.onSetFileContent(DEFAULT_EDITORS.PACKAGE, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageJson, props.onSetFileContent]);

  return (
    <view className="FiddleSidebar">
      <view className="FiddleSidebar-Section">
        <view className="FiddleSidebar-SectionHeader">
          <view className="FiddleSidebar-SectionTitleRow">
            <Icon icon="folder-open" size={14} className="FiddleSidebar-FolderIcon" />
            <text className="FiddleSidebar-SectionTitle">Editors</text>
          </view>
          <view className="FiddleSidebar-SectionActions">
            <Button icon="add" small minimal title="Add New File" onClick={() => setAddingName('')} />
            <Button icon="grid-view" small minimal title="Reset Layout" onClick={props.onResetLayout} />
          </view>
        </view>
      </view>
      <scroll-view className="FiddleSidebar-List" scroll-orientation="vertical">
        {editors.map(f => {
          const isActive = f.id === props.activeEditorId;
          const canDelete = f.id !== DEFAULT_EDITORS.MAIN && f.id !== DEFAULT_EDITORS.PACKAGE;
          const cls = 'FiddleSidebar-Item'
            + (isActive ? ' FiddleSidebar-Item--active' : '')
            + (f.isDirty ? ' FiddleSidebar-Item--dirty' : '');
          if (renaming?.id === f.id) {
            return (
              <view key={f.id} className="FiddleSidebar-AddRow">
                <view className="FiddleSidebar-AddRowInput">
                  <Icon icon="document" size={14} className="FiddleSidebar-ItemIcon" />
                  <InputGroup
                    fill
                    placeholder={f.id}
                    value={renaming.name}
                    onChange={(v) => setRenaming(r => (r ? { ...r, name: v } : r))}
                    onSubmit={commitRename}
                  />
                  <view className="FiddleSidebar-EyeBtn" catchtap={() => commitRename(renaming.name)}>
                    <Icon icon="tick" size={14} color="#9feafa" />
                  </view>
                  <view className="FiddleSidebar-EyeBtn" catchtap={() => setRenaming(null)}>
                    <Icon icon="cross" size={14} color="#a7b6c2" />
                  </view>
                </view>
                {renameError ? (
                  <text className="FiddleSidebar-AddRowError">{renameError}</text>
                ) : null}
              </view>
            );
          }
          return (
            <view
              key={f.id}
              className={cls}
              bindtap={() => props.onSelectEditor(f.id)}
            >
              <Icon icon="document" size={14} className="FiddleSidebar-ItemIcon" />
              <view className="FiddleSidebar-ItemLabel">
                <text className="FiddleSidebar-ItemName" text-maxline="1">{f.id}</text>
              </view>
              {f.isDirty ? <text className="FiddleSidebar-Dot">●</text> : null}
              {/* rename/delete only on the active row — upstream uses a
                  right-click context menu, which Lynx doesn't deliver, and
                  CSS :hover display-flips leave stale paint behind (icons
                  ghost over the eye toggle after unhover) */}
              <view className="FiddleSidebar-RowActions">
                {isActive ? (
                  <view className="FiddleSidebar-ActiveActions">
                    {f.id !== DEFAULT_EDITORS.PACKAGE ? (
                      <view
                        className="FiddleSidebar-EyeBtn"
                        catchtap={() => setRenaming({ id: f.id, name: f.id })}
                      >
                        <Icon icon="edit" size={12} color="#8ac7d6" />
                      </view>
                    ) : null}
                    {canDelete ? (
                      <view
                        className="FiddleSidebar-EyeBtn"
                        catchtap={() => props.onRemoveFile(f.id)}
                      >
                        <Icon icon="trash" size={12} color="#df3434" />
                      </view>
                    ) : null}
                  </view>
                ) : null}
                <view
                  className="FiddleSidebar-EyeBtn"
                  catchtap={() => props.onToggleEditor(f.id)}
                >
                  <Icon
                    icon={f.visible ? 'eye-open' : 'eye-off'}
                    size={14}
                    color={f.visible ? '#dcdcdc' : '#5c5f71'}
                  />
                </view>
              </view>
            </view>
          );
        })}
        {addingName != null ? (
          <view className="FiddleSidebar-AddRow">
            <view className="FiddleSidebar-AddRowInput">
              <Icon icon="document" size={14} className="FiddleSidebar-ItemIcon" />
              <InputGroup
                fill
                placeholder="file.js"
                value={addingName}
                onChange={setAddingName}
                onSubmit={commitAdd}
              />
              <view className="FiddleSidebar-EyeBtn" catchtap={() => commitAdd(addingName)}>
                <Icon icon="tick" size={14} color="#9feafa" />
              </view>
              <view className="FiddleSidebar-EyeBtn" catchtap={() => setAddingName(null)}>
                <Icon icon="cross" size={14} color="#a7b6c2" />
              </view>
            </view>
            {addError ? (
              <text className="FiddleSidebar-AddRowError">{addError}</text>
            ) : null}
          </view>
        ) : null}
      </scroll-view>
      <view className="FiddleSidebar-Section FiddleSidebar-Section--modules">
        <view className="FiddleSidebar-SectionHeader">
          <text className="FiddleSidebar-SectionTitle">Modules</text>
          <text className="FiddleSidebar-Count">{String(installedNames.length)}</text>
        </view>
        <view className="FiddleSidebar-ModuleSearch">
          <InputGroup
            fill
            placeholder="Search npm modules"
            leftIcon="search"
            value={moduleQuery}
            onChange={runSearch}
          />
        </view>
        {searchResults.length > 0 ? (
          <view className="FiddleSidebar-ModuleResults">
            {searchResults.map(r => (
              <view key={r.name} className="FiddleSidebar-ModuleRow" bindtap={() => handleAddModule(r)}>
                <view className="FiddleSidebar-ModuleLabel">
                  <text className="FiddleSidebar-ModuleName" text-maxline="1">{r.name}</text>
                  <text className="FiddleSidebar-ModuleVersion">{r.version}</text>
                </view>
                <Icon icon="add" size={12} color="#9feafa" />
              </view>
            ))}
          </view>
        ) : null}
        {installedNames.length > 0 ? (
          <view className="FiddleSidebar-ModuleResults">
            {installedNames.map(name => (
              <view key={name} className="FiddleSidebar-ModuleRow">
                <view className="FiddleSidebar-ModuleLabel">
                  <text className="FiddleSidebar-ModuleName" text-maxline="1">{name}</text>
                  <text className="FiddleSidebar-ModuleVersion">{installed[name]}</text>
                </view>
                <view catchtap={() => handleRemoveModule(name)}>
                  <Icon icon="cross" size={12} color="#a7b6c2" />
                </view>
              </view>
            ))}
          </view>
        ) : (
          <view className="FiddleSidebar-EmptyState">
            <text className="FiddleSidebar-EmptyStateText">
              {searching ? 'Searching…' : moduleQuery ? (searchResults.length ? '' : 'No results.') : 'No modules installed.'}
            </text>
          </view>
        )}
      </view>
    </view>
  );
}
