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
  ToolItem,
} from '../shared/agent';
import './App.css';

type TimelineKind = 'user' | 'assistant' | 'reasoning' | 'tool' | 'plan' | 'error';

interface TimelineItem {
  id: string;
  kind: TimelineKind;
  text?: string;
  tool?: ToolItem;
  plan?: PlanEntry[];
}

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

const readInputValue = (event: any): string => event?.detail?.value ?? event?.value ?? '';

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

function DiffRow({ line }: { line: DiffLine }) {
  const displayLine = line.kind === 'deletion' ? line.oldLine : (line.newLine ?? line.oldLine);
  return (
    <view className={`diff-line diff-line--${line.kind}`}>
      <text className="diff-line-number">{displayLine === undefined ? '' : String(displayLine)}</text>
      <text className="diff-line-marker">{line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '−' : ' '}</text>
      <text className="diff-line-code selectable-text" text-selection={true} flatten={false}>{line.text || ' '}</text>
    </view>
  );
}

function ReviewFileSection({ file, diff }: { file: ChangedFile; diff?: FileDiff }) {
  return (
    <view className="review-file-section">
      <view className="review-file-heading">
        <view className={`review-file-type review-file-type--${file.status}`}>
          <text className="review-file-type-text">{extensionBadge(file.path)}</text>
        </view>
        <text className="review-file-path selectable-text" text-maxline="1" text-selection={true} flatten={false}>{file.path}</text>
        <view className="review-file-counts">
          <text className="review-file-add">+{diff?.additions ?? file.additions}</text>
          <text className="review-file-delete">−{diff?.deletions ?? file.deletions}</text>
        </view>
      </view>
      {!diff ? <text className="review-file-loading">Loading file changes…</text> : null}
      {diff?.binary ? (
        <view className="review-file-empty"><text className="review-file-empty-text">Binary file changed</text></view>
      ) : null}
      {diff && !diff.binary && diff.lines.length === 0 ? (
        <view className="review-file-empty"><text className="review-file-empty-text">No text diff available</text></view>
      ) : null}
      {(diff?.lines ?? []).map((line, index) => <DiffRow key={`${file.path}-${index}-${line.kind}`} line={line} />)}
      {diff?.truncated ? (
        <view className="diff-truncated"><text className="diff-truncated-text">Diff truncated after 4,000 lines.</text></view>
      ) : null}
    </view>
  );
}

function mergeText(items: TimelineItem[], event: AgentEvent, kind: TimelineKind): TimelineItem[] {
  const id = `${kind}:${event.messageId ?? event.cursor}`;
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items, { id, kind, text: event.text ?? '' }];
  const next = [...items];
  next[index] = { ...next[index], text: `${next[index].text ?? ''}${event.text ?? ''}` };
  return next;
}

function MessageCard({ item }: { item: TimelineItem }) {
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
        <view className="reasoning-dot" />
        <text className="reasoning-text selectable-text" text-selection={true} flatten={false}>{item.text}</text>
      </view>
    );
  }
  if (item.kind === 'tool' && item.tool) {
    const status = item.tool.status ?? 'pending';
    return (
      <view className="tool-card">
        <view className={`tool-icon tool-icon--${status}`}><text className="tool-icon-text">›_</text></view>
        <view className="tool-body">
          <view className="tool-heading">
            <text className="tool-title">{item.tool.title}</text>
            <text className={`tool-status tool-status--${status}`}>{status.replace('_', ' ')}</text>
          </view>
          {item.tool.text ? <text className="tool-output selectable-text" text-maxline="6" text-selection={true} flatten={false}>{item.tool.text}</text> : null}
        </view>
      </view>
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
      <text className="assistant-text selectable-text" text-selection={true} flatten={false}>{item.text}</text>
    </view>
  );
}

