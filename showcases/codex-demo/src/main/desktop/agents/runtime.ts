import { randomUUID } from 'crypto';
import path from 'path';
import type {
  AgentEvent,
  AgentTask,
  BackendInfo,
  ConfigOption,
  EventSnapshot,
  PermissionRequest,
  PlanEntry,
  FileDiff,
  ReviewSnapshot,
  StartTaskInput,
  TaskStatus,
  TimelineEntry,
  TimelineKind,
  TimelinePage,
  ToolItem,
  WorkspaceFilePreview,
  WorkspaceSnapshot,
} from '../../../shared/agent';
import { AcpClient, type AcpServerRequest } from './acp-client';
import { probeOpenCode } from './opencode-discovery';
import { ReviewService } from './review-service';
import { TaskStore } from './task-store';
import { WorkspaceService } from './workspace-service';

type Emit = (event: AgentEvent) => void;

interface PendingPermission {
  client: AcpClient;
  sessionId: string;
  taskId: string;
  rpcRequestId: string | number;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n');
  const record = asRecord(value);
  if (typeof record.text === 'string') return record.text;
  if (record.content !== undefined) return extractText(record.content);
  if (record.output !== undefined) return extractText(record.output);
  return '';
}

function normalizeTool(update: Record<string, any>): ToolItem {
  return {
    toolCallId: String(update.toolCallId ?? randomUUID()),
    title: String(update.title ?? update.kind ?? 'Tool call'),
    kind: typeof update.kind === 'string' ? update.kind : undefined,
    status: typeof update.status === 'string' ? update.status : undefined,
    text: extractText(update.content),
    locations: Array.isArray(update.locations)
      ? update.locations.map((item: any) => ({ path: item.path, line: item.line }))
      : undefined,
  };
}

export class AgentRuntime {
  private readonly tasks = new Map<string, AgentTask>();
  private readonly sessionToTask = new Map<string, string>();
  private readonly permissions = new Map<string, PendingPermission>();
  private readonly lastUserMessageByTask = new Map<string, string>();
  private readonly eventBuffer: AgentEvent[] = [];
  private readonly timelineByTask = new Map<string, TimelineEntry[]>();
  private readonly suppressReplayForTasks = new Set<string>();
  private readonly loadedSessions = new Set<string>();
  private readonly reviewSnapshots = new Map<string, ReviewSnapshot>();
  private cursor = 0;
  private timelineSequence = 0;
  private openCodeClient: AcpClient | null = null;
  private openCodeInfo: BackendInfo | null = null;
  private readonly reviewService = new ReviewService();
  private readonly workspaceService = new WorkspaceService();

  constructor(
    private readonly store: TaskStore,
    private readonly emitToWindow: Emit,
    private readonly openCodeConfigDir = path.join(__dirname, 'opencode'),
    private readonly computerUseBin = '',
    initialOpenCodeInfo?: BackendInfo,
  ) {
    this.openCodeInfo = initialOpenCodeInfo ?? null;
    for (const stored of store.load()) {
      const task = { ...stored, status: 'idle' as TaskStatus };
      this.tasks.set(task.id, task);
    }
  }

  listBackends(): BackendInfo[] {
    const openCode = this.openCodeInfo?.status === 'ready' ? this.openCodeInfo : probeOpenCode();
    this.openCodeInfo = openCode;
    return [
      {
        id: 'mock',
        label: 'Demo Agent',
        description: 'Credential-free replay backend for UI validation',
        transport: 'mock',
        status: 'ready',
        version: '1',
      },
      openCode,
    ];
  }

