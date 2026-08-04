import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';

type JsonRpcId = string | number;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

export interface AcpClientOptions {
  command: string;
  args?: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

export interface AcpServerRequest {
  id: JsonRpcId;
  method: string;
  params: any;
}

export class AcpClient extends EventEmitter {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private nextId = 1;
  private closed = false;
  private stderrTail: string[] = [];
  private initializePromise: Promise<any>;

  constructor(private readonly options: AcpClientOptions) {
    super();
    this.child = spawn(options.command, options.args ?? ['acp', '--pure'], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = readline.createInterface({ input: this.child.stdout });
    lines.on('line', (line) => this.handleLine(line));

    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      this.stderrTail.push(chunk);
      if (this.stderrTail.length > 40) this.stderrTail = this.stderrTail.slice(-40);
      this.emit('log', chunk);
    });

    this.child.once('error', (error) => this.handleClose(error));
    this.child.once('close', (code, signal) => {
      const suffix = this.stderrTail.join('').trim();
      const detail = suffix ? `: ${suffix.slice(-1000)}` : '';
      this.handleClose(new Error(`ACP process exited (${code ?? signal ?? 'unknown'})${detail}`));
    });

    this.initializePromise = this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: 'lynxtron_codex_demo', version: '0.0.1' },
    }, 20_000);
  }

  initialize(): Promise<any> {
    return this.initializePromise;
  }

  async listSessions(cwd?: string): Promise<any> {
    await this.initialize();
    return this.request('session/list', cwd ? { cwd } : {}, 20_000);
  }

  async newSession(cwd: string): Promise<any> {
    await this.initialize();
    return this.request('session/new', { cwd, mcpServers: [] }, 30_000);
  }

  async loadSession(sessionId: string, cwd: string): Promise<any> {
    await this.initialize();
    return this.request('session/load', { sessionId, cwd, mcpServers: [] }, 30_000);
  }

  async prompt(sessionId: string, text: string): Promise<any> {
    await this.initialize();
    return this.request('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  async setConfigOption(sessionId: string, configId: string, value: string | boolean): Promise<any> {
    await this.initialize();
    return this.request('session/set_config_option', { sessionId, configId, value }, 20_000);
  }

  cancel(sessionId: string): void {
    this.notify('session/cancel', { sessionId });
  }

  closeSession(sessionId: string): Promise<any> {
    return this.request('session/close', { sessionId }, 10_000);
  }

  respondPermission(requestId: JsonRpcId, optionId?: string): void {
    this.send({
      jsonrpc: '2.0',
      id: requestId,
      result: {
        outcome: optionId
          ? { outcome: 'selected', optionId }
          : { outcome: 'cancelled' },
      },
    });
  }

  respondError(requestId: JsonRpcId, code: number, message: string): void {
    this.send({ jsonrpc: '2.0', id: requestId, error: { code, message } });
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const error = new Error('ACP client disposed');
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.child.kill('SIGTERM');
  }

  private request(method: string, params: any, timeoutMs?: number): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject };
      if (timeoutMs) {
        pending.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, pending);
      try {
        this.send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        this.pending.delete(id);
        if (pending.timer) clearTimeout(pending.timer);
        reject(error);
      }
    });
  }

  private notify(method: string, params: any): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private send(message: unknown): void {
    if (this.closed || !this.child.stdin.writable) {
      throw new Error('ACP process is not writable');
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch {
      this.emit('log', `Ignored non-JSON ACP stdout: ${trimmed}\n`);
      return;
    }

    if (message.method && message.id !== undefined) {
      this.emit('request', { id: message.id, method: message.method, params: message.params } satisfies AcpServerRequest);
      return;
    }

    if (message.method) {
      this.emit('notification', message);
      return;
    }

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private handleClose(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.emit('fatal', error);
  }
}
