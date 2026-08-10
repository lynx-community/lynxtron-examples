import { describe, expect, it } from 'vitest';
import type { ChangedFile, TimelineEntry, ToolItem } from '../../../shared/agent';
import { isWorkingTool, prepareConversationItems, toolTouchesChangedFile } from './conversation-items';

function toolEntry(id: string, tool: Partial<ToolItem>): TimelineEntry {
  return {
    id,
    sequence: 1,
    kind: 'tool',
    tool: { toolCallId: id, title: id, ...tool },
  };
}

const changed: ChangedFile[] = [{
  path: 'hello-world/hello.js',
  status: 'added',
  additions: 1,
  deletions: 0,
  staged: false,
  unstaged: true,
}];

describe('conversation tool classification', () => {
  it('only marks non-terminal tool states as working', () => {
    expect(isWorkingTool({ toolCallId: 'pending', title: 'read' })).toBe(true);
    expect(isWorkingTool({ toolCallId: 'running', title: 'read', status: 'in_progress' })).toBe(true);
    expect(isWorkingTool({ toolCallId: 'done', title: 'read', status: 'completed' })).toBe(false);
    expect(isWorkingTool({ toolCallId: 'failed', title: 'read', status: 'failed' })).toBe(false);
    expect(isWorkingTool({ toolCallId: 'cancelled', title: 'read', status: 'cancelled' })).toBe(false);
  });

  it('classifies shell tools by their changed-file locations', () => {
    const tool = toolEntry('shell-write', {
      kind: 'execute',
      status: 'completed',
      locations: [{ path: '/repo/hello-world/hello.js' }],
    });
    expect(toolTouchesChangedFile(tool.tool, changed)).toBe(true);
    expect(prepareConversationItems([tool], changed)).toEqual([]);
  });

  it('collapses completed read details into one reasoning section', () => {
    const items: TimelineEntry[] = [
      { id: 'reason-1', sequence: 1, kind: 'reasoning', text: 'Inspecting files.' },
      toolEntry('read', { kind: 'read', status: 'completed' }),
      { id: 'reason-2', sequence: 3, kind: 'reasoning', text: 'Choosing a target.' },
    ];
    expect(prepareConversationItems(items, [])).toEqual([{
      id: 'reason-1',
      sequence: 1,
      kind: 'reasoning',
      text: 'Inspecting files.\n\nChoosing a target.',
    }]);
  });

  it('keeps in-progress and failed tools visible', () => {
    const running = toolEntry('running', { kind: 'read', status: 'in_progress' });
    const failed = toolEntry('failed', { kind: 'execute', status: 'failed' });
    expect(prepareConversationItems([running, failed], [])).toEqual([running, failed]);
  });
});
