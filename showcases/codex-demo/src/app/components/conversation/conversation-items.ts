import type { ChangedFile, TimelineEntry, ToolItem } from '../../../shared/agent';

const FILE_MUTATION_KINDS = new Set([
  'edit', 'write', 'create', 'delete', 'move', 'rename', 'patch', 'apply_patch', 'file_change',
]);

export function looksLikeFilePath(path: string): boolean {
  const name = path.split('/').filter(Boolean).pop() ?? '';
  return name.includes('.') && !name.endsWith('.');
}

/** File mutations are summarized by ChangeSummaryCard instead of rendered as noisy tool cards. */
export function isFileMutationTool(tool?: ToolItem): boolean {
  if (!tool) return false;
  const kind = (tool.kind ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (FILE_MUTATION_KINDS.has(kind)) return true;
  if (!tool.locations?.some((location) => location.path && looksLikeFilePath(location.path))) return false;
  return /^(edit|write|create|delete|remove|rename|move|patch|update|apply patch)\b/i.test(tool.title.trim());
}

export function isFileMutationTimelineEntry(item: TimelineEntry): boolean {
  return item.kind === 'tool' && isFileMutationTool(item.tool);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export function toolTouchesChangedFile(tool: ToolItem | undefined, changedFiles: ChangedFile[]): boolean {
  if (!tool?.locations?.length || changedFiles.length === 0) return false;
  const paths = changedFiles.map((file) => normalizePath(file.path));
  return tool.locations.some((location) => {
    if (!location.path) return false;
    const locationPath = normalizePath(location.path);
    return paths.some((path) => locationPath === path || locationPath.endsWith(`/${path}`));
  });
}

function isCompletedTool(tool?: ToolItem): boolean {
  const status = (tool?.status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return status === 'completed' || status === 'complete' || status === 'success' || status === 'succeeded';
}

/** Collapse completed work details and reserve changed files for ChangeSummaryCard. */
export function prepareConversationItems(items: TimelineEntry[], changedFiles: ChangedFile[]): TimelineEntry[] {
  const visible: TimelineEntry[] = [];
  for (const item of items) {
    if (item.kind === 'tool') {
      if (isFileMutationTimelineEntry(item) || toolTouchesChangedFile(item.tool, changedFiles)) continue;
      if (isCompletedTool(item.tool)) continue;
    }
    if (item.kind === 'reasoning' && visible[visible.length - 1]?.kind === 'reasoning') {
      const previous = visible[visible.length - 1];
      visible[visible.length - 1] = {
        ...previous,
        text: [previous.text, item.text].filter(Boolean).join('\n\n'),
      };
      continue;
    }
    visible.push(item);
  }
  return visible;
}
