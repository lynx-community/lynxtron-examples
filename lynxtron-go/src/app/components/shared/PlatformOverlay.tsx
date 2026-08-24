import { useEffect, useRef, useState } from '@lynx-js/react';
import './PlatformOverlay.css';

type OverlayEntry = {
  id: number;
  priority: number;
  node: any;
};

let nextOverlayId = 0;
const entries = new Map<number, OverlayEntry>();
const listeners = new Set<(value: OverlayEntry[]) => void>();

function snapshot(): OverlayEntry[] {
  return Array.from(entries.values()).sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function emit() {
  const value = snapshot();
  for (const listener of listeners) listener(value);
}

function updateEntry(entry: OverlayEntry) {
  entries.set(entry.id, entry);
  emit();
}

function removeEntry(id: number) {
  if (!entries.delete(id)) return;
  emit();
}

/**
 * Routes overlay content into the one persistent platform overlay surface.
 * Keeping the cover-view identity stable avoids exercising Clay's racy macOS
 * overlay-surface grow/retire path while the compositor fix is developed.
 */
export function PlatformOverlay(props: { children?: any; priority?: number }) {
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++nextOverlayId;
  const priority = props.priority ?? 0;

  useEffect(() => {
    updateEntry({ id: idRef.current, priority, node: props.children });
    return () => removeEntry(idRef.current);
  }, []);

  useEffect(() => {
    updateEntry({ id: idRef.current, priority, node: props.children });
  }, [priority, props.children]);

  return null;
}

/** Mount exactly once at the application root. */
export function PlatformOverlayHost() {
  const [activeEntries, setActiveEntries] = useState<OverlayEntry[]>(snapshot);

  useEffect(() => {
    listeners.add(setActiveEntries);
    setActiveEntries(snapshot());
    return () => { listeners.delete(setActiveEntries); };
  }, []);

  return (
    <cover-view className={'PlatformOverlayHost' + (activeEntries.length === 0 ? ' is-empty' : '')} event-through={true}>
      {activeEntries.map(entry => (
        <view
          key={entry.id}
          className="PlatformOverlayEntry"
          style={{ zIndex: entry.priority }}
        >
          {entry.node}
        </view>
      ))}
    </cover-view>
  );
}
