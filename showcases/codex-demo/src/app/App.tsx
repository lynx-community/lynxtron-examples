import { useCallback, useEffect, useMemo, useRef, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import type {
  AgentEvent,
  AgentTask,
  BackendInfo,
  BridgeResult,
  EventSnapshot,
  PermissionRequest,
  PlanEntry,
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

const inputValueProp = (value: string) => ({ value }) as any;
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
  const [permission, setPermission] = useState<PermissionRequest | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seenCursors = useRef(new Set<number>());
  const selectedTaskIdRef = useRef('');

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const selectedBackend = useMemo(
    () => backends.find((backend) => backend.id === (selectedTask?.backendId ?? backendId)) ?? null,
    [backends, selectedTask, backendId],
  );

  const changedFiles = useMemo(() => {
    const paths: string[] = [];
    for (const item of items) {
      for (const location of item.tool?.locations ?? []) {
        if (location.path && !paths.includes(location.path)) paths.push(location.path);
      }
    }
    return paths;
  }, [items]);

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [workspace, backendId, busy]);

  const selectTask = useCallback(async (task: AgentTask) => {
    if (task.id === selectedTaskId) return;
    selectedTaskIdRef.current = task.id;
    setSelectedTaskId(task.id);
    setWorkspace(task.cwd);
    setItems([]);
    setPermission(null);
    setError('');
    if (task.backendId === 'opencode') {
      try {
        await callBridge<AgentTask>('agent:loadTask', { taskId: task.id });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    }
    seenCursors.current.clear();
    await refreshSnapshot();
  }, [selectedTaskId, refreshSnapshot]);

  const submit = useCallback(async () => {
    const text = prompt.trim();
    if (!selectedTask || !text || selectedTask.status === 'running' || selectedTask.status === 'waiting') return;
    setPrompt('');
    setError('');
    try {
      await callBridge('agent:prompt', { taskId: selectedTask.id, text });
    } catch (caught) {
      setPrompt(text);
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

  useEffect(() => {
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const handler = (...args: unknown[]) => applyEvent(args[0] as AgentEvent);
    emitter.addListener('agent:event', handler);
    initialize();
    return () => emitter.removeListener('agent:event', handler);
  }, [applyEvent, initialize]);

  return (
    <view className="app-shell">
      <view className="titlebar">
        <text className="titlebar-name">Codex Demo</text>
        <view className="titlebar-center">
          <text className="titlebar-task" text-maxline="1">{selectedTask?.title ?? 'Agent-neutral workspace'}</text>
        </view>
        <view className="titlebar-spacer" />
      </view>

      <view className="workspace-shell">
        <view className="sidebar">
          <view className="sidebar-top">
            <view className="product-row">
              <view className="product-mark"><text className="product-mark-text">C</text></view>
              <text className="product-name">Codex</text>
            </view>
            <view className="new-task-button" bindtap={createTask}>
              <text className="new-task-plus">＋</text>
              <text className="new-task-text">New task</text>
            </view>
            <view className="workspace-button" bindtap={chooseWorkspace}>
              <text className="workspace-icon">⌁</text>
              <view className="workspace-copy">
                <text className="workspace-label">WORKSPACE</text>
                <text className="workspace-path" text-maxline="1">{shortPath(workspace)}</text>
              </view>
            </view>
          </view>

          <view className="backend-section">
            <text className="section-label">AGENT BACKEND</text>
            {backends.map((backend) => (
              <view
                key={backend.id}
                className={`backend-option ${backendId === backend.id ? 'backend-option--active' : ''} ${backend.status !== 'ready' ? 'backend-option--disabled' : ''}`}
                bindtap={() => backend.status === 'ready' && setBackendId(backend.id)}
              >
                <view className={`backend-dot backend-dot--${backend.status}`} />
                <view className="backend-copy">
                  <text className="backend-name">{backend.label}</text>
                  <text className="backend-version">{backend.status === 'ready' ? `v${backend.version}` : backend.status}</text>
                </view>
              </view>
            ))}
          </view>

          <text className="section-label tasks-label">TASKS</text>
          <scroll-view scroll-y className="task-list">
            {tasks.length === 0 ? <text className="empty-tasks">No tasks yet</text> : null}
            {tasks.map((task) => (
              <view
                key={task.id}
                className={`task-row ${selectedTaskId === task.id ? 'task-row--active' : ''}`}
                bindtap={() => selectTask(task)}
              >
                <view className="task-heading">
                  <text className="task-title" text-maxline="2">{task.title}</text>
                  <text className="task-time">{relativeTime(task.updatedAt)}</text>
                </view>
                <view className="task-meta">
                  <view className={`task-state task-state--${task.status}`} />
                  <text className="task-backend">{task.backendId}</text>
                </view>
              </view>
            ))}
          </scroll-view>

          <view className="sidebar-footer">
            <view className={`connection-dot connection-dot--${selectedBackend?.status ?? 'missing'}`} />
            <text className="connection-text">{selectedBackend?.status === 'ready' ? `${selectedBackend.label} connected` : 'Backend unavailable'}</text>
          </view>
        </view>

        <view className="conversation">
          <view className="conversation-header">
            <view className="conversation-title-wrap">
              <text className="conversation-title" text-maxline="1">{selectedTask?.title ?? 'Start a new task'}</text>
              <text className="conversation-path" text-maxline="1">{selectedTask?.cwd ?? workspace}</text>
            </view>
            <view className="header-pills">
              <view className="header-pill"><text className="header-pill-text">{modelLabel}</text></view>
              {selectedTask ? <view className={`status-pill status-pill--${selectedTask.status}`}><text className="status-pill-text">{selectedTask.status}</text></view> : null}
            </view>
          </view>

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
            <view className={`composer ${selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? 'composer--running' : ''}`}>
              <input
                className="composer-input"
                placeholder={selectedTask ? `Message ${selectedBackend?.label ?? 'agent'}` : 'Create a task to begin'}
                {...inputValueProp(prompt)}
                bindinput={(event: any) => setPrompt(readInputValue(event))}
                bindconfirm={submit}
              />
              {selectedTask?.status === 'running' || selectedTask?.status === 'waiting' ? (
                <view className="send-button send-button--stop" bindtap={cancel}><view className="stop-square" /></view>
              ) : (
                <view className={`send-button ${prompt.trim() && selectedTask ? 'send-button--ready' : ''}`} bindtap={submit}><text className="send-arrow">↑</text></view>
              )}
            </view>
            <text className="composer-note">Agent actions run inside the selected workspace and follow backend permissions.</text>
          </view>
        </view>

        <view className="review-panel">
          <view className="review-header">
            <text className="review-title">Review</text>
            <view className="review-count"><text className="review-count-text">{changedFiles.length}</text></view>
          </view>
          <view className="review-summary">
            <text className="review-kicker">CHANGED FILES</text>
            <text className="review-copy">Files surfaced by the current agent task appear here.</text>
          </view>
          <scroll-view scroll-y className="file-list">
            {changedFiles.length === 0 ? (
              <view className="review-empty">
                <view className="review-empty-icon"><text className="review-empty-icon-text">±</text></view>
                <text className="review-empty-title">No changes yet</text>
                <text className="review-empty-copy">Tool calls and file locations will be collected as the agent works.</text>
              </view>
            ) : null}
            {changedFiles.map((file) => (
              <view className="file-row" key={file}>
                <view className="file-badge"><text className="file-badge-text">M</text></view>
                <text className="file-path" text-maxline="2">{file}</text>
              </view>
            ))}
          </scroll-view>
          <view className="review-footer">
            <text className="review-footer-label">BACKEND</text>
            <text className="review-footer-value">{selectedBackend?.label ?? '—'}</text>
            <text className="review-footer-detail">{selectedBackend?.transport ?? ''}</text>
          </view>
        </view>
      </view>
    </view>
  );
}