export function App() {
  const [backends, setBackends] = useState<BackendInfo[]>([]);
  const [backendId, setBackendId] = useState('opencode');
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [composerInputKey, setComposerInputKey] = useState(0);
  const [permission, setPermission] = useState<PermissionRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [review, setReview] = useState<ReviewSnapshot>(EMPTY_REVIEW);
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>(INITIAL_PREVIEW_TABS);
  const [activePreviewTabId, setActivePreviewTabId] = useState(REVIEW_TAB.id);
  const [diffs, setDiffs] = useState<Record<string, FileDiff>>({});
  const seenCursors = useRef(new Set<number>());
  const selectedTaskIdRef = useRef('');
  const reviewSignatureRef = useRef('');

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

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

  const modelLabel = useMemo(() => {
    const model = selectedTask?.configOptions.find((option) => option.category === 'model' || option.id === 'model');
    if (!model) return selectedBackend?.label ?? 'Agent';
    return model.options?.find((option) => option.value === model.currentValue)?.name
      ?? String(model.currentValue ?? model.name);
  }, [selectedTask, selectedBackend]);

  const applyEvent = useCallback((event: AgentEvent) => {
    if (seenCursors.current.has(event.cursor)) return;
    seenCursors.current.add(event.cursor);

    if (event.task) {
      setTasks((current) => {
        const without = current.filter((task) => task.id !== event.task!.id);
        return [event.task!, ...without].sort((a, b) => b.updatedAt - a.updatedAt);
      });
    } else if (event.taskId && event.status) {
      setTasks((current) => current.map((task) => task.id === event.taskId
        ? { ...task, status: event.status!, updatedAt: event.at }
        : task));
    }

    if (!event.taskId || event.taskId !== selectedTaskIdRef.current) return;
    switch (event.type) {
      case 'user-message':
        setItems((current) => mergeText(current, event, 'user'));
        break;
      case 'message-delta':
        setItems((current) => mergeText(current, event, 'assistant'));
        break;
      case 'reasoning-delta':
        setItems((current) => mergeText(current, event, 'reasoning'));
        break;
      case 'tool':
        if (event.tool) {
          setItems((current) => {
            const id = `tool:${event.tool!.toolCallId}`;
            const index = current.findIndex((item) => item.id === id);
            if (index < 0) return [...current, { id, kind: 'tool', tool: event.tool }];
            const next = [...current];
            next[index] = { ...next[index], tool: { ...next[index].tool, ...event.tool } as ToolItem };
            return next;
          });
        }
        break;
      case 'plan':
        setItems((current) => [...current.filter((item) => item.id !== 'plan'), { id: 'plan', kind: 'plan', plan: event.plan }]);
        break;
      case 'permission':
        setPermission(event.permission ?? null);
        break;
      case 'permission-resolved':
        setPermission(null);
        break;
      case 'error':
        setItems((current) => [...current, { id: `error:${event.cursor}`, kind: 'error', text: event.error }]);
        setError(event.error ?? 'Agent error');
        break;
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const snapshot = await callBridge<EventSnapshot>('agent:eventsSince', { cursor: 0 });
    snapshot.events.forEach(applyEvent);
  }, [applyEvent]);

  const resetPreviews = useCallback(() => {
    setPreviewTabs(INITIAL_PREVIEW_TABS);
    setActivePreviewTabId(REVIEW_TAB.id);
    setDiffs({});
    setReview(EMPTY_REVIEW);
    setReviewError('');
    reviewSignatureRef.current = '';
  }, []);

  const refreshReview = useCallback(async () => {
    const taskId = selectedTaskIdRef.current;
    if (!taskId) {
      setReview(EMPTY_REVIEW);
      return;
    }
    setReviewLoading(true);
    try {
      const snapshot = await callBridge<ReviewSnapshot>('review:snapshot', { taskId });
      if (selectedTaskIdRef.current !== taskId) return;
      setReview(snapshot);
      setReviewError('');
      const signature = snapshot.files
        .map((file) => `${file.path}:${file.status}:${file.additions}:${file.deletions}`)
        .join('|');
      if (signature !== reviewSignatureRef.current) {
        reviewSignatureRef.current = signature;
        const results = await Promise.all(snapshot.files.map(async (file) => {
          try {
            return await callBridge<FileDiff>('review:fileDiff', { taskId, path: file.path });
          } catch {
            return null;
          }
        }));
        if (selectedTaskIdRef.current !== taskId) return;
        const nextDiffs: Record<string, FileDiff> = {};
        for (const diff of results) {
          if (diff) nextDiffs[diff.path] = diff;
        }
        setDiffs(nextDiffs);
      }
    } catch (caught) {
      if (selectedTaskIdRef.current !== taskId) return;
      setReview(EMPTY_REVIEW);
      setReviewError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (selectedTaskIdRef.current === taskId) setReviewLoading(false);
    }
  }, []);

  const openReview = useCallback(() => {
    setPreviewTabs((current) => current.some((tab) => tab.id === REVIEW_TAB.id) ? current : [...current, REVIEW_TAB]);
    setActivePreviewTabId(REVIEW_TAB.id);
  }, []);

  const closePreviewTab = useCallback((tab: PreviewTab) => {
    if (!tab.closable) return;
    setPreviewTabs((current) => current.filter((candidate) => candidate.id !== tab.id));
    if (activePreviewTabId === tab.id) setActivePreviewTabId(AGENTS_TAB.id);
  }, [activePreviewTabId]);

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
      }
      await refreshSnapshot();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setInitialized(true);
    }
  }, [refreshSnapshot]);

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
    setError('');
    try {
      const task = await callBridge<AgentTask>('agent:startTask', { backendId, cwd: workspace });
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      selectedTaskIdRef.current = task.id;
      setSelectedTaskId(task.id);
      setItems([]);
      setPermission(null);
      resetPreviews();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [workspace, backendId, busy, resetPreviews]);

  const selectTask = useCallback(async (task: AgentTask) => {
    if (task.id === selectedTaskId) return;
    selectedTaskIdRef.current = task.id;
    setSelectedTaskId(task.id);
    setWorkspace(task.cwd);
    setItems([]);
    setPermission(null);
    setError('');
    resetPreviews();
    if (task.backendId === 'opencode') {
      try {
        await callBridge<AgentTask>('agent:loadTask', { taskId: task.id });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    }
    seenCursors.current.clear();
    await refreshSnapshot();
  }, [selectedTaskId, refreshSnapshot, resetPreviews]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!selectedTask || !text || selectedTask.status === 'running' || selectedTask.status === 'waiting') return;
    setError('');
    try {
      await callBridge('agent:prompt', { taskId: selectedTask.id, text });
      setPrompt('');
      setComposerInputKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [prompt, selectedTask]);

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

  useEffect(() => {
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const handler = (...args: unknown[]) => applyEvent(args[0] as AgentEvent);
    emitter.addListener('agent:event', handler);
    initialize();
    return () => emitter.removeListener('agent:event', handler);
  }, [applyEvent, initialize]);

  useEffect(() => {
    if (!selectedTaskId) return;
    refreshReview();
    if (selectedTask?.status !== 'running' && selectedTask?.status !== 'waiting') return;
    const timer = setInterval(refreshReview, 1_500);
    return () => clearInterval(timer);
  }, [selectedTaskId, selectedTask?.status, selectedTask?.updatedAt, refreshReview]);

  return (
    <view className="app-shell">
      <view className="titlebar">
        <view className="titlebar-sidebar">
          <view className="titlebar-tool-button titlebar-sidebar-toggle">
            <view className="sidebar-toggle-outline"><view className="sidebar-toggle-divider" /></view>
          </view>
          <view className="titlebar-tool-button"><view className="titlebar-chevron titlebar-chevron--back" /></view>
          <view className="titlebar-tool-button"><view className="titlebar-chevron titlebar-chevron--forward" /></view>
        </view>
        <view className="titlebar-thread">
          <view className="titlebar-folder"><view className="folder-glyph"><view className="folder-glyph-tab" /></view></view>
          <text className="titlebar-thread-title" text-maxline="1">{selectedTask?.title ?? 'New task'}</text>
          <text className="titlebar-more">•••</text>
          <view className="titlebar-thread-spacer" />
          <view className="titlebar-location" bindtap={chooseWorkspace}>
            <text className="titlebar-location-icon">▣</text>
            <text className="titlebar-location-text">Open</text>
            <text className="titlebar-location-chevron">⌄</text>
          </view>
          <view className="titlebar-controls"><text className="titlebar-controls-text">☷</text></view>
        </view>
        <view className="titlebar-preview">
          <scroll-view scroll-x className="preview-tab-scroll">
            <view className="preview-tab-list">
              {previewTabs.map((tab) => (
                <view key={tab.id} className={`preview-tab preview-tab--${tab.kind} ${activePreviewTab.id === tab.id ? 'preview-tab--active' : ''}`}>
                  <view className="preview-tab-target" bindtap={() => setActivePreviewTabId(tab.id)}>
                    <text className="preview-tab-icon">{tab.kind === 'review' ? '▣' : tab.id === 'agents' ? '♙' : '◇'}</text>
                    <text className="preview-tab-title" text-maxline="1">{tab.title}</text>
                  </view>
                  {tab.closable ? (
                    <view className="preview-tab-close" bindtap={() => closePreviewTab(tab)}><text className="preview-tab-close-text">×</text></view>
                  ) : null}
                </view>
              ))}
            </view>
          </scroll-view>
          <view className="preview-new-tab"><text className="preview-new-tab-text">＋</text></view>
          <view className="preview-layout"><text className="preview-layout-text">◧</text></view>
        </view>
      </view>

      <view className="workspace-shell">
        <view className="sidebar">
          <view className="sidebar-product-row">
            <view className="sidebar-product-title"><text className="sidebar-product-name">Codex</text><text className="sidebar-product-chevron">⌄</text></view>
            <view className="sidebar-product-actions">
              <view className="sidebar-action-button sidebar-search-icon"><view className="search-icon-ring" /><view className="search-icon-handle" /></view>
              <view className="sidebar-action-button sidebar-bell-icon"><view className="bell-icon-body" /><view className="bell-icon-dot" /></view>
            </view>
          </view>

          <view className="sidebar-new-task" bindtap={createTask}>
            <view className="sidebar-new-task-icon"><view className="new-task-icon-box" /><view className="new-task-icon-pencil" /></view>
            <text className="sidebar-new-task-text">New task</text>
          </view>

          {tasks[0] ? (
            <view className="sidebar-pinned">
              <text className="sidebar-section-title">PINNED</text>
              <view className={`sidebar-link ${selectedTaskId === tasks[0].id ? 'sidebar-link--active' : ''}`} bindtap={() => selectTask(tasks[0])}>
                <text className="sidebar-link-title" text-maxline="1">{tasks[0].title}</text>
              </view>
            </view>
          ) : null}

          <text className="sidebar-section-title sidebar-projects-title">PROJECTS</text>
          <scroll-view scroll-y className="sidebar-project-scroll">
            <view className="sidebar-project-heading" bindtap={chooseWorkspace}>
              <view className="sidebar-project-icon"><view className="folder-glyph"><view className="folder-glyph-tab" /></view></view>
              <text className="sidebar-project-name" text-maxline="1">{workspaceName}</text>
              <text className="sidebar-project-menu">•••</text>
            </view>
            {tasks.length === 0 ? <text className="empty-tasks">No tasks yet</text> : null}
            {tasks.map((task) => (
              <view
                key={task.id}
                className={`sidebar-task-link ${selectedTaskId === task.id ? 'sidebar-task-link--active' : ''}`}
                bindtap={() => selectTask(task)}
              >
                <view className="sidebar-task-title-row">
                  <text className="sidebar-task-link-title" text-maxline="2">{task.title}</text>
                  <text className="sidebar-task-time">{relativeTime(task.updatedAt)}</text>
                </view>
                <view className="sidebar-task-detail-row">
                  <view className={`task-state task-state--${task.status}`} />
                  <text className="sidebar-task-backend">{task.backendId}</text>
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
            {selectedTask && items.length === 0 ? (
              <view className="task-empty">
                <text className="task-empty-kicker">READY</text>
                <text className="task-empty-title">What should {selectedBackend?.label ?? 'the agent'} work on?</text>
                <text className="task-empty-copy">The agent can inspect this workspace, edit files, run commands, and ask before sensitive actions.</text>
              </view>
            ) : null}
            {items.map((item) => <MessageCard key={item.id} item={item} />)}
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
          </scroll-view>

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

          <view className="composer-wrap">
            {initialized ? <view className={`composer ${selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? 'composer--running' : ''}`}>
              <input
                key={`composer-${composerInputKey}`}
                className="composer-input"
                placeholder={selectedTask ? `Message ${selectedBackend?.label ?? 'agent'}` : 'Create a task to begin'}
                bindinput={(event: any) => setPrompt(readInputValue(event))}
                bindconfirm={submit}
              />
              <view className="composer-toolbar">
                <view className="composer-tool"><text className="composer-tool-text">＋</text></view>
                <view className="composer-access"><text className="composer-access-icon">◉</text><text className="composer-access-text">Full access</text></view>
                <view className="composer-toolbar-spacer" />
                <view className="composer-model" bindtap={cycleBackend}>
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
          </view>
        </view>

        <view className="preview-panel">
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
                <view className="review-tool-button" bindtap={refreshReview}><text className="review-tool-icon">↻</text></view>
              </view>
              <scroll-view scroll-y className="review-diff-scroll">
                {reviewLoading && review.files.length === 0 ? <text className="review-loading">Reading Git changes…</text> : null}
                {!reviewLoading && review.files.length === 0 ? (
                  <view className="review-empty">
                    <view className="review-empty-icon"><text className="review-empty-icon-text">±</text></view>
                    <text className="review-empty-title">No changes yet</text>
                    <text className="review-empty-copy">Changes in the selected task repository will appear here automatically.</text>
                  </view>
                ) : null}
                {review.files.map((file) => (
                  <ReviewFileSection key={file.path} file={file} diff={diffs[file.path]} />
                ))}
              </scroll-view>
              {reviewError ? <view className="preview-error"><text className="preview-error-text selectable-text" text-selection={true} flatten={false}>{reviewError}</text></view> : null}
            </view>
          ) : null}

          {activePreviewTab.kind !== 'review' ? (
            <view className="preview-placeholder">
              <view className="preview-placeholder-icon"><text className="preview-placeholder-icon-text">♙</text></view>
              <text className="preview-placeholder-title">{activePreviewTab.title}</text>
              <text className="preview-placeholder-copy">Agent previews and other tools can open alongside Review without changing the conversation.</text>
              {review.files.length ? <view className="preview-placeholder-action" bindtap={openReview}><text className="preview-placeholder-action-text">Open Review</text></view> : null}
            </view>
          ) : null}
        </view>
      </view>
    </view>
  );
}
