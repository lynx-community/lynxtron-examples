export type BackendStatus = 'ready' | 'missing' | 'error';
export type TaskStatus = 'idle' | 'running' | 'waiting' | 'complete' | 'cancelled' | 'error';

export interface BackendInfo {
  id: string;
  label: string;
  description: string;
  transport: 'mock' | 'acp-stdio';
  status: BackendStatus;
  version?: string;
  command?: string;
  detail?: string;
}

export interface ConfigChoice {
  value: string;
  name: string;
  description?: string;
}

export interface ConfigOption {
  id: string;
  name: string;
  category?: string;
  type: string;
  currentValue?: string | boolean;
  options?: ConfigChoice[];
}

export interface AgentTask {
  id: string;
  backendId: string;
  sessionId: string;
  cwd: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: TaskStatus;
  configOptions: ConfigOption[];
  lastTurnChangedFiles?: string[];
}

export interface PermissionOption {
  optionId: string;
  name: string;
  kind?: string;
}

export interface PermissionRequest {
  requestId: string;
  title: string;
  toolCallId?: string;
  options: PermissionOption[];
}

export interface ToolItem {
  toolCallId: string;
  title: string;
  kind?: string;
  status?: string;
  text?: string;
  locations?: Array<{ path?: string; line?: number }>;
}

export interface PlanEntry {
  content: string;
  priority?: string;
  status?: string;
}

export interface AgentUsage {
  used?: number;
  size?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: { amount?: number; currency?: string };
}

export type AgentEventType =
  | 'task'
  | 'user-message'
  | 'message-delta'
  | 'reasoning-delta'
  | 'plan'
  | 'tool'
  | 'permission'
  | 'permission-resolved'
  | 'turn-state'
  | 'usage'
  | 'error';

export interface AgentEvent {
  cursor: number;
  at: number;
  type: AgentEventType;
  taskId?: string;
  messageId?: string;
  text?: string;
  task?: AgentTask;
  plan?: PlanEntry[];
  tool?: ToolItem;
  permission?: PermissionRequest;
  status?: TaskStatus;
  usage?: AgentUsage;
  error?: string;
  raw?: unknown;
}

export interface StartTaskInput {
  backendId: string;
  cwd: string;
}

export interface EventSnapshot {
  cursor: number;
  events: AgentEvent[];
}

export type TimelineKind = 'user' | 'assistant' | 'reasoning' | 'tool' | 'plan' | 'error';

export interface TimelineEntry {
  sequence: number;
  id: string;
  kind: TimelineKind;
  text?: string;
  tool?: ToolItem;
  plan?: PlanEntry[];
}

export interface TimelinePage {
  items: TimelineEntry[];
  before?: number;
  hasMore: boolean;
  total: number;
}

export type ChangedFileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'conflicted';

export interface ChangedFile {
  path: string;
  status: ChangedFileStatus;
  additions: number;
  deletions: number;
  staged: boolean;
  unstaged: boolean;
  /** Git-backed changes use `git`; agent-only changes include ignored files. */
  source?: 'git' | 'agent';
}

export interface ReviewSnapshot {
  root: string;
  files: ChangedFile[];
  additions: number;
  deletions: number;
}

export type DiffLineKind = 'context' | 'addition' | 'deletion' | 'hunk' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  root: string;
  path: string;
  status: ChangedFileStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  truncated: boolean;
  lines: DiffLine[];
}

export interface WorkspaceSnapshot {
  root: string;
  files: string[];
  truncated: boolean;
}

export interface WorkspaceFilePreview {
  root: string;
  path: string;
  content: string;
  language: string;
  size: number;
  binary: boolean;
  truncated: boolean;
}

export type PreviewKind =
  | 'review'
  | 'diff'
  | 'file'
  | 'terminal'
  | 'browser'
  | 'image'
  | 'custom';

export interface PreviewTab {
  id: string;
  kind: PreviewKind;
  title: string;
  resource?: string;
  closable: boolean;
}

export interface BridgeResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
