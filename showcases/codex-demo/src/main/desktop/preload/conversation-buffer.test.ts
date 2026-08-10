import { describe, expect, it } from 'vitest';
import { ConversationBuffer } from './conversation-buffer';

describe('ConversationBuffer', () => {
  it('coalesces text deltas by message before the UI drains them', () => {
    const buffer = new ConversationBuffer();
    const event = {
      cursor: 1,
      at: 1,
      type: 'message-delta' as const,
      taskId: 'task-1',
      messageId: 'message-1',
    };

    buffer.enqueue({ event, kind: 'assistant', text: 'hello ' });
    buffer.enqueue({ event: { ...event, cursor: 2 }, kind: 'assistant', text: 'world' });

    expect(buffer.drain()).toEqual([{
      event: { ...event, cursor: 2 },
      kind: 'assistant',
      text: 'hello world',
    }]);
    expect(buffer.drain()).toEqual([]);
  });

  it('keeps concurrent messages separate and can clear stale task data', () => {
    const buffer = new ConversationBuffer();
    buffer.enqueue({
      event: { cursor: 1, at: 1, type: 'reasoning-delta', messageId: 'one' },
      kind: 'reasoning',
      text: 'first',
    });
    buffer.enqueue({
      event: { cursor: 2, at: 2, type: 'message-delta', messageId: 'two' },
      kind: 'assistant',
      text: 'second',
    });
    buffer.clear();
    expect(buffer.drain()).toEqual([]);
  });
});
