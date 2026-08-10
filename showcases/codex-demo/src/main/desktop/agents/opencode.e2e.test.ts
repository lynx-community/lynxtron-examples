import { describe, expect, it } from 'vitest';
import { AcpClient } from './acp-client';

const openCodeBin = process.env.OPENCODE_BIN;

describe.skipIf(!openCodeBin)('OpenCode ACP integration', () => {
  it('creates a real OpenCode session and streams a model response', async () => {
    const client = new AcpClient({
      command: openCodeBin!,
      args: ['acp', '--pure'],
      cwd: process.cwd(),
    });
    const chunks: string[] = [];
    client.on('notification', (message) => {
      const update = message?.params?.update;
      if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
        chunks.push(update.content.text);
      }
    });

    let sessionId = '';
    try {
      const initialized = await client.initialize();
      expect(initialized.agentInfo.name.toLowerCase()).toContain('opencode');
      const session = await client.newSession(process.cwd());
      sessionId = session.sessionId;
      const result = await client.prompt(sessionId, 'Reply with exactly: OpenCode ACP connected');
      expect(result.stopReason).toBe('end_turn');
      expect(chunks.join('')).toContain('OpenCode ACP connected');
    } finally {
      if (sessionId) await client.closeSession(sessionId).catch(() => undefined);
      client.dispose();
    }
  }, 120_000);
});
