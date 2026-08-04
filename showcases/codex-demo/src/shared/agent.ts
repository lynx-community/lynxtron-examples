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

export interface BridgeResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
