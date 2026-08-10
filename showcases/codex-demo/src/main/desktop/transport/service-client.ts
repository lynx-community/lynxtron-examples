import { randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { AgentEvent } from '../../../shared/agent';
import {
  isServiceHostMessage,
  SERVICE_PROTOCOL_VERSION,
  type ServiceRequest,
} from '../../../shared/service-protocol';

interface PendingRequest {
  method: string;
  traceId?: string;
  startedAt: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface ServiceClientOptions {
  env: Record<string, string>;
  onAgentEvent: (event: AgentEvent) => void;
  onStateChange?: (state: 'starting' | 'ready' | 'recovering' | 'stopped', detail?: string) => void;
}

const START_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESTART_ATTEMPTS = 3;

export class ServiceClient {
  private child: ChildProcess | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private stopping = false;
  private restartAttempts = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: ServiceClientOptions) {}

  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.stopping = false;
    this.options.onStateChange?.('starting');
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    const child = fork(path.join(__dirname, 'service-host.js'), [], {
      env: { ...this.options.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    this.child = child;
    child.stdout?.on('data', (chunk) => process.stdout.write(`[Codex Service] ${String(chunk)}`));
    child.stderr?.on('data', (chunk) => process.stderr.write(`[Codex Service] ${String(chunk)}`));
    child.on('message', (message: unknown) => this.handleMessage(message));
    child.on('exit', (code) => this.handleExit(code ?? -1));
    const timeout = setTimeout(() => {
      if (!this.resolveReady) return;
      const error = new Error(`Codex Service Host did not become ready within ${START_TIMEOUT_MS}ms.`);
      this.rejectReady?.(error);
      this.clearReadyState();
      child.kill();
    }, START_TIMEOUT_MS);
    this.readyPromise.finally(() => clearTimeout(timeout)).catch(() => undefined);
    return this.readyPromise;
  }

  async request<T>(method: string, payload: Record<string, unknown> = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    await this.start();
    const child = this.child;
    if (!child) throw new Error('Codex Service Host is unavailable.');
    const requestId = randomUUID();
    const message: ServiceRequest = {
      protocolVersion: SERVICE_PROTOCOL_VERSION,
      kind: 'request',
      requestId,
      method,
      payload,
    };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(requestId, {
        method,
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        startedAt: performance.now(),
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        child.send(message);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async dispose(): Promise<void> {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.child;
    if (!child) {
      this.options.onStateChange?.('stopped');
      return;
    }
    try {
      await this.request('service:dispose', {}, 2_000);
    } catch {}
    child.kill();
    this.child = null;
    this.readyPromise = null;
    this.clearReadyState();
    this.rejectPending(new Error('Codex Service Host stopped.'));
    this.options.onStateChange?.('stopped');
  }

  private handleMessage(rawMessage: unknown): void {
    const message = rawMessage && typeof rawMessage === 'object' && 'data' in rawMessage
      ? (rawMessage as { data: unknown }).data
      : rawMessage;
    if (!isServiceHostMessage(message)) return;
    if (message.kind === 'ready') {
      this.restartAttempts = 0;
      this.resolveReady?.();
      this.clearReadyState();
      this.options.onStateChange?.('ready');
      return;
    }
    if (message.kind === 'event') {
      this.options.onAgentEvent(message.payload);
      return;
    }
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.requestId);
    if (pending.traceId && pending.method.startsWith('review:')) {
      console.info('[Codex Demo][diff-perf]', JSON.stringify({
        traceId: pending.traceId,
        layer: 'main-rpc',
        operation: pending.method,
        totalMs: Math.round((performance.now() - pending.startedAt) * 10) / 10,
      }));
    }
    if (message.ok) pending.resolve(message.value);
    else pending.reject(new Error(message.error?.message ?? 'Service request failed.'));
  }

  private handleExit(code: number): void {
    this.child = null;
    this.readyPromise = null;
    const error = new Error(`Codex Service Host exited with code ${code}.`);
    this.rejectReady?.(error);
    this.clearReadyState();
    this.rejectPending(error);
    if (!this.stopping) {
      this.options.onStateChange?.('recovering', error.message);
      if (this.restartAttempts < MAX_RESTART_ATTEMPTS) {
        const delay = 250 * (2 ** this.restartAttempts);
        this.restartAttempts += 1;
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          void this.start().catch((restartError) => {
            this.options.onStateChange?.('recovering', restartError instanceof Error ? restartError.message : String(restartError));
          });
        }, delay);
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private clearReadyState(): void {
    this.resolveReady = null;
    this.rejectReady = null;
  }
}
