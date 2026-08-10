import type { AgentEvent, TimelineKind } from '../../../shared/agent';

export interface BufferedTextDelta {
  event: AgentEvent;
  kind: TimelineKind;
  text: string;
}

export class ConversationBuffer {
  private readonly pending = new Map<string, BufferedTextDelta>();

  enqueue(delta: BufferedTextDelta): number {
    const id = `${delta.kind}:${delta.event.messageId ?? delta.event.cursor}`;
    const existing = this.pending.get(id);
    this.pending.set(id, {
      event: delta.event,
      kind: delta.kind,
      text: `${existing?.text ?? ''}${delta.text}`,
    });
    return this.pending.size;
  }

  drain(): BufferedTextDelta[] {
    const values = [...this.pending.values()];
    this.pending.clear();
    return values;
  }

  clear(): void {
    this.pending.clear();
  }
}
