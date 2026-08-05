import { useCallback, useEffect, useMemo, useRef, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import type {
  AgentEvent,
  AgentTask,
  BackendInfo,
  BridgeResult,
  ChangedFile,
  DiffLine,
  EventSnapshot,
  FileDiff,
  PermissionRequest,
  PlanEntry,
  PreviewTab,
  ReviewSnapshot,
  TimelineEntry,
  TimelineKind,
  TimelinePage,
  ToolItem,
  WorkspaceFilePreview,
  WorkspaceSnapshot,
} from '../shared/agent';
import './App.css';
import { ToolCard } from './components/ToolCard';
import { MarkdownMessage } from './components/MarkdownMessage';
import { VirtualTimeline, type VirtualTimelineHandle } from './components/VirtualTimeline';
import { usePreviewRouter } from './components/preview-router';
import { languageForPath, prismDiffLines, prismSyntaxLines, type SyntaxSegment } from './syntax-highlight';

interface PendingTextDelta {
  event: AgentEvent;
  kind: TimelineKind;
  text: string;
}

interface BtsConversationApi {
  enqueueDelta?: (delta: PendingTextDelta) => number;
  drainDeltas?: () => PendingTextDelta[];
  clearDeltas?: () => void;
}

interface TaskTimelineCache {
  historyItems: TimelineEntry[];
  liveItems: TimelineEntry[];
  before?: number;
  hasMore: boolean;
}

interface TaskReviewCache {
  snapshot: ReviewSnapshot;
  diffs: Record<string, FileDiff>;
  signature: string;
}

const STREAM_FLUSH_INTERVAL_MS = 40;

const AGENTS_TAB: PreviewTab = {
  id: 'agents',
  kind: 'custom',
  title: 'Agents',
  closable: false,
};

const REVIEW_TAB: PreviewTab = {
  id: 'review',
  kind: 'review',
  title: 'Review',
  closable: true,
};

const INITIAL_PREVIEW_TABS = [AGENTS_TAB, REVIEW_TAB];

const EMPTY_REVIEW: ReviewSnapshot = {
  root: '',
  files: [],
  additions: 0,
  deletions: 0,
};

const EMPTY_WORKSPACE: WorkspaceSnapshot = {
  root: '',
  files: [],
  truncated: false,
};

const readInputValue = (event: any): string => event?.detail?.value ?? event?.value ?? '';

function btsConversationApi(): BtsConversationApi | undefined {
  return (NativeModules as any).nodejs?.exposed?.conversation as BtsConversationApi | undefined;
}

function callBridge<T>(method: string, data: unknown = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      (NativeModules as any).bridge.call(method, data, (reply: BridgeResult<T>) => {
        if (!reply?.ok) reject(new Error(reply?.error ?? `${method} failed`));
        else resolve(reply.value as T);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function shortPath(path: string): string {
  const pieces = path.split('/').filter(Boolean);
  if (pieces.length <= 2) return path;
  return `…/${pieces.slice(-2).join('/')}`;
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function statusBadge(file: ChangedFile): string {
  if (file.status === 'added') return 'A';
  if (file.status === 'deleted') return 'D';
  if (file.status === 'renamed') return 'R';
  if (file.status === 'conflicted') return '!';
  return 'M';
}

function extensionBadge(path: string): string {
  const name = fileName(path);
  const extension = name.includes('.') ? name.split('.').pop() ?? '' : '';
  return (extension || 'TXT').slice(0, 4).toUpperCase();
}

interface WorkspaceTreeRow {
  path: string;
  name: string;
  depth: number;
  kind: 'directory' | 'file';
}

interface WorkspaceTreeNode {
  path: string;
  name: string;
  kind: 'directory' | 'file';
  children: Map<string, WorkspaceTreeNode>;
}

function workspaceTreeRows(files: string[], expanded: Record<string, boolean>, filter: string): WorkspaceTreeRow[] {
  const root: WorkspaceTreeNode = { path: '', name: '', kind: 'directory', children: new Map() };
  for (const path of files) {
    const segments = path.split('/').filter(Boolean);
    let parent = root;
    segments.forEach((name, index) => {
      const childPath = segments.slice(0, index + 1).join('/');
      let child = parent.children.get(name);
      if (!child) {
        child = {
          path: childPath,
          name,
          kind: index === segments.length - 1 ? 'file' : 'directory',
          children: new Map(),
        };
        parent.children.set(name, child);
      }
      parent = child;
    });
  }

  const query = filter.trim().toLowerCase();
  const matches = (node: WorkspaceTreeNode): boolean => {
    if (!query) return true;
    if (node.path.toLowerCase().includes(query)) return true;
    return [...node.children.values()].some(matches);
  };
  const rows: WorkspaceTreeRow[] = [];
  const visit = (node: WorkspaceTreeNode, depth: number) => {
    const children = [...node.children.values()]
      .filter(matches)
      .sort((left, right) => left.kind === right.kind
        ? left.name.localeCompare(right.name)
        : left.kind === 'directory' ? -1 : 1);
    for (const child of children) {
      rows.push({ path: child.path, name: child.name, depth, kind: child.kind });
      if (child.kind === 'directory' && (query || expanded[child.path])) visit(child, depth + 1);
    }
  };
  visit(root, 0);
  return rows;
}

function CodeFileView({ preview, selectedLine, onSelectLine }: {
  preview?: WorkspaceFilePreview;
  selectedLine?: number;
  onSelectLine: (line: number) => void;
}) {
  const highlightedLines = useMemo(
    () => prismSyntaxLines(preview?.content ?? '', preview?.language ?? 'text').slice(0, 10_000),
    [preview?.content, preview?.language],
  );
  if (!preview) return <view className="code-preview-loading"><text className="code-preview-loading-text">Loading file…</text></view>;
  if (preview.binary) return <view className="code-preview-loading"><text className="code-preview-loading-text">Binary file preview is unavailable.</text></view>;
  return (
    <list
      key={preview.path}
      className="code-lines"
      scroll-orientation="vertical"
      list-type="single"
      enable-scroll={true}
      initial-scroll-index={Math.max(0, (selectedLine ?? 1) - 4)}
      preload-buffer-count={12}
    >
      <list-item item-key="__top" className="code-file-top-spacer" estimated-main-axis-size-px={6} />
      {highlightedLines.map((line, index) => {
        const lineNumber = index + 1;
        return (
          <list-item
            key={`${preview.path}:${lineNumber}`}
            item-key={`${preview.path}:${lineNumber}`}
            className={`code-line ${selectedLine === lineNumber ? 'code-line--selected' : ''}`}
            estimated-main-axis-size-px={19}
            bindtap={() => onSelectLine(lineNumber)}
          >
            <text className="code-line-number">{lineNumber}</text>
            <text className="code-line-source selectable-text" text-selection={true} flatten={false}>
              {line.map((token, tokenIndex) => (
                <text key={`${tokenIndex}:${token.kind}`} className={`code-token code-token--${token.kind}`}>{token.text}</text>
              ))}
            </text>
          </list-item>
        );
      })}
      {preview.truncated ? (
        <list-item item-key="__truncated" className="code-file-truncated">
          <text className="code-file-truncated-text">Preview truncated at 2 MB.</text>
        </list-item>
      ) : null}
    </list>
  );
}

function DiffRow({ line, tokens }: { line: DiffLine; tokens: SyntaxSegment[] }) {
  const displayLine = line.kind === 'deletion' ? line.oldLine : (line.newLine ?? line.oldLine);
  return (
    <view className={`diff-line diff-line--${line.kind}`}>
      <text className="diff-line-number">{displayLine === undefined ? '' : String(displayLine)}</text>
      <text className="diff-line-marker">{line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '−' : ' '}</text>
      <text className="diff-line-code selectable-text" text-selection={true} flatten={false}>
        {tokens.map((token, tokenIndex) => (
          <text key={`${tokenIndex}:${token.kind}`} className={`code-token code-token--${token.kind}`}>{token.text}</text>
        ))}
      </text>
    </view>
  );
}

type ReviewListRow =
  | { id: string; kind: 'heading'; file: ChangedFile; diff?: FileDiff }
  | { id: string; kind: 'message'; text: string }
  | { id: string; kind: 'diff'; line: DiffLine; tokens: SyntaxSegment[] }
  | { id: string; kind: 'spacer' };

function ReviewDiffList({ files, diffs, loading, onOpenFile, onLoadDiff }: {
  files: ChangedFile[];
  diffs: Record<string, FileDiff>;
  loading: boolean;
  onOpenFile: (path: string) => void;
  onLoadDiff: (file: ChangedFile) => void;
}) {
  const rows = useMemo(() => {
    const next: ReviewListRow[] = [];
    for (const file of files) {
      const diff = diffs[file.path];
      next.push({ id: `${file.path}:heading`, kind: 'heading', file, diff });
      if (!diff) {
        next.push({ id: `${file.path}:loading`, kind: 'message', text: 'Select the file to load its diff.' });
      } else if (diff.binary) {
        next.push({ id: `${file.path}:binary`, kind: 'message', text: 'Binary file changed' });
      } else if (diff.lines.length === 0) {
        next.push({ id: `${file.path}:empty`, kind: 'message', text: 'No text diff available' });
      } else {
        const highlighted = prismDiffLines(diff.lines, languageForPath(file.path));
        diff.lines.forEach((line, index) => next.push({
          id: `${file.path}:${index}:${line.kind}`,
          kind: 'diff',
          line,
          tokens: highlighted[index] ?? [{ text: line.text || ' ', kind: 'plain' }],
        }));
      }
      if (diff?.truncated) {
        next.push({ id: `${file.path}:truncated`, kind: 'message', text: 'Diff truncated after 4,000 lines.' });
      }
      next.push({ id: `${file.path}:spacer`, kind: 'spacer' });
    }
    return next;
  }, [files, diffs]);

  if (loading && files.length === 0) return <text className="review-loading">Reading Git changes…</text>;
  if (!loading && files.length === 0) {
    return (
      <view className="review-empty">
        <view className="review-empty-icon"><text className="review-empty-icon-text">±</text></view>
        <text className="review-empty-title">No changes yet</text>
        <text className="review-empty-copy">Changes in the selected task repository will appear here automatically.</text>
      </view>
    );
  }

  return (
    <list className="review-diff-list" scroll-orientation="vertical" list-type="single" enable-scroll={true} preload-buffer-count={24}>
      {rows.map((row) => {
        if (row.kind === 'heading') {
          return (
            <list-item
              key={row.id}
              item-key={row.id}
              className="review-file-heading"
              estimated-main-axis-size-px={44}
              bindtap={() => row.diff ? onOpenFile(row.file.path) : onLoadDiff(row.file)}
            >
              <view className={`review-file-type review-file-type--${row.file.status}`}><text className="review-file-type-text">{extensionBadge(row.file.path)}</text></view>
              <text className="review-file-path selectable-text" text-maxline="1" text-selection={true} flatten={false}>{row.file.path}</text>
              <view className="review-file-counts"><text className="review-file-add">+{row.diff?.additions ?? row.file.additions}</text><text className="review-file-delete">−{row.diff?.deletions ?? row.file.deletions}</text></view>
            </list-item>
          );
        }
        if (row.kind === 'diff') {
          return <list-item key={row.id} item-key={row.id} estimated-main-axis-size-px={20}><DiffRow line={row.line} tokens={row.tokens} /></list-item>;
        }
        if (row.kind === 'spacer') return <list-item key={row.id} item-key={row.id} className="review-file-spacer" estimated-main-axis-size-px={14} />;
        return <list-item key={row.id} item-key={row.id} className="review-file-empty" estimated-main-axis-size-px={38}><text className="review-file-empty-text">{row.text}</text></list-item>;
      })}
    </list>
  );
}

function mergeText(items: TimelineEntry[], event: AgentEvent, kind: TimelineKind): TimelineEntry[] {
  const id = `${kind}:${event.messageId ?? event.cursor}`;
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items, { sequence: event.cursor, id, kind, text: event.text ?? '' }];
  const next = [...items];
  next[index] = { ...next[index], text: `${next[index].text ?? ''}${event.text ?? ''}` };
  return next;
}

function mergeTimelineEntries(history: TimelineEntry[], additions: TimelineEntry[]): TimelineEntry[] {
  const next = [...history];
  for (const addition of additions) {
    const index = next.findIndex((item) => item.id === addition.id);
    if (index < 0) next.push(addition);
    else next[index] = addition;
  }
  return next;
}

function looksLikeFilePath(path: string): boolean {
  const name = path.split('/').filter(Boolean).pop() ?? '';
  return name.includes('.') && !name.endsWith('.');
}

function MessageCard({ item, onOpenFile, onOpenTool, onOpenLink }: {
  item: TimelineEntry;
  onOpenFile: (path: string, line?: number) => void;
  onOpenTool: () => void;
  onOpenLink: (href: string) => void;
}) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  if (item.kind === 'user') {
    return (
      <view className="message-row message-row--user">
        <view className="user-bubble"><text className="user-text selectable-text" text-selection={true} flatten={false}>{item.text}</text></view>
      </view>
    );
  }
  if (item.kind === 'reasoning') {
    return (
      <view className="reasoning-card">
        <view className="reasoning-header" bindtap={() => setReasoningExpanded((expanded) => !expanded)}>
          <view className="reasoning-dot" />
          <text className="reasoning-label">Worked</text>
          <text className={`reasoning-chevron ${reasoningExpanded ? 'reasoning-chevron--expanded' : ''}`}>›</text>
        </view>
        {reasoningExpanded ? <text className="reasoning-text selectable-text" text-selection={true} flatten={false}>{item.text}</text> : null}
      </view>
    );
  }
  if (item.kind === 'tool' && item.tool) {
    const locations = (item.tool.locations ?? []).flatMap((location) => location.path
      ? [{ path: location.path, line: location.line }]
      : []);
    const primaryLocation = locations.find((location) => location.line || looksLikeFilePath(location.path));
    const titlePath = item.tool.title.trim();
    const inferredTitlePath = !titlePath.includes(' ') && looksLikeFilePath(titlePath)
      ? titlePath
      : undefined;
    const openToolPreview = primaryLocation
      ? () => onOpenFile(primaryLocation.path, primaryLocation.line)
      : inferredTitlePath
        ? () => onOpenFile(inferredTitlePath)
        : onOpenTool;
    return (
      <ToolCard
        title={item.tool.title}
        status={item.tool.status}
        output={item.tool.text}
        locations={locations}
        onOpen={openToolPreview}
        onOpenLocation={(location) => onOpenFile(location.path, location.line)}
      />
    );
  }
  if (item.kind === 'plan') {
    return (
      <view className="plan-card">
        <text className="plan-label">PLAN</text>
        {(item.plan ?? []).map((entry, index) => (
          <view className="plan-row" key={`${index}-${entry.content}`}>
            <view className={`plan-marker plan-marker--${entry.status ?? 'pending'}`} />
            <text className="plan-text selectable-text" text-selection={true} flatten={false}>{entry.content}</text>
          </view>
        ))}
      </view>
    );
  }
  if (item.kind === 'error') {
    return <view className="error-card"><text className="error-text selectable-text" text-selection={true} flatten={false}>{item.text}</text></view>;
  }
  return (
    <view className="assistant-message">
      <view className="assistant-mark"><text className="assistant-mark-text">A</text></view>
      <MarkdownMessage source={item.text ?? ''} onOpenLink={onOpenLink} />
    </view>
  );
}

export function App() {
  const [backends, setBackends] = useState<BackendInfo[]>([]);
  const [backendId, setBackendId] = useState('opencode');
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [historyItems, setHistoryItems] = useState<TimelineEntry[]>([]);
  const [liveItems, setLiveItems] = useState<TimelineEntry[]>([]);
  const [historyBefore, setHistoryBefore] = useState<number | undefined>();
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [composerInputKey, setComposerInputKey] = useState(0);
  const [permission, setPermission] = useState<PermissionRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [review, setReview] = useState<ReviewSnapshot>(EMPTY_REVIEW);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const {
    routes: previewTabs,
    activeRouteId: activePreviewTabId,
    isOpen: previewOpen,
    openRoute: openPreviewRoute,
    activateRoute: activatePreviewRoute,
    closeRoute: closePreviewRoute,
    toggle: togglePreview,
    close: closePreview,
    reset: resetPreviewRouter,
  } = usePreviewRouter<PreviewTab>(INITIAL_PREVIEW_TABS, REVIEW_TAB.id);
  const [accessMenuOpen, setAccessMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [diffs, setDiffs] = useState<Record<string, FileDiff>>({});
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot>(EMPTY_WORKSPACE);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [filePreviews, setFilePreviews] = useState<Record<string, WorkspaceFilePreview>>({});
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [fileTreeFilter, setFileTreeFilter] = useState('');
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});
  const [selectedCodeLines, setSelectedCodeLines] = useState<Record<string, number>>({});
  const [previewAddMenuOpen, setPreviewAddMenuOpen] = useState(false);
  const [codeOpenMenuOpen, setCodeOpenMenuOpen] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const seenCursors = useRef(new Set<number>());
  const selectedTaskIdRef = useRef('');
  const reviewSignatureRef = useRef(new Map<string, string>());
  const timelineCacheRef = useRef(new Map<string, TaskTimelineCache>());
  const reviewCacheRef = useRef(new Map<string, TaskReviewCache>());
  const eventCursorRef = useRef(0);
  const pendingTextRef = useRef(new Map<string, PendingTextDelta>());
  const pendingTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineRef = useRef<VirtualTimelineHandle | null>(null);
  const historyLoadMetricRef = useRef<{ startedAt: number; bridgeMs: number } | null>(null);

  const items = useMemo(() => {
    const merged = [...historyItems];
    for (const liveItem of liveItems) {
      const index = merged.findIndex((item) => item.id === liveItem.id);
      if (index < 0) merged.push(liveItem);
      else merged[index] = liveItem;
    }
    return merged;
  }, [historyItems, liveItems]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const sidebarTasks = useMemo(
    () => priorityOnly
      ? tasks.filter((task) => task.status === 'running' || task.status === 'waiting' || task.status === 'error')
      : tasks,
    [priorityOnly, tasks],
  );

  const sidebarSearchResults = useMemo(() => {
    const query = sidebarSearchQuery.trim().toLowerCase();
    if (!query) return tasks.slice(0, 10);
    return tasks.filter((task) => `${task.title} ${task.cwd}`.toLowerCase().includes(query)).slice(0, 10);
  }, [sidebarSearchQuery, tasks]);

  const selectedBackend = useMemo(
    () => backends.find((backend) => backend.id === (selectedTask?.backendId ?? backendId)) ?? null,
    [backends, selectedTask, backendId],
  );

  const configuredBackend = useMemo(
    () => backends.find((backend) => backend.id === backendId) ?? backends.find((backend) => backend.status === 'ready') ?? null,
    [backends, backendId],
  );

  const workspaceName = useMemo(() => fileName(workspace || selectedTask?.cwd || 'Workspace'), [workspace, selectedTask]);

  const activePreviewTab = useMemo(
    () => previewTabs.find((tab) => tab.id === activePreviewTabId) ?? previewTabs[0] ?? AGENTS_TAB,
    [previewTabs, activePreviewTabId],
  );

  const previewTabStripWidth = useMemo(() => previewTabs.reduce((width, tab) => {
    if (tab.kind === 'custom') return width + 108;
    if (tab.kind === 'review') return width + 116;
    if (tab.kind === 'file') return width + 138;
    return width + 132;
  }, Math.max(0, previewTabs.length - 1) * 3), [previewTabs]);

  const activeFilePreview = activePreviewTab.kind === 'file' && activePreviewTab.resource
    ? filePreviews[activePreviewTab.resource]
    : undefined;

  const workspaceRows = useMemo(
    () => workspaceTreeRows(workspaceSnapshot.files, expandedDirectories, fileTreeFilter),
    [workspaceSnapshot.files, expandedDirectories, fileTreeFilter],
  );

  const workspaceTasks = useMemo(
    () => tasks.filter((task) => task.cwd === selectedTask?.cwd).slice(0, 8),
    [tasks, selectedTask?.cwd],
  );

  const agentActivities = useMemo(
    () => items.filter((item) => item.kind === 'tool' || item.kind === 'plan' || item.kind === 'reasoning').slice(-6).reverse(),
    [items],
  );

  const modelLabel = useMemo(() => {
    const model = selectedTask?.configOptions.find((option) => option.category === 'model' || option.id === 'model');
    if (!model) return selectedBackend?.label ?? 'Agent';
    return model.options?.find((option) => option.value === model.currentValue)?.name
      ?? String(model.currentValue ?? model.name);
  }, [selectedTask, selectedBackend]);

  const modeOption = useMemo(
    () => selectedTask?.configOptions.find((option) => option.category === 'mode' || option.id === 'mode'),
    [selectedTask],
  );

  const accessLabel = modeOption?.currentValue === 'plan' ? 'Plan mode' : 'Full access';

  const flushPendingText = useCallback(() => {
    if (pendingTextTimerRef.current !== null) {
      clearTimeout(pendingTextTimerRef.current);
      pendingTextTimerRef.current = null;
    }
    let pending: PendingTextDelta[] = [];
    try { pending = btsConversationApi()?.drainDeltas?.() ?? []; } catch {}
    if (pendingTextRef.current.size > 0) pending.push(...pendingTextRef.current.values());
    if (pending.length === 0) return;
    pendingTextRef.current.clear();
    setLiveItems((current) => pending.reduce(
      (next, entry) => mergeText(next, { ...entry.event, text: entry.text }, entry.kind),
      current,
    ));
  }, []);

  const clearPendingText = useCallback(() => {
    if (pendingTextTimerRef.current !== null) {
      clearTimeout(pendingTextTimerRef.current);
      pendingTextTimerRef.current = null;
    }
    pendingTextRef.current.clear();
    try { btsConversationApi()?.clearDeltas?.(); } catch {}
  }, []);

  const queueTextDelta = useCallback((event: AgentEvent, kind: TimelineKind) => {
    const id = `${kind}:${event.messageId ?? event.cursor}`;
    let bufferedInBts = false;
    try {
      const { raw: _raw, ...serializableEvent } = event;
      btsConversationApi()?.enqueueDelta?.({ event: serializableEvent, kind, text: event.text ?? '' });
      bufferedInBts = Boolean(btsConversationApi()?.enqueueDelta);
    } catch {}
    if (!bufferedInBts) {
      const existing = pendingTextRef.current.get(id);
      pendingTextRef.current.set(id, {
        event,
        kind,
        text: `${existing?.text ?? ''}${event.text ?? ''}`,
      });
    }
    if (pendingTextTimerRef.current === null) {
      pendingTextTimerRef.current = setTimeout(flushPendingText, STREAM_FLUSH_INTERVAL_MS);
    }
  }, [flushPendingText]);

  const applyEvent = useCallback((event: AgentEvent) => {
    eventCursorRef.current = Math.max(eventCursorRef.current, event.cursor);
    if (seenCursors.current.has(event.cursor)) return;
    seenCursors.current.add(event.cursor);

    if (event.task) {
      setTasks((current) => {
        const index = current.findIndex((task) => task.id === event.task!.id);
        if (index < 0) return [event.task!, ...current];
        const next = [...current];
        next[index] = event.task!;
        return next;
      });
    } else if (event.taskId && event.status) {
      setTasks((current) => current.map((task) => task.id === event.taskId
        ? { ...task, status: event.status!, updatedAt: event.at }
        : task));
    }

    if (!event.taskId || event.taskId !== selectedTaskIdRef.current) return;
    if (event.type !== 'message-delta' && event.type !== 'reasoning-delta') flushPendingText();
    switch (event.type) {
      case 'user-message':
        setLiveItems((current) => mergeText(current, event, 'user'));
        break;
      case 'message-delta':
        queueTextDelta(event, 'assistant');
        break;
      case 'reasoning-delta':
        queueTextDelta(event, 'reasoning');
        break;
      case 'tool':
        if (event.tool) {
          setLiveItems((current) => {
            const id = `tool:${event.tool!.toolCallId}`;
            const index = current.findIndex((item) => item.id === id);
            if (index < 0) return [...current, { sequence: event.cursor, id, kind: 'tool', tool: event.tool }];
            const next = [...current];
            next[index] = { ...next[index], tool: { ...next[index].tool, ...event.tool } as ToolItem };
            return next;
          });
        }
        break;
      case 'plan':
        setLiveItems((current) => [...current.filter((item) => item.id !== 'plan'), { sequence: event.cursor, id: 'plan', kind: 'plan', plan: event.plan }]);
        break;
      case 'permission':
        setPermission(event.permission ?? null);
        break;
      case 'permission-resolved':
        setPermission(null);
        break;
      case 'turn-state':
        if (event.status && event.status !== 'running' && event.status !== 'waiting') {
          setLiveItems((current) => {
            if (current.length > 0) setHistoryItems((history) => mergeTimelineEntries(history, current));
            return [];
          });
        }
        break;
      case 'error':
        setLiveItems((current) => [...current, { sequence: event.cursor, id: `error:${event.cursor}`, kind: 'error', text: event.error }]);
        break;
    }
  }, [flushPendingText, queueTextDelta]);

  const refreshSnapshot = useCallback(async () => {
    const snapshot = await callBridge<EventSnapshot>('agent:eventsSince', { cursor: eventCursorRef.current });
    snapshot.events.forEach(applyEvent);
    eventCursorRef.current = Math.max(eventCursorRef.current, snapshot.cursor);
  }, [applyEvent]);

  const loadLatestTimeline = useCallback(async (taskId: string) => {
    const page = await callBridge<TimelinePage>('agent:timelinePage', { taskId, limit: 50 });
    if (selectedTaskIdRef.current !== taskId) return;
    setHistoryItems(page.items);
    setLiveItems([]);
    setHistoryBefore(page.before);
    setHistoryHasMore(page.hasMore);
    timelineCacheRef.current.set(taskId, {
      historyItems: page.items,
      liveItems: [],
      before: page.before,
      hasMore: page.hasMore,
    });
  }, []);

  const loadEarlierTimeline = useCallback(async () => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId || !historyHasMore || historyLoading || historyBefore === undefined) return;
    const startedAt = Date.now();
    historyLoadMetricRef.current = { startedAt, bridgeMs: 0 };
    setHistoryLoading(true);
    try {
      const page = await callBridge<TimelinePage>('agent:timelinePage', {
        taskId,
        before: historyBefore,
        limit: 50,
      });
      const bridgeMs = Date.now() - startedAt;
      historyLoadMetricRef.current = { startedAt, bridgeMs };
      void callBridge('debug:historyLoad', {
        phase: 'bridge',
        taskId,
        durationMs: bridgeMs,
        itemCount: page.items.length,
      });
      if (selectedTaskIdRef.current !== taskId) return;
      setHistoryItems((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...page.items.filter((item) => !existing.has(item.id)), ...current];
      });
      setHistoryBefore(page.before);
      setHistoryHasMore(page.hasMore);
    } catch (caught) {
      if (selectedTaskIdRef.current === taskId) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (selectedTaskIdRef.current === taskId) setHistoryLoading(false);
    }
  }, [historyBefore, historyHasMore, historyLoading]);

  const handleEarlierLayoutSettled = useCallback(() => {
    const metric = historyLoadMetricRef.current;
    if (!metric) return;
    historyLoadMetricRef.current = null;
    void callBridge('debug:historyLoad', {
      phase: 'layout-settled',
      taskId: selectedTaskIdRef.current,
      bridgeMs: metric.bridgeMs,
      durationMs: Date.now() - metric.startedAt,
    });
  }, []);

  const jumpToRandomTimelinePosition = useCallback(() => {
    if (items.length === 0) return;
    timelineRef.current?.scrollToIndex(Math.floor(Math.random() * items.length), true);
  }, [items.length]);

  const resetPreviews = useCallback(() => {
    resetPreviewRouter();
    setDiffs({});
    setReview(EMPTY_REVIEW);
    setReviewError('');
    setWorkspaceSnapshot(EMPTY_WORKSPACE);
    setWorkspaceError('');
    setFilePreviews({});
    setFileTreeOpen(false);
    setFileTreeFilter('');
    setExpandedDirectories({});
    setSelectedCodeLines({});
    setPreviewAddMenuOpen(false);
    setCodeOpenMenuOpen(false);
    reviewSignatureRef.current.clear();
  }, [resetPreviewRouter]);

  const refreshReview = useCallback(async (includeDiffs = true) => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId) {
      setReview(EMPTY_REVIEW);
      return;
    }
    const cachedBeforeRefresh = reviewCacheRef.current.get(taskId);
    const showInitialLoading = !cachedBeforeRefresh;
    if (showInitialLoading) setReviewLoading(true);
    try {
      const snapshot = await callBridge<ReviewSnapshot>('review:snapshot', { taskId });
      if (selectedTaskIdRef.current !== taskId) return;
      setReviewError('');
      const signature = snapshot.files
        .map((file) => `${file.path}:${file.status}:${file.additions}:${file.deletions}:${file.staged}:${file.unstaged}`)
        .join('|');
      const cached = reviewCacheRef.current.get(taskId);
      const signatureChanged = signature !== reviewSignatureRef.current.get(taskId);
      reviewSignatureRef.current.set(taskId, signature);
      const retainedDiffs = signatureChanged ? {} : (cached?.diffs ?? {});
      let nextDiffs = retainedDiffs;
      const firstFile = includeDiffs ? snapshot.files[0] : undefined;
      if (firstFile && !retainedDiffs[firstFile.path]) {
        try {
          const firstDiff = await callBridge<FileDiff>('review:fileDiff', { taskId, path: firstFile.path });
          if (selectedTaskIdRef.current !== taskId) return;
          nextDiffs = { ...retainedDiffs, [firstDiff.path]: firstDiff };
        } catch {}
      }
      if (!cached || signatureChanged) setReview(snapshot);
      if (nextDiffs !== cached?.diffs) setDiffs(nextDiffs);
      reviewCacheRef.current.set(taskId, { snapshot, diffs: nextDiffs, signature });
    } catch (caught) {
      if (selectedTaskIdRef.current !== taskId) return;
      setReview(EMPTY_REVIEW);
      setReviewError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (showInitialLoading && selectedTaskIdRef.current === taskId) setReviewLoading(false);
    }
  }, []);

  const loadReviewDiff = useCallback(async (file: ChangedFile) => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId || reviewCacheRef.current.get(taskId)?.diffs[file.path]) return;
    try {
      const diff = await callBridge<FileDiff>('review:fileDiff', { taskId, path: file.path });
      if (selectedTaskIdRef.current !== taskId) return;
      setDiffs((current) => {
        const next = { ...current, [diff.path]: diff };
        const cached = reviewCacheRef.current.get(taskId);
        reviewCacheRef.current.set(taskId, {
          snapshot: cached?.snapshot ?? EMPTY_REVIEW,
          diffs: next,
          signature: cached?.signature ?? reviewSignatureRef.current.get(taskId) ?? '',
        });
        return next;
      });
    } catch (caught) {
      if (selectedTaskIdRef.current === taskId) setReviewError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const openReview = useCallback(() => {
    openPreviewRoute(REVIEW_TAB);
    setPreviewAddMenuOpen(false);
    setCodeOpenMenuOpen(false);
  }, [openPreviewRoute]);

  const openExternalLink = useCallback((href: string) => {
    void callBridge('shell:openExternal', { href }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : String(caught));
    });
  }, []);

  const loadWorkspaceSnapshot = useCallback(async (): Promise<WorkspaceSnapshot> => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId) return EMPTY_WORKSPACE;
    setWorkspaceLoading(true);
    try {
      const snapshot = await callBridge<WorkspaceSnapshot>('workspace:snapshot', { taskId });
      if (selectedTaskIdRef.current !== taskId) return EMPTY_WORKSPACE;
      setWorkspaceSnapshot(snapshot);
      setWorkspaceError('');
      return snapshot;
    } catch (caught) {
      if (selectedTaskIdRef.current === taskId) setWorkspaceError(caught instanceof Error ? caught.message : String(caught));
      return EMPTY_WORKSPACE;
    } finally {
      if (selectedTaskIdRef.current === taskId) setWorkspaceLoading(false);
    }
  }, []);

  const openFilePreview = useCallback(async (path: string, line?: number) => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId || !path) return;
    let snapshot = workspaceSnapshot;
    if (path.startsWith('/') && !snapshot.root) snapshot = await loadWorkspaceSnapshot();
    const repositoryPrefix = snapshot.root ? `${snapshot.root}/` : '';
    if (path.startsWith('/') && (!repositoryPrefix || !path.startsWith(repositoryPrefix))) {
      setWorkspaceError('The requested preview is outside the task repository.');
      return;
    }
    const normalizedPath = (repositoryPrefix && path.startsWith(repositoryPrefix) ? path.slice(repositoryPrefix.length) : path).replace(/^\.\//, '');
    const tab: PreviewTab = {
      id: `file:${normalizedPath}`,
      kind: 'file',
      title: fileName(normalizedPath),
      resource: normalizedPath,
      closable: true,
    };
    openPreviewRoute(tab);
    setPreviewAddMenuOpen(false);
    setCodeOpenMenuOpen(false);
    if (line) setSelectedCodeLines((current) => ({ ...current, [normalizedPath]: line }));
    const segments = normalizedPath.split('/');
    const directories: Record<string, boolean> = {};
    for (let index = 1; index < segments.length; index += 1) directories[segments.slice(0, index).join('/')] = true;
    setExpandedDirectories((current) => ({ ...current, ...directories }));
    if (!snapshot.files.length) void loadWorkspaceSnapshot();
    if (filePreviews[normalizedPath]) return;
    try {
      const preview = await callBridge<WorkspaceFilePreview>('workspace:file', { taskId, path: normalizedPath });
      if (selectedTaskIdRef.current !== taskId) return;
      setFilePreviews((current) => ({ ...current, [normalizedPath]: preview }));
      setWorkspaceError('');
    } catch (caught) {
      if (selectedTaskIdRef.current === taskId) setWorkspaceError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [filePreviews, workspaceSnapshot, loadWorkspaceSnapshot, openPreviewRoute]);

  const browseCode = useCallback(async () => {
    const snapshot = workspaceSnapshot.files.length ? workspaceSnapshot : await loadWorkspaceSnapshot();
    const preferredPath = review.files[0]?.path ?? snapshot.files[0];
    if (preferredPath) await openFilePreview(preferredPath);
  }, [workspaceSnapshot, review.files, loadWorkspaceSnapshot, openFilePreview]);

  const openActiveFileExternally = useCallback(async (mode: 'open' | 'reveal') => {
    const taskId = selectedTaskIdRef.current;
    const resource = activePreviewTab.kind === 'file' ? activePreviewTab.resource : undefined;
    if (!taskId || !resource) return;
    setCodeOpenMenuOpen(false);
    try {
      await callBridge(mode === 'open' ? 'workspace:open' : 'workspace:reveal', { taskId, path: resource });
      setWorkspaceError('');
    } catch (caught) {
      setWorkspaceError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [activePreviewTab]);

  const openAgents = useCallback(() => {
    openPreviewRoute(AGENTS_TAB);
    setPreviewAddMenuOpen(false);
    setCodeOpenMenuOpen(false);
  }, [openPreviewRoute]);

  const closePreviewTab = useCallback((tab: PreviewTab) => {
    if (!tab.closable) return;
    closePreviewRoute(tab.id);
  }, [closePreviewRoute]);

  const initialize = useCallback(async () => {
    try {
      const [backendList, taskList, defaultWorkspace] = await Promise.all([
        callBridge<BackendInfo[]>('agent:listBackends'),
        callBridge<AgentTask[]>('agent:listTasks'),
        callBridge<{ path: string }>('agent:defaultWorkspace'),
      ]);
      setBackends(backendList);
      setTasks(taskList);
      setWorkspace(defaultWorkspace.path);
      const openCode = backendList.find((backend) => backend.id === 'opencode');
      if (openCode?.status !== 'ready') setBackendId('mock');
      if (taskList[0]) {
        selectedTaskIdRef.current = taskList[0].id;
        setSelectedTaskId(taskList[0].id);
        if (taskList[0].backendId === 'opencode' && openCode?.status === 'ready') {
          await callBridge<AgentTask>('agent:loadTask', { taskId: taskList[0].id });
        }
        await loadLatestTimeline(taskList[0].id);
      }
      await refreshSnapshot();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setInitialized(true);
    }
  }, [loadLatestTimeline, refreshSnapshot]);

  const recoverServiceState = useCallback(async () => {
    const taskId = selectedTaskIdRef.current;
    try {
      const taskList = await callBridge<AgentTask[]>('agent:listTasks');
      setTasks(taskList);
      const currentTask = taskList.find((task) => task.id === taskId);
      if (currentTask?.backendId === 'opencode') await callBridge<AgentTask>('agent:loadTask', { taskId });
      if (currentTask) await loadLatestTimeline(taskId);
      await refreshSnapshot();
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [loadLatestTimeline, refreshSnapshot]);

  const chooseWorkspace = useCallback(async () => {
    try {
      const result = await callBridge<{ path: string }>('agent:chooseWorkspace');
      if (result.path) setWorkspace(result.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const createTask = useCallback(async () => {
    if (!workspace || busy) return;
    setBusy(true);
    setAccessMenuOpen(false);
    setModelMenuOpen(false);
    setError('');
    try {
      const task = await callBridge<AgentTask>('agent:startTask', { backendId, cwd: workspace });
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      selectedTaskIdRef.current = task.id;
      setSelectedTaskId(task.id);
      clearPendingText();
      setHistoryItems([]);
      setLiveItems([]);
      setHistoryBefore(undefined);
      setHistoryHasMore(false);
      setPermission(null);
      resetPreviews();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [workspace, backendId, busy, resetPreviews, clearPendingText]);

  const selectTask = useCallback(async (task: AgentTask) => {
    if (task.id === selectedTaskId) return;
    if (selectedTaskId) {
      timelineCacheRef.current.set(selectedTaskId, {
        historyItems,
        liveItems,
        before: historyBefore,
        hasMore: historyHasMore,
      });
      reviewCacheRef.current.set(selectedTaskId, {
        snapshot: review,
        diffs,
        signature: reviewSignatureRef.current.get(selectedTaskId) ?? '',
      });
    }
    const cachedTimeline = timelineCacheRef.current.get(task.id);
    const cachedReview = reviewCacheRef.current.get(task.id);
    selectedTaskIdRef.current = task.id;
    setAccessMenuOpen(false);
    setModelMenuOpen(false);
    setSelectedTaskId(task.id);
    setWorkspace(task.cwd);
    clearPendingText();
    setHistoryItems(cachedTimeline?.historyItems ?? []);
    setLiveItems(cachedTimeline?.liveItems ?? []);
    setHistoryBefore(cachedTimeline?.before);
    setHistoryHasMore(cachedTimeline?.hasMore ?? false);
    setPermission(null);
    setError('');
    setReview(cachedReview?.snapshot ?? EMPTY_REVIEW);
    setDiffs(cachedReview?.diffs ?? {});
    setReviewError('');
    setReviewLoading(false);
    setWorkspaceSnapshot(EMPTY_WORKSPACE);
    setWorkspaceError('');
    setFilePreviews({});
    const hydrateTimeline = async () => {
      try {
        if (task.backendId === 'opencode') {
          await callBridge<AgentTask>('agent:loadTask', { taskId: task.id });
        }
        await loadLatestTimeline(task.id);
      } catch (caught) {
        if (selectedTaskIdRef.current === task.id) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    };
    void hydrateTimeline();
    void refreshSnapshot();
  }, [selectedTaskId, historyItems, liveItems, historyBefore, historyHasMore, review, diffs, refreshSnapshot, clearPendingText, loadLatestTimeline]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!selectedTask || !text || selectedTask.status === 'running' || selectedTask.status === 'waiting') return;
    setError('');
    try {
      await callBridge('agent:prompt', { taskId: selectedTask.id, text });
      if (items.length === 0) {
        const title = text.split('\n')[0].slice(0, 56);
        setTasks((current) => current.map((task) => task.id === selectedTask.id
          ? { ...task, title, status: 'running', updatedAt: Date.now() }
          : task));
      }
      setPrompt('');
      setComposerInputKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [prompt, selectedTask, items.length]);

  const cancel = useCallback(async () => {
    if (!selectedTask) return;
    try {
      await callBridge('agent:cancel', { taskId: selectedTask.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [selectedTask]);

  const answerPermission = useCallback(async (optionId?: string) => {
    if (!permission) return;
    try {
      await callBridge('agent:permission', { requestId: permission.requestId, optionId });
      setPermission(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [permission]);

  const cycleBackend = useCallback(() => {
    const available = backends.filter((backend) => backend.status === 'ready');
    if (available.length < 2) return;
    const index = available.findIndex((backend) => backend.id === backendId);
    setBackendId(available[(index + 1 + available.length) % available.length].id);
  }, [backends, backendId]);

  const setTaskConfigOption = useCallback(async (configId: string, value: string | boolean) => {
    if (!selectedTask) return;
    try {
      const configOptions = await callBridge<AgentTask['configOptions']>('agent:setConfigOption', {
        taskId: selectedTask.id,
        configId,
        value,
      });
      setTasks((current) => current.map((task) => task.id === selectedTask.id
        ? { ...task, configOptions, updatedAt: Date.now() }
        : task));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [selectedTask]);

  useEffect(() => {
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const handler = (...args: unknown[]) => applyEvent(args[0] as AgentEvent);
    emitter.addListener('agent:event', handler);
    initialize();
    return () => {
      emitter.removeListener('agent:event', handler);
      clearPendingText();
    };
  }, [applyEvent, initialize, clearPendingText]);

  useEffect(() => {
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const serviceHandler = (...args: unknown[]) => {
      const state = args[0] as { state?: string; detail?: string };
      if (state?.state === 'recovering') setError('Background service interrupted. Reconnecting…');
      if (state?.state === 'ready' && initialized) void recoverServiceState();
    };
    emitter.addListener('service:state', serviceHandler);
    return () => emitter.removeListener('service:state', serviceHandler);
  }, [initialized, recoverServiceState]);

  useEffect(() => {
    if (!selectedTaskId || !previewOpen) return;
    const reviewVisible = activePreviewTab.kind === 'review';
    const agentsVisible = activePreviewTab.id === AGENTS_TAB.id;
    if (!reviewVisible && !agentsVisible) return;
    void refreshReview(reviewVisible);
    if (selectedTask?.status !== 'running' && selectedTask?.status !== 'waiting') return;
    const timer = setInterval(() => void refreshReview(reviewVisible), 3_000);
    return () => clearInterval(timer);
  }, [selectedTaskId, selectedTask?.status, selectedTask?.updatedAt, previewOpen, activePreviewTab.id, activePreviewTab.kind, refreshReview]);

  return (
    <view className={`app-shell ${previewOpen ? 'app-shell--preview-open' : ''}`}>
      <view className="titlebar">
        <view className="titlebar-sidebar">
          <view
            className={`titlebar-tool-button titlebar-sidebar-toggle ${previewOpen ? 'titlebar-tool-button--active' : ''}`}
            bindtap={() => {
              togglePreview();
              setAccessMenuOpen(false);
              setModelMenuOpen(false);
            }}
          >
            <view className="sidebar-toggle-outline"><view className="sidebar-toggle-divider" /></view>
          </view>
          <view className="titlebar-tool-button"><view className="titlebar-chevron titlebar-chevron--back" /></view>
          <view className="titlebar-tool-button"><view className="titlebar-chevron titlebar-chevron--forward" /></view>
        </view>
        <view className="titlebar-thread">
          <view className="titlebar-folder"><view className="folder-glyph"><view className="folder-glyph-tab" /></view></view>
          <text className="titlebar-thread-title" text-maxline="1">{selectedTask?.title ?? 'New task'}</text>
          <text className="titlebar-more" bindtap={jumpToRandomTimelinePosition}>•••</text>
          <view className="titlebar-thread-spacer" />
          <view className="titlebar-location" bindtap={chooseWorkspace}>
            <text className="titlebar-location-icon">▣</text>
            <text className="titlebar-location-text">Open</text>
            <text className="titlebar-location-chevron">⌄</text>
          </view>
          <view className="titlebar-controls" bindtap={() => {
            togglePreview();
            setAccessMenuOpen(false);
            setModelMenuOpen(false);
          }}><text className="titlebar-controls-text">◧</text></view>
        </view>
        {previewOpen ? <view className="titlebar-preview">
          <scroll-view scroll-x className="preview-tab-scroll">
            <view className="preview-tab-list" style={{ width: `${previewTabStripWidth}px` }}>
              {previewTabs.map((tab) => (
                <view key={tab.id} className={`preview-tab preview-tab--${tab.kind} ${activePreviewTab.id === tab.id ? 'preview-tab--active' : ''}`}>
                  <view className="preview-tab-target" bindtap={() => {
                    activatePreviewRoute(tab.id);
                    setPreviewAddMenuOpen(false);
                    setCodeOpenMenuOpen(false);
                  }}>
                    <text className={`preview-tab-icon preview-tab-icon--${tab.kind}`}>{tab.kind === 'review' ? '▣' : tab.id === 'agents' ? '♙' : tab.kind === 'file' ? '◆' : '◇'}</text>
                    <text className="preview-tab-title" text-maxline="1">{tab.title}</text>
                  </view>
                  {tab.closable ? (
                    <view className="preview-tab-close" bindtap={() => closePreviewTab(tab)}><text className="preview-tab-close-text">×</text></view>
                  ) : null}
                </view>
              ))}
            </view>
          </scroll-view>
          <view className="preview-new-tab" bindtap={() => setPreviewAddMenuOpen((open) => !open)}><text className="preview-new-tab-text">＋</text></view>
          <view className="preview-layout" bindtap={closePreview}><text className="preview-layout-text">◧</text></view>
        </view> : null}
      </view>

      <view className="workspace-shell">
        <view className="sidebar">
          <view className="sidebar-product-row">
            <view className="sidebar-product-title"><text className="sidebar-product-name">Codex</text><text className="sidebar-product-chevron">⌄</text></view>
            <view className="sidebar-product-actions">
              <view
                className={`sidebar-action-button sidebar-search-icon ${sidebarSearchOpen ? 'sidebar-action-button--active' : ''}`}
                bindtap={() => {
                  setSidebarSearchOpen(true);
                  setSidebarSearchQuery('');
                  setAccessMenuOpen(false);
                  setModelMenuOpen(false);
                }}
              ><view className="search-icon-ring" /><view className="search-icon-handle" /></view>
              <view
                className={`sidebar-action-button sidebar-bell-icon ${priorityOnly ? 'sidebar-action-button--active' : ''}`}
                bindtap={() => setPriorityOnly((active) => !active)}
              ><view className="bell-icon-body" /><view className="bell-icon-dot" /></view>
            </view>
          </view>

          <view className="sidebar-new-task" bindtap={createTask}>
            <view className="sidebar-new-task-icon"><view className="new-task-icon-box" /><view className="new-task-icon-pencil" /></view>
            <text className="sidebar-new-task-text">New task</text>
          </view>

          <scroll-view scroll-y className="sidebar-project-scroll">
            <view className="sidebar-project-heading" bindtap={chooseWorkspace}>
              <view className="sidebar-project-icon"><view className="folder-glyph"><view className="folder-glyph-tab" /></view></view>
              <text className="sidebar-project-name" text-maxline="1">{workspaceName}</text>
              <text className="sidebar-project-menu">•••</text>
            </view>
            {sidebarTasks.length === 0 ? <text className="empty-tasks">{priorityOnly ? 'No priority tasks' : 'No tasks yet'}</text> : null}
            {sidebarTasks.map((task) => (
              <view
                key={task.id}
                className={`sidebar-task-link ${selectedTaskId === task.id ? 'sidebar-task-link--active' : ''}`}
                bindtap={() => selectTask(task)}
              >
                <view className="sidebar-task-title-row">
                  <text className="sidebar-task-link-title" text-maxline="2">{task.title}</text>
                  {task.status === 'running' || task.status === 'waiting'
                    ? <view className={`task-state task-state--${task.status}`} />
                    : null}
                </view>
              </view>
            ))}
          </scroll-view>

          <view className="sidebar-status-card">
            <view className={`connection-dot connection-dot--${configuredBackend?.status ?? 'missing'}`} />
            <view className="sidebar-status-copy">
              <text className="sidebar-status-title">{configuredBackend?.status === 'ready' ? `${configuredBackend.label} ready` : 'Backend unavailable'}</text>
              <text className="sidebar-status-detail">Agent connection</text>
            </view>
            <text className="sidebar-status-count">{backends.filter((backend) => backend.status === 'ready').length}/{backends.length}</text>
          </view>

          <view className="sidebar-backend-picker" bindtap={cycleBackend}>
            <view className="sidebar-avatar"><text className="sidebar-avatar-text">AI</text></view>
            <view className="sidebar-backend-picker-copy">
              <text className="sidebar-backend-picker-name">{configuredBackend?.label ?? 'Agent backend'}</text>
              <text className="sidebar-backend-picker-detail">{configuredBackend?.version ? `v${configuredBackend.version}` : configuredBackend?.status ?? 'missing'}</text>
            </view>
            <text className="sidebar-backend-chevron">⌃</text>
          </view>
        </view>

        <view className="conversation">
          {items.length === 0 ? (
            <scroll-view scroll-y className="transcript">
              {!selectedTask ? (
              <view className="welcome">
                <view className="welcome-mark"><text className="welcome-mark-text">C</text></view>
                <text className="welcome-title">Build with any coding agent</text>
                <text className="welcome-copy">Choose an available backend, select a workspace, and start a task. OpenCode is connected through the same ACP adapter used by other compatible agents.</text>
                <view className="welcome-actions">
                  <view className="welcome-action" bindtap={createTask}><text className="welcome-action-text">Create task</text></view>
                  <view className="welcome-action welcome-action--secondary" bindtap={chooseWorkspace}><text className="welcome-action-secondary-text">Choose workspace</text></view>
                </view>
              </view>
              ) : null}
              {selectedTask ? (
              <view className="task-empty">
                <view className="task-empty-mark">
                  <view className="task-empty-mark-left" />
                  <view className="task-empty-mark-right" />
                  <text className="task-empty-mark-code">›_</text>
                </view>
                <text className="task-empty-title">What should we build in <text className="task-empty-workspace">{workspaceName}</text>?</text>
                {!prompt.trim() ? (
                  <view className="task-starters">
                    <view className="task-starter" bindtap={() => setPrompt('Explore this codebase and explain how it works')}>
                      <text className="task-starter-icon task-starter-icon--blue">⌕</text>
                      <text className="task-starter-text">Explore and understand code</text>
                    </view>
                    <view className="task-starter" bindtap={() => setPrompt('Build a new feature, app, or tool')}>
                      <text className="task-starter-icon task-starter-icon--purple">⌁</text>
                      <text className="task-starter-text">Build a feature, app, or tool</text>
                    </view>
                    <view className="task-starter" bindtap={() => setPrompt('Review the code and suggest improvements')}>
                      <text className="task-starter-icon task-starter-icon--green">⟳</text>
                      <text className="task-starter-text">Review code and suggest changes</text>
                    </view>
                    <view className="task-starter" bindtap={() => setPrompt('Find and fix a bug or failing test')}>
                      <text className="task-starter-icon task-starter-icon--orange">♨</text>
                      <text className="task-starter-text">Fix a bug or failure</text>
                    </view>
                  </view>
                ) : null}
                <view className="task-workspace-chip">
                  <view className="folder-glyph"><view className="folder-glyph-tab" /></view>
                  <text className="task-workspace-chip-text">{workspaceName}</text>
                </view>
              </view>
              ) : null}
              {error ? <view className="inline-error"><text className="inline-error-text selectable-text" text-selection={true} flatten={false}>{error}</text></view> : null}
            </scroll-view>
          ) : (
            <VirtualTimeline
              key={selectedTaskId}
              ref={timelineRef}
              id="conversation-timeline"
              items={items}
              renderItem={(item) => (
                <MessageCard
                  item={item}
                  onOpenFile={openFilePreview}
                  onOpenTool={openAgents}
                  onOpenLink={openExternalLink}
                />
              )}
              hasEarlier={historyHasMore}
              loadingEarlier={historyLoading}
              onReachStart={loadEarlierTimeline}
              onEarlierLayoutSettled={handleEarlierLayoutSettled}
              footer={(
                <view className="timeline-footer-content">
                  {selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? (
                    <view className="timeline-thinking"><text className="timeline-thinking-text">Thinking</text></view>
                  ) : null}
                  {selectedTask && review.files.length > 0 ? (
                    <view className="change-card">
                      <view className="change-card-header">
                        <view className="change-card-icon"><text className="change-card-icon-text">＋</text></view>
                        <view className="change-card-title-wrap">
                          <text className="change-card-title">Edited {review.files.length} {review.files.length === 1 ? 'file' : 'files'}</text>
                          <view className="change-card-totals">
                            <text className="change-card-add">+{review.additions}</text>
                            <text className="change-card-delete">−{review.deletions}</text>
                          </view>
                        </view>
                        <view className="change-card-actions">
                          <view className="change-card-undo"><text className="change-card-undo-text">Undo</text><text className="change-card-undo-icon">↶</text></view>
                          <view className="change-card-review" bindtap={openReview}><text className="change-card-review-text">Review</text></view>
                        </view>
                      </view>
                      <view className="change-card-files">
                        {review.files.slice(0, 3).map((file) => (
                          <view className="change-card-file" key={file.path} bindtap={openReview}>
                            <text className="change-card-file-path" text-maxline="1">{shortPath(file.path)}</text>
                            <view className="change-card-file-totals">
                              <text className="change-card-file-add">+{file.additions}</text>
                              <text className="change-card-file-delete">−{file.deletions}</text>
                            </view>
                          </view>
                        ))}
                        {review.files.length > 3 ? (
                          <view className="change-card-more" bindtap={openReview}><text className="change-card-more-text">{review.files.length - 3} more changed files</text></view>
                        ) : null}
                      </view>
                    </view>
                  ) : null}
                  {error ? <view className="inline-error"><text className="inline-error-text selectable-text" text-selection={true} flatten={false}>{error}</text></view> : null}
                </view>
              )}
            />
          )}

          {permission ? (
            <view className="permission-bar">
              <view className="permission-copy">
                <text className="permission-label">PERMISSION REQUIRED</text>
                <text className="permission-title">{permission.title}</text>
              </view>
              <view className="permission-actions">
                {permission.options.map((option) => (
                  <view
                    key={option.optionId}
                    className={`permission-button ${option.kind?.startsWith('allow') ? 'permission-button--allow' : ''}`}
                    bindtap={() => answerPermission(option.optionId)}
                  >
                    <text className="permission-button-text">{option.name}</text>
                  </view>
                ))}
                <view className="permission-button" bindtap={() => answerPermission()}><text className="permission-button-text">Cancel</text></view>
              </view>
            </view>
          ) : null}

          {!permission ? <view className="composer-wrap">
            {initialized ? <view className={`composer ${selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? 'composer--running' : ''}`}>
              {accessMenuOpen ? (
                <view className="composer-popover composer-popover--access">
                  <text className="composer-popover-title">Access</text>
                  {(modeOption?.options ?? []).map((option) => (
                    <view
                      key={option.value}
                      className={`composer-popover-option ${modeOption?.currentValue === option.value ? 'composer-popover-option--selected' : ''}`}
                      bindtap={() => {
                        setTaskConfigOption(modeOption!.id, option.value);
                        setAccessMenuOpen(false);
                      }}
                    >
                      <view className="composer-popover-option-copy">
                        <text className="composer-popover-option-name">{option.value === 'build' ? 'Full access' : option.value === 'plan' ? 'Plan mode' : option.name}</text>
                        {option.description ? <text className="composer-popover-option-detail" text-maxline="2">{option.description}</text> : null}
                      </view>
                      {modeOption?.currentValue === option.value ? <text className="composer-popover-check">✓</text> : null}
                    </view>
                  ))}
                </view>
              ) : null}
              {modelMenuOpen ? (
                <view className="composer-popover composer-popover--model">
                  <text className="composer-popover-title">Model</text>
                  <scroll-view scroll-y className="composer-popover-list">
                    {(selectedTask?.configOptions.find((option) => option.category === 'model' || option.id === 'model')?.options ?? []).map((option) => {
                      const model = selectedTask?.configOptions.find((item) => item.category === 'model' || item.id === 'model');
                      return (
                        <view
                          key={option.value}
                          className={`composer-popover-option ${model?.currentValue === option.value ? 'composer-popover-option--selected' : ''}`}
                          bindtap={() => {
                            if (model) setTaskConfigOption(model.id, option.value);
                            setModelMenuOpen(false);
                          }}
                        >
                          <text className="composer-popover-option-name" text-maxline="1">{option.name}</text>
                          {model?.currentValue === option.value ? <text className="composer-popover-check">✓</text> : null}
                        </view>
                      );
                    })}
                  </scroll-view>
                </view>
              ) : null}
              <input
                key={`composer-${composerInputKey}`}
                {...({ value: prompt } as any)}
                className="composer-input"
                placeholder={selectedTask ? `Message ${selectedBackend?.label ?? 'agent'}` : 'Create a task to begin'}
                bindinput={(event: any) => setPrompt(readInputValue(event))}
                bindconfirm={submit}
              />
              <view className="composer-toolbar">
                <view className="composer-tool"><text className="composer-tool-text">＋</text></view>
                <view className="composer-access" bindtap={() => {
                  setAccessMenuOpen((open) => !open);
                  setModelMenuOpen(false);
                }}><text className="composer-access-icon">◉</text><text className="composer-access-text">{accessLabel}</text></view>
                <view className="composer-toolbar-spacer" />
                <view className="composer-model" bindtap={() => {
                  setModelMenuOpen((open) => !open);
                  setAccessMenuOpen(false);
                }}>
                  <text className="composer-model-bolt">ϟ</text>
                  <text className="composer-model-text" text-maxline="1">{modelLabel}</text>
                  <text className="composer-model-chevron">⌄</text>
                </view>
                <view className="composer-mic"><text className="composer-mic-text">♩</text></view>
                {selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? (
                  <view className="send-button send-button--stop" bindtap={cancel}><view className="stop-square" /></view>
                ) : (
                  <view className={`send-button ${prompt.trim() && selectedTask ? 'send-button--ready' : ''}`} bindtap={submit}><text className="send-arrow">↑</text></view>
                )}
              </view>
            </view> : <view className="composer-loading-space" />}
          </view> : null}
        </view>

        {previewOpen ? <view className="preview-panel">
          {previewAddMenuOpen ? (
            <view className="preview-add-menu">
              <text className="preview-add-menu-title">Open panel</text>
              <view className="preview-add-menu-item" bindtap={openAgents}><text className="preview-add-menu-icon">♙</text><text className="preview-add-menu-text">Agents</text></view>
              <view className="preview-add-menu-item" bindtap={openReview}><text className="preview-add-menu-icon">▣</text><text className="preview-add-menu-text">Review changes</text></view>
              <view className="preview-add-menu-item" bindtap={browseCode}><text className="preview-add-menu-icon">◆</text><text className="preview-add-menu-text">Browse code</text></view>
            </view>
          ) : null}
          {activePreviewTab.kind === 'review' ? (
            <view className="review-workbench">
              <view className="review-toolbar">
                <view className="review-turn-selector">
                  <text className="review-turn-text">Last turn</text>
                  <text className="review-turn-chevron">⌄</text>
                </view>
                <view className="review-toolbar-totals">
                  <text className="review-toolbar-add">+{review.additions}</text>
                  <text className="review-toolbar-delete">−{review.deletions}</text>
                </view>
                <view className="review-toolbar-spacer" />
                <view className="review-tool-button"><text className="review-tool-icon">•••</text></view>
                <view className="review-tool-button"><text className="review-tool-icon">↕</text></view>
                <view className="review-tool-button"><text className="review-tool-icon">⌕</text></view>
                <view className="review-tool-button"><text className="review-tool-icon">◫</text></view>
                <view className="review-tool-button" bindtap={() => void refreshReview(true)}><text className="review-tool-icon">↻</text></view>
              </view>
              <view className="review-diff-scroll">
                <ReviewDiffList
                  files={review.files}
                  diffs={diffs}
                  loading={reviewLoading}
                  onOpenFile={openFilePreview}
                  onLoadDiff={loadReviewDiff}
                />
              </view>
              {reviewError ? <view className="preview-error"><text className="preview-error-text selectable-text" text-selection={true} flatten={false}>{reviewError}</text></view> : null}
            </view>
          ) : null}

          {activePreviewTab.id === AGENTS_TAB.id ? (
            <view className="agents-workbench">
              <view className="agents-toolbar">
                <text className="agents-toolbar-title">Agents</text>
                <view className="agents-toolbar-spacer" />
                <view className="agents-toolbar-action" bindtap={browseCode}><text className="agents-toolbar-action-text">◆</text></view>
                <view className="agents-toolbar-action" bindtap={() => void refreshReview(false)}><text className="agents-toolbar-action-text">↻</text></view>
              </view>
              <scroll-view scroll-y className="agents-scroll">
                {selectedTask ? (
                  <view className="agent-primary-card">
                    <view className="agent-primary-heading">
                      <view className="agent-avatar"><text className="agent-avatar-text">AI</text></view>
                      <view className="agent-primary-copy">
                        <text className="agent-primary-name">{selectedBackend?.label ?? 'Agent'}</text>
                        <text className="agent-primary-model" text-maxline="1">{modelLabel}</text>
                      </view>
                      <view className={`agent-status agent-status--${selectedTask.status}`}><view className="agent-status-dot" /><text className="agent-status-text">{selectedTask.status}</text></view>
                    </view>
                    <text className="agent-task-title" text-maxline="2">{selectedTask.title}</text>
                    <view className="agent-meta-row"><text className="agent-meta-label">Workspace</text><text className="agent-meta-value" text-maxline="1">{workspaceName}</text></view>
                    <view className="agent-meta-row"><text className="agent-meta-label">Session</text><text className="agent-meta-value" text-maxline="1">{selectedTask.sessionId}</text></view>
                    <view className="agent-card-actions">
                      {selectedTask.status === 'running' || selectedTask.status === 'waiting' ? <view className="agent-card-button agent-card-button--stop" bindtap={cancel}><text className="agent-card-button-text agent-card-button-text--stop">Stop</text></view> : null}
                      <view className="agent-card-button" bindtap={openReview}><text className="agent-card-button-text">Review</text></view>
                      <view className="agent-card-button" bindtap={browseCode}><text className="agent-card-button-text">Open code</text></view>
                    </view>
                  </view>
                ) : <text className="agents-empty">Create a task to start an agent.</text>}

                <view className="agents-section">
                  <text className="agents-section-title">ACTIVITY</text>
                  {agentActivities.length ? agentActivities.map((activity) => (
                    <view className="agent-activity" key={activity.id}>
                      <view className={`agent-activity-icon agent-activity-icon--${activity.kind}`}><text className="agent-activity-icon-text">{activity.kind === 'tool' ? '›_' : activity.kind === 'plan' ? '✓' : '◌'}</text></view>
                      <view className="agent-activity-copy">
                        <text className="agent-activity-title" text-maxline="1">{activity.tool?.title ?? (activity.kind === 'plan' ? 'Updated plan' : 'Reasoning')}</text>
                        <text className="agent-activity-detail" text-maxline="2">{activity.tool?.text ?? activity.text ?? activity.plan?.[0]?.content ?? ''}</text>
                      </view>
                    </view>
                  )) : <text className="agents-section-empty">Activity appears here while the agent works.</text>}
                </view>

                <view className="agents-section">
                  <view className="agents-section-heading"><text className="agents-section-title">CHANGED FILES</text><text className="agents-section-count">{review.files.length}</text></view>
                  {review.files.slice(0, 8).map((file) => (
                    <view className="agent-file-row" key={file.path} bindtap={() => openFilePreview(file.path)}>
                      <text className={`agent-file-status agent-file-status--${file.status}`}>{statusBadge(file)}</text>
                      <text className="agent-file-path" text-maxline="1">{file.path}</text>
                      <text className="agent-file-add">+{file.additions}</text><text className="agent-file-delete">−{file.deletions}</text>
                    </view>
                  ))}
                  {!review.files.length ? <text className="agents-section-empty">No workspace changes.</text> : null}
                </view>

                <view className="agents-section agents-section--sessions">
                  <text className="agents-section-title">RECENT SESSIONS</text>
                  {workspaceTasks.map((task) => (
                    <view className={`agent-session-row ${task.id === selectedTaskId ? 'agent-session-row--selected' : ''}`} key={task.id} bindtap={() => selectTask(task)}>
                      <view className={`agent-session-dot agent-session-dot--${task.status}`} />
                      <text className="agent-session-title" text-maxline="1">{task.title}</text>
                      <text className="agent-session-time">{relativeTime(task.updatedAt)}</text>
                    </view>
                  ))}
                </view>
              </scroll-view>
            </view>
          ) : null}

          {activePreviewTab.kind === 'file' && activePreviewTab.resource ? (
            <view className="code-workbench">
              {codeOpenMenuOpen ? (
                <view className="code-open-menu">
                  <view className="code-open-menu-item" bindtap={() => openActiveFileExternally('open')}><text className="code-open-menu-icon">↗</text><text className="code-open-menu-text">Open in default app</text></view>
                  <view className="code-open-menu-item" bindtap={() => openActiveFileExternally('reveal')}><text className="code-open-menu-icon">◇</text><text className="code-open-menu-text">Reveal in Finder</text></view>
                </view>
              ) : null}
              <view className="code-toolbar">
                <scroll-view scroll-x className="code-breadcrumb-scroll">
                  <view className="code-breadcrumbs">
                    <text className="code-breadcrumb code-breadcrumb--root">{fileName(workspaceSnapshot.root || selectedTask?.cwd || 'Workspace')}</text>
                    {activePreviewTab.resource.split('/').map((segment, index, segments) => (
                      <view className="code-breadcrumb-part" key={`${index}:${segment}`}>
                        <text className="code-breadcrumb-chevron">›</text>
                        <text className={`code-breadcrumb ${index === segments.length - 1 ? 'code-breadcrumb--active' : ''}`}>{segment}</text>
                      </view>
                    ))}
                  </view>
                </scroll-view>
                <view className={`code-tool-button ${fileTreeOpen ? 'code-tool-button--active' : ''}`} bindtap={() => {
                  setFileTreeOpen((open) => !open);
                  if (!workspaceSnapshot.files.length) void loadWorkspaceSnapshot();
                }}><text className="code-tool-button-text">▱</text></view>
                <view className="code-open-button" bindtap={() => openActiveFileExternally('open')}><text className="code-open-icon">▣</text><text className="code-open-text">Open</text></view>
                <view className={`code-tool-button ${codeOpenMenuOpen ? 'code-tool-button--active' : ''}`} bindtap={() => setCodeOpenMenuOpen((open) => !open)}><text className="code-open-chevron">⌄</text></view>
              </view>
              <view className="code-body">
                <view className="code-editor">
                  <CodeFileView
                    preview={activeFilePreview}
                    selectedLine={selectedCodeLines[activePreviewTab.resource]}
                    onSelectLine={(line) => setSelectedCodeLines((current) => ({ ...current, [activePreviewTab.resource!]: line }))}
                  />
                </view>
                {fileTreeOpen ? (
                  <view className="code-file-tree">
                    <view className="code-tree-search">
                      <text className="code-tree-search-icon">⌕</text>
                      <input
                        {...({ value: fileTreeFilter } as any)}
                        className="code-tree-search-input"
                        placeholder="Filter files…"
                        bindinput={(event: any) => setFileTreeFilter(readInputValue(event))}
                      />
                    </view>
                    {workspaceLoading ? <text className="code-tree-status">Loading files…</text> : null}
                    <list className="code-tree-list" scroll-orientation="vertical" list-type="single" enable-scroll={true} preload-buffer-count={12}>
                      {workspaceRows.map((row) => (
                        <list-item key={row.path} item-key={row.path} className={`code-tree-row ${activePreviewTab.resource === row.path ? 'code-tree-row--active' : ''}`} estimated-main-axis-size-px={24}>
                          <view className="code-tree-row-inner" style={{ paddingLeft: `${8 + row.depth * 15}px` }} bindtap={() => {
                            if (row.kind === 'directory') setExpandedDirectories((current) => ({ ...current, [row.path]: !current[row.path] }));
                            else void openFilePreview(row.path);
                          }}>
                            <text className="code-tree-disclosure">{row.kind === 'directory' ? expandedDirectories[row.path] || fileTreeFilter ? '⌄' : '›' : ''}</text>
                            <text className={`code-tree-icon code-tree-icon--${row.kind}`}>{row.kind === 'directory' ? '◇' : '◆'}</text>
                            <text className="code-tree-name" text-maxline="1">{row.name}</text>
                          </view>
                        </list-item>
                      ))}
                    </list>
                    {workspaceSnapshot.truncated ? <text className="code-tree-status">Showing the first 5,000 files.</text> : null}
                  </view>
                ) : null}
              </view>
              {workspaceError ? <view className="preview-error"><text className="preview-error-text selectable-text" text-selection={true} flatten={false}>{workspaceError}</text></view> : null}
            </view>
          ) : null}
        </view> : null}
      </view>

      {sidebarSearchOpen ? (
        <view className="sidebar-search-overlay">
          <view className="sidebar-search-dialog">
            <view className="sidebar-search-header">
              <view className="sidebar-search-field-icon"><view className="search-icon-ring" /><view className="search-icon-handle" /></view>
              <input
                {...({ value: sidebarSearchQuery } as any)}
                className="sidebar-search-input"
                placeholder="Search tasks"
                bindinput={(event: any) => setSidebarSearchQuery(readInputValue(event))}
              />
              <view className="sidebar-search-close" bindtap={() => setSidebarSearchOpen(false)}><text className="sidebar-search-close-text">×</text></view>
            </view>
            <text className="sidebar-search-label">TASKS</text>
            <scroll-view scroll-y className="sidebar-search-results">
              {sidebarSearchResults.map((task) => (
                <view className="sidebar-search-result" key={task.id} bindtap={() => {
                  setSidebarSearchOpen(false);
                  void selectTask(task);
                }}>
                  <view className={`sidebar-search-status sidebar-search-status--${task.status}`} />
                  <view className="sidebar-search-result-copy">
                    <text className="sidebar-search-result-title" text-maxline="1">{task.title}</text>
                    <text className="sidebar-search-result-path" text-maxline="1">{shortPath(task.cwd)}</text>
                  </view>
                </view>
              ))}
              {!sidebarSearchResults.length ? <text className="sidebar-search-empty">No matching tasks</text> : null}
            </scroll-view>
          </view>
        </view>
      ) : null}
    </view>
  );
}
