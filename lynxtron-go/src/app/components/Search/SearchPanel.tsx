import { useState, useCallback } from '@lynx-js/react';
import './SearchPanel.css';
import { getExposed } from '../../store';
import { TreeList, type TreeGroup } from '../shared/TreeList';

interface SearchResult {
  file: string;
  line: number;
  column: number;
  lineText: string;
  matchLength: number;
}

interface SearchPanelProps {
  rootPath: string;
  onOpenFileAt: (file: string, options: { line: number; column: number; selectLength: number }) => void;
}

export function SearchPanel({ rootPath, onOpenFileAt }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');

  const doSearch = useCallback(() => {
    const q = query.trim();
    if (!q || !rootPath) return;
    setSearching(true);
    setSearchedQuery(q);
    setResults([]);
    setTimeout(() => {
      try {
        const hits = getExposed()?.search?.findInFiles(rootPath, q) ?? [];
        setResults(hits);
      } catch (e) {
        setResults([]);
      }
      setSearching(false);
    }, 0);
  }, [query, rootPath]);

  const shortPath = (file: string) => rootPath ? file.replace(rootPath + '/', '') : file;

  // Build TreeList groups from results
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = grouped.get(r.file);
    if (existing) existing.push(r);
    else grouped.set(r.file, [r]);
  }

  const groups: TreeGroup[] = Array.from(grouped.entries()).map(([file, hits]) => ({
    key: file,
    label: shortPath(file),
    badge: String(hits.length),
    children: hits.map((r, i) => ({
      key: `${file}-${i}`,
      label: String(r.line + 1),
      detail: (() => {
        const trimmed = r.lineText.trimStart();
        return trimmed;
      })(),
      detailHighlight: { start: r.column - (r.lineText.length - r.lineText.trimStart().length), length: r.matchLength },
      onTap: () => onOpenFileAt(r.file, { line: r.line, column: r.column, selectLength: r.matchLength }),
    })),
  }));

  return (
    <view className="SearchPanel">
      <view className="SearchHeader">
        <text className="SearchTitle">SEARCH</text>
      </view>

      <view className="SearchInputRow">
        <input
          className="SearchInput"
          value={query}
          placeholder="Search in files\u2026"
          bindinput={(e: any) => setQuery(e.detail.value)}
          bindconfirm={doSearch}
        />
        <view className="SearchBtn" bindtap={doSearch}>
          <text className="SearchBtnText">{'\u{1F50D}'}</text>
        </view>
      </view>

      {searching ? (
        <view className="SearchStatus">
          <text className="SearchStatusText">Searching{'\u2026'}</text>
        </view>
      ) : groups.length > 0 ? (
        <TreeList groups={groups} />
      ) : searchedQuery ? (
        <view className="SearchStatus">
          <text className="SearchStatusText">No results for "{searchedQuery}"</text>
        </view>
      ) : (
        <view className="SearchStatus">
          <text className="SearchStatusText">Type a query and press Enter</text>
        </view>
      )}

      {results.length > 0 && (
        <view className="SearchFooter">
          <text className="SearchFooterText">{results.length} result{results.length !== 1 ? 's' : ''} in {grouped.size} file{grouped.size !== 1 ? 's' : ''}</text>
        </view>
      )}
    </view>
  );
}
