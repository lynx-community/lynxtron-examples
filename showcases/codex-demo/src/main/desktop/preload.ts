import { contextBridge } from '@lynx-js/lynxtron/context-bridge';
import { ConversationBuffer, type BufferedTextDelta } from './preload/conversation-buffer';

const conversationBuffer = new ConversationBuffer();

contextBridge.exposeInLynxBTS({
  product: 'Codex Demo',
  protocol: 'agent-backend-v1',
  conversation: {
    enqueueDelta: (delta: BufferedTextDelta) => conversationBuffer.enqueue(delta),
    drainDeltas: () => conversationBuffer.drain(),
    clearDeltas: () => conversationBuffer.clear(),
  },
});
