import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  product: 'Codex Demo',
  protocol: 'agent-backend-v1',
});
