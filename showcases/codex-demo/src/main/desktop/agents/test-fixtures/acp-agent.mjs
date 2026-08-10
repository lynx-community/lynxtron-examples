import readline from 'node:readline';

const input = readline.createInterface({ input: process.stdin });
let promptRequestId = null;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

input.on('line', (line) => {
  const message = JSON.parse(line);

  if (message.method === 'initialize') {
    send({ jsonrpc: '2.0', id: message.id, result: {
      protocolVersion: 1,
      agentInfo: { name: 'Fixture Agent', version: '1.0.0' },
      agentCapabilities: { loadSession: true },
    } });
    return;
  }

  if (message.method === 'session/new') {
    send({ jsonrpc: '2.0', id: message.id, result: {
      sessionId: 'fixture-session',
      configOptions: [],
    } });
    return;
  }

  if (message.method === 'session/load') {
    send({ jsonrpc: '2.0', id: message.id, result: { configOptions: [] } });
    return;
  }

  if (message.method === 'session/prompt') {
    promptRequestId = message.id;
    send({
      jsonrpc: '2.0',
      id: 901,
      method: 'session/request_permission',
      params: {
        sessionId: message.params.sessionId,
        toolCall: { toolCallId: 'tool-1', title: 'Read workspace', kind: 'read' },
        options: [
          { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
        ],
      },
    });
    return;
  }

  if (message.id === 901 && message.result) {
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 'fixture-session',
        update: {
          sessionUpdate: 'agent_message_chunk',
          messageId: 'assistant-1',
          content: { type: 'text', text: 'ACP fixture connected' },
        },
      },
    });
    send({ jsonrpc: '2.0', id: promptRequestId, result: { stopReason: 'end_turn' } });
    promptRequestId = null;
    return;
  }

  if (message.method === 'session/close') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
    return;
  }

  if (message.id !== undefined && message.method) {
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'unsupported' } });
  }
});
