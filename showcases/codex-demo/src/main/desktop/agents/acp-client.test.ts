import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AcpClient, type AcpServerRequest } from './acp-client';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'test-fixtures', 'acp-agent.mjs');

describe('AcpClient', () => {
  it('initializes, streams updates, and resolves an ACP permission request', async () => {
    const client = new AcpClient({
      command: process.execPath,
      args: [fixture],
      cwd: process.cwd(),
    });
    const chunks: string[] = [];

    client.on('notification', (message) => {
      const text = message?.params?.update?.content?.text;
      if (text) chunks.push(text);
    });
    client.on('request', (request: AcpServerRequest) => {
      expect(request.method).toBe('session/request_permission');
      client.respondPermission(request.id, 'allow-once');
    });

    try {
      const initialized = await client.initialize();
      expect(initialized.agentInfo.name).toBe('Fixture Agent');
      const session = await client.newSession(process.cwd());
      expect(session.sessionId).toBe('fixture-session');
      const result = await client.prompt(session.sessionId, 'connect');
      expect(result.stopReason).toBe('end_turn');
      expect(chunks.join('')).toBe('ACP fixture connected');
      await client.closeSession(session.sessionId);
    } finally {
      client.dispose();
    }
  });
});