  listTasks(): AgentTask[] {
    return [...this.tasks.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  eventsSince(cursor: number): EventSnapshot {
    return {
      cursor: this.cursor,
      events: this.eventBuffer.filter((event) => event.cursor > cursor),
    };
  }

  timelinePage(taskId: string, before?: number, limit = 50): TimelinePage {
    this.requireTask(taskId);
    const timeline = this.timelineByTask.get(taskId) ?? [];
    const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit) || 50));
    const eligible = before === undefined
      ? timeline
      : timeline.filter((entry) => entry.sequence < before);
    const items = eligible.slice(Math.max(0, eligible.length - boundedLimit)).map((entry) => ({ ...entry }));
    const hasMore = eligible.length > items.length;
    return {
      items,
      before: hasMore ? items[0]?.sequence : undefined,
      hasMore,
      total: timeline.length,
    };
  }

  workspaceSnapshot(taskId: string): WorkspaceSnapshot {
    return this.workspaceService.snapshot(this.requireTask(taskId).cwd);
  }

  workspaceFile(taskId: string, requestedPath: string): WorkspaceFilePreview {
    return this.workspaceService.readFile(this.requireTask(taskId).cwd, requestedPath);
  }

  workspaceFilePath(taskId: string, requestedPath: string): string {
    return this.workspaceService.filePath(this.requireTask(taskId).cwd, requestedPath);
  }

  async reviewSnapshot(taskId: string): Promise<ReviewSnapshot> {
    const task = this.requireTask(taskId);
    const snapshot = await this.reviewService.snapshot(task.cwd, task.lastTurnChangedFiles ?? []);
    this.reviewSnapshots.set(taskId, snapshot);
    return snapshot;
  }

  async fileDiff(taskId: string, path: string): Promise<FileDiff> {
    const task = this.requireTask(taskId);
    const file = this.reviewSnapshots.get(taskId)?.files.find((candidate) => candidate.path === path);
    return this.reviewService.fileDiff(task.cwd, path, file);
  }

  async startTask(input: StartTaskInput): Promise<AgentTask> {
    if (!input.cwd || !input.cwd.startsWith('/')) throw new Error('Choose an absolute workspace path.');
    if (input.backendId === 'mock') return this.startMockTask(input.cwd);
    if (input.backendId !== 'opencode') throw new Error(`Unknown backend: ${input.backendId}`);

    const client = await this.ensureOpenCode(input.cwd);
    const response = asRecord(await client.newSession(input.cwd));
    const now = Date.now();
    const task: AgentTask = {
      id: randomUUID(),
      backendId: 'opencode',
      sessionId: String(response.sessionId),
      cwd: input.cwd,
      title: 'New OpenCode task',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      configOptions: Array.isArray(response.configOptions) ? response.configOptions as ConfigOption[] : [],
    };
    this.tasks.set(task.id, task);
    this.sessionToTask.set(task.sessionId, task.id);
    this.loadedSessions.add(task.sessionId);
    this.persist();
    this.push({ type: 'task', taskId: task.id, task: { ...task } });
    return task;
  }

  async loadTask(taskId: string): Promise<AgentTask> {
    const task = this.requireTask(taskId);
    if (task.backendId === 'mock') return task;
    if (this.loadedSessions.has(task.sessionId)) return task;
    const client = await this.ensureOpenCode(task.cwd);
    this.sessionToTask.set(task.sessionId, task.id);
    task.lastTurnChangedFiles = [];
    this.lastUserMessageByTask.delete(task.id);
    this.timelineByTask.set(task.id, []);
    this.suppressReplayForTasks.add(task.id);
    let response: Record<string, any>;
    try {
      response = asRecord(await client.loadSession(task.sessionId, task.cwd));
    } finally {
      this.suppressReplayForTasks.delete(task.id);
    }
    if (Array.isArray(response.configOptions)) task.configOptions = response.configOptions as ConfigOption[];
    this.loadedSessions.add(task.sessionId);
    task.status = 'idle';
    task.updatedAt = Date.now();
    this.persist();
    this.push({ type: 'task', taskId, task: { ...task } });
    return task;
  }

  startPrompt(taskId: string, text: string): void {
    const prompt = text.trim();
    if (!prompt) throw new Error('Prompt cannot be empty.');
    const task = this.requireTask(taskId);
    if (task.status === 'running' || task.status === 'waiting') throw new Error('This task is already running.');

    if (task.title === 'New OpenCode task' || task.title === 'New task' || (
      task.backendId === 'mock' && (this.timelineByTask.get(task.id)?.length ?? 0) === 0
    )) {
      task.title = prompt.split('\n')[0].slice(0, 56);
      task.updatedAt = Date.now();
      this.persist();
      this.push({ type: 'task', taskId, task: { ...task } });
    }
    task.lastTurnChangedFiles = [];
    this.persist();
    this.setTaskStatus(task, 'running');
    this.push({
      type: 'user-message',
      taskId,
      messageId: randomUUID(),
      text: prompt,
    });

    if (task.backendId === 'mock') {
      void this.runMockPrompt(task, prompt);
      return;
    }

    void this.runOpenCodePrompt(task, prompt);
  }

  cancel(taskId: string): void {
    const task = this.requireTask(taskId);
    if (task.backendId === 'opencode') this.openCodeClient?.cancel(task.sessionId);
    for (const [requestId, permission] of this.permissions) {
      if (permission.taskId !== taskId) continue;
      permission.client.respondPermission(permission.rpcRequestId);
      this.permissions.delete(requestId);
    }
    this.setTaskStatus(task, 'cancelled');
  }

  respondPermission(requestId: string, optionId?: string): void {
    const permission = this.permissions.get(requestId);
    if (!permission) throw new Error('Permission request is no longer active.');
    permission.client.respondPermission(permission.rpcRequestId, optionId);
    this.permissions.delete(requestId);
    this.push({ type: 'permission-resolved', taskId: permission.taskId, text: optionId ?? 'cancelled' });
    const task = this.tasks.get(permission.taskId);
    if (task) this.setTaskStatus(task, 'running');
  }

  async setConfigOption(taskId: string, configId: string, value: string | boolean): Promise<ConfigOption[]> {
    const task = this.requireTask(taskId);
    if (task.backendId !== 'opencode') return task.configOptions;
    const client = await this.ensureOpenCode(task.cwd);
    const response = asRecord(await client.setConfigOption(task.sessionId, configId, value));
    if (Array.isArray(response.configOptions)) task.configOptions = response.configOptions as ConfigOption[];
    task.updatedAt = Date.now();
    this.persist();
    this.push({ type: 'task', taskId, task: { ...task } });
    return task.configOptions;
  }

  dispose(): void {
    this.openCodeClient?.dispose();
    this.openCodeClient = null;
  }

  private startMockTask(cwd: string): AgentTask {
    const now = Date.now();
    const task: AgentTask = {
      id: randomUUID(),
      backendId: 'mock',
      sessionId: `mock-${randomUUID()}`,
      cwd,
      title: 'Explore the agent-neutral UI',
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      configOptions: [
        { id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: 'build', options: [
          { value: 'build', name: 'Build' },
          { value: 'plan', name: 'Plan' },
        ] },
      ],
    };
    this.tasks.set(task.id, task);
    this.persist();
    this.push({ type: 'task', taskId: task.id, task: { ...task } });
    return task;
  }

  private async runMockPrompt(task: AgentTask, prompt: string): Promise<void> {
    const messageId = randomUUID();
    const chunks = [
      'I’m running through the agent-neutral backend contract. ',
      'The UI receives the same normalized events it will receive from OpenCode ACP. ',
      `Your request was: “${prompt}”`,
    ];
    this.push({ type: 'reasoning-delta', taskId: task.id, messageId: `thought-${messageId}`, text: 'Checking workspace and composing a safe plan…' });
    this.push({ type: 'plan', taskId: task.id, plan: [
      { content: 'Inspect the selected workspace', status: 'completed' },
      { content: 'Exercise the normalized event stream', status: 'in_progress' },
      { content: 'Hand control back to the user', status: 'pending' },
    ] });
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (task.status === 'cancelled') return;
      this.push({ type: 'message-delta', taskId: task.id, messageId, text: chunk });
    }
    this.push({ type: 'usage', taskId: task.id, usage: { inputTokens: 128, outputTokens: 54, totalTokens: 182 } });
    this.setTaskStatus(task, 'complete');
  }

  private async runOpenCodePrompt(task: AgentTask, prompt: string): Promise<void> {
    try {
      const client = await this.ensureOpenCode(task.cwd);
      this.sessionToTask.set(task.sessionId, task.id);
      const result = asRecord(await client.prompt(task.sessionId, prompt));
      if (result.usage) this.push({ type: 'usage', taskId: task.id, usage: result.usage, raw: result });
      this.setTaskStatus(task, result.stopReason === 'cancelled' ? 'cancelled' : 'complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.push({ type: 'error', taskId: task.id, error: message });
      this.setTaskStatus(task, 'error');
    }
  }

  private async ensureOpenCode(cwd: string): Promise<AcpClient> {
    if (this.openCodeClient) return this.openCodeClient;
    const info = this.openCodeInfo?.status === 'ready' ? this.openCodeInfo : probeOpenCode();
    this.openCodeInfo = info;
    if (info.status !== 'ready' || !info.command) throw new Error(info.detail ?? 'OpenCode is not installed.');

    const client = new AcpClient({
      command: info.command,
      args: ['acp', '--pure'],
      cwd,
      env: {
        OPENCODE_CONFIG_DIR: this.openCodeConfigDir,
        CODEX_DEMO_COMPUTER_USE_BIN: this.computerUseBin,
      },
    });
    client.on('notification', (message) => this.handleNotification(message));
    client.on('request', (request: AcpServerRequest) => this.handleServerRequest(client, request));
    client.on('fatal', (error: Error) => {
      if (this.openCodeClient === client) this.openCodeClient = null;
      this.loadedSessions.clear();
      for (const task of this.tasks.values()) {
        if (task.backendId !== 'opencode' || task.status !== 'running') continue;
        this.push({ type: 'error', taskId: task.id, error: error.message });
        this.setTaskStatus(task, 'error');
      }
    });
    await client.initialize();
    this.openCodeClient = client;
    return client;
  }

  private handleNotification(message: any): void {
    if (message.method !== 'session/update') return;
    const params = asRecord(message.params);
    const update = asRecord(params.update);
    const taskId = this.sessionToTask.get(String(params.sessionId));
    if (!taskId) return;

    if (update.sessionUpdate === 'user_message_chunk' && update.messageId !== undefined) {
      const messageId = String(update.messageId);
      if (this.lastUserMessageByTask.get(taskId) !== messageId) {
        this.lastUserMessageByTask.set(taskId, messageId);
        const task = this.tasks.get(taskId);
        if (task) {
          task.lastTurnChangedFiles = [];
          this.persist();
        }
      }
    }
    if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      const task = this.tasks.get(taskId);
      if (task && Array.isArray(update.locations)) {
        const current = new Set(task.lastTurnChangedFiles ?? []);
        for (const location of update.locations) {
          if (location?.path) current.add(String(location.path));
        }
        task.lastTurnChangedFiles = [...current];
        this.persist();
      }
    }

    const base = { taskId, raw: update };
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        this.push({ ...base, type: 'message-delta', messageId: update.messageId, text: extractText(update.content) });
        break;
      case 'agent_thought_chunk':
        this.push({ ...base, type: 'reasoning-delta', messageId: update.messageId, text: extractText(update.content) });
        break;
      case 'user_message_chunk':
        this.push({ ...base, type: 'user-message', messageId: update.messageId, text: extractText(update.content) });
        break;
      case 'plan':
        this.push({ ...base, type: 'plan', plan: Array.isArray(update.entries) ? update.entries as PlanEntry[] : [] });
        break;
      case 'tool_call':
      case 'tool_call_update':
        this.push({ ...base, type: 'tool', tool: normalizeTool(update) });
        break;
      case 'usage_update':
        this.push({ ...base, type: 'usage', usage: { used: update.used, size: update.size, cost: update.cost } });
        break;
      case 'session_info_update': {
        const task = this.tasks.get(taskId);
        if (task && typeof update.title === 'string') {
          task.title = update.title;
          task.updatedAt = Date.now();
          this.persist();
          this.push({ type: 'task', taskId, task: { ...task }, raw: update });
        }
        break;
      }
    }
  }

  private handleServerRequest(client: AcpClient, request: AcpServerRequest): void {
    if (request.method !== 'session/request_permission') {
      client.respondError(request.id, -32601, `Unsupported client method: ${request.method}`);
      return;
    }
    const params = asRecord(request.params);
    const sessionId = String(params.sessionId);
    const taskId = this.sessionToTask.get(sessionId);
    if (!taskId) {
      client.respondPermission(request.id);
      return;
    }
    const toolCall = asRecord(params.toolCall);
    const permission: PermissionRequest = {
      requestId: String(request.id),
      title: String(toolCall.title ?? toolCall.kind ?? 'Allow this tool call?'),
      toolCallId: typeof toolCall.toolCallId === 'string' ? toolCall.toolCallId : undefined,
      options: Array.isArray(params.options) ? params.options : [],
    };
    this.permissions.set(permission.requestId, { client, sessionId, taskId, rpcRequestId: request.id });
    const task = this.tasks.get(taskId);
    if (task) this.setTaskStatus(task, 'waiting');
    this.push({ type: 'permission', taskId, permission, raw: params });
  }

  private setTaskStatus(task: AgentTask, status: TaskStatus): void {
    task.status = status;
    task.updatedAt = Date.now();
    this.persist();
    this.push({ type: 'turn-state', taskId: task.id, status });
  }

  private requireTask(taskId: string): AgentTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error('Task not found.');
    return task;
  }

  private persist(): void {
    this.store.save(this.listTasks());
  }

  private push(event: Omit<AgentEvent, 'cursor' | 'at'>): void {
    const complete = { ...event, cursor: ++this.cursor, at: Date.now() } as AgentEvent;
    this.recordTimeline(complete);
    if (complete.taskId && this.suppressReplayForTasks.has(complete.taskId)) return;
    this.eventBuffer.push(complete);
    if (this.eventBuffer.length > 2_000) this.eventBuffer.splice(0, this.eventBuffer.length - 2_000);
    this.emitToWindow(complete);
  }

  private recordTimeline(event: AgentEvent): void {
    if (!event.taskId) return;
    let kind: TimelineKind | undefined;
    let id = '';
    if (event.type === 'user-message') {
      kind = 'user';
      id = `user:${event.messageId ?? event.cursor}`;
    } else if (event.type === 'message-delta') {
      kind = 'assistant';
      id = `assistant:${event.messageId ?? event.cursor}`;
    } else if (event.type === 'reasoning-delta') {
      kind = 'reasoning';
      id = `reasoning:${event.messageId ?? event.cursor}`;
    } else if (event.type === 'tool' && event.tool) {
      kind = 'tool';
      id = `tool:${event.tool.toolCallId}`;
    } else if (event.type === 'plan') {
      kind = 'plan';
      id = 'plan';
    } else if (event.type === 'error') {
      kind = 'error';
      id = `error:${event.cursor}`;
    }
    if (!kind) return;

    const timeline = this.timelineByTask.get(event.taskId) ?? [];
    this.timelineByTask.set(event.taskId, timeline);
    const index = timeline.findIndex((entry) => entry.id === id);
    if (index < 0) {
      timeline.push({
        sequence: ++this.timelineSequence,
        id,
        kind,
        text: event.type === 'error' ? event.error : event.text,
        tool: event.tool,
        plan: event.plan,
      });
      return;
    }
    const current = timeline[index];
    timeline[index] = {
      ...current,
      text: event.text === undefined ? current.text : `${current.text ?? ''}${event.text}`,
      tool: event.tool ? { ...current.tool, ...event.tool } as ToolItem : current.tool,
      plan: event.plan ?? current.plan,
    };
  }
}
