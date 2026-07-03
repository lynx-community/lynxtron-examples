/**
 * StatusBar item registry — extensible left/right item system.
 * Items register with an alignment (left/right) and a priority (lower = closer to edge).
 */

export interface StatusBarItem {
  id: string;
  align: 'left' | 'right';
  priority: number;       // lower = closer to edge
  text: () => string;     // dynamic text
  tooltip?: string;
  onTap?: () => void;     // optional click handler
  visible?: () => boolean; // conditional visibility
}

const items: StatusBarItem[] = [];

export function registerStatusBarItem(item: StatusBarItem): void {
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
}

export function getStatusBarItems(align: 'left' | 'right'): StatusBarItem[] {
  return items
    .filter(i => i.align === align && (!i.visible || i.visible()))
    .sort((a, b) => a.priority - b.priority);
}
