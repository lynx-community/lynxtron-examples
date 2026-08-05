import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../../../shared/agent';
import { AgentRuntime, isFileMutationUpdate } from './runtime';
import { TaskStore } from './task-store';

describe('AgentRuntime', () => {
  it('records mutation tools without treating reads as file changes', () => {
    expect(isFileMutationUpdate({ kind: 'edit', title: 'Edit ignored.txt' })).toBe(true);
    expect(isFileMutationUpdate({ kind: 'other', title: 'Apply patch to ignored.txt' })).toBe(true);
    expect(isFileMutationUpdate({ kind: 'read', title: 'Read ignored.txt' })).toBe(false);
    expect(isFileMutationUpdate({ kind: 'execute', title: 'List workspace' })).toBe(false);
  });

  it('normalizes mock agent turns into the same event stream as real agents', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'codex-demo-runtime-'));
    const events: AgentEvent[] = [];
    const runtime = new AgentRuntime(new TaskStore(join(directory, 'tasks.json')), (event) => events.push(event));

    try {
      const task = await runtime.startTask({ backendId: 'mock', cwd: directory });
      runtime.startPrompt(task.id, 'verify the adapter');
      await new Promise((resolve) => setTimeout(resolve, 750));

      expect(events.some((event) => event.type === 'reasoning-delta')).toBe(true);
      expect(events.some((event) => event.type === 'plan')).toBe(true);
      expect(events.filter((event) => event.type === 'message-delta').map((event) => event.text).join(''))
        .toContain('verify the adapter');
      expect(runtime.listTasks()[0].status).toBe('complete');
      expect(runtime.listTasks()[0].title).toBe('verify the adapter');
      expect(runtime.eventsSince(0).cursor).toBeGreaterThan(0);

      const latest = runtime.timelinePage(task.id, undefined, 2);
      expect(latest.total).toBe(4);
      expect(latest.items).toHaveLength(2);
      expect(latest.items.at(-1)?.kind).toBe('assistant');
      expect(latest.hasMore).toBe(true);

      const earlier = runtime.timelinePage(task.id, latest.before, 2);
      expect(earlier.items.map((item) => item.kind)).toEqual(['user', 'reasoning']);
      expect(earlier.hasMore).toBe(false);
    } finally {
      runtime.dispose();
    }
  });
});
