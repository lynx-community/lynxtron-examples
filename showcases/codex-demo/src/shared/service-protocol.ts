import type { AgentEvent } from './agent';

export const SERVICE_PROTOCOL_VERSION = 1 as const;

export interface ServiceRequest {
  protocolVersion: typeof SERVICE_PROTOCOL_VERSION;
  kind: 'request';
  requestId: string;
  method: string;
  payload: Record<string, unknown>;
}

export interface ServiceResponse {
  protocolVersion: typeof SERVICE_PROTOCOL_VERSION;
  kind: 'response';
  requestId: string;
  ok: boolean;
  value?: unknown;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface ServiceReadyEvent {
  protocolVersion: typeof SERVICE_PROTOCOL_VERSION;
  kind: 'ready';
  pid: number;
}

export interface ServiceAgentEvent {
  protocolVersion: typeof SERVICE_PROTOCOL_VERSION;
  kind: 'event';
  name: 'agent:event';
  payload: AgentEvent;
}

export type ServiceHostMessage = ServiceResponse | ServiceReadyEvent | ServiceAgentEvent;

export function isServiceHostMessage(value: unknown): value is ServiceHostMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServiceHostMessage>;
  return candidate.protocolVersion === SERVICE_PROTOCOL_VERSION
    && (candidate.kind === 'response' || candidate.kind === 'ready' || candidate.kind === 'event');
}
