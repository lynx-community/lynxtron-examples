import { useState, useRef, useCallback, useEffect } from '@lynx-js/react';
import { NonIdealState, Button } from '../bp';
import { EditorPane } from './EditorPane';
import { compareEditors } from '../types';
import type { FiddleFile, EditorId } from '../state/FiddleState';
import './Editors.css';

export interface EditorsProps {
  files: Map<EditorId, FiddleFile>;
  activeEditorId: EditorId | null;
  onSelectEditor: (id: EditorId) => void;
  onHideEditor: (id: EditorId) => void;
  onResetLayout: () => void;
  pushContent: (id: EditorId) => void;
  /** Search UI owned by one native editor pane. */
  findBar?: any;
  findBarEditorId?: EditorId | null;
  /** A dialog/overlay is open — newly created panes must not attach above it. */
  suppressed?: boolean;
}

// ── Upstream editor-mosaic.ts createMosaic():
// sort visible ids (KNOWN_FILES order then lexicographic), then recursively
// half-split. Top-level split is a row; every nested split is a column.
type MosaicNode =
  | { kind: 'leaf'; id: EditorId }
  | { kind: 'split'; direction: 'row' | 'column'; first: MosaicNode; second: MosaicNode };

function createMosaic(ids: EditorId[], direction: 'row' | 'column' = 'row'): MosaicNode | null {
  if (ids.length === 0) return null;
  if (ids.length === 1) return { kind: 'leaf', id: ids[0] };
  const mid = Math.floor(ids.length / 2);
  return {
    kind: 'split',
    direction,
    first: createMosaic(ids.slice(0, mid), 'column')!,
    second: createMosaic(ids.slice(mid), 'column')!,
  };
}

function leavesOf(node: MosaicNode): EditorId[] {
  if (node.kind === 'leaf') return [node.id];
  return [...leavesOf(node.first), ...leavesOf(node.second)];
}

// ── Flat layout (react-mosaic's real approach): walk the tree computing an
// absolute pixel rect per leaf and per sash. Structure/ratio changes are pure
// STYLE updates — surviving panes are keyed by file id and never remount, so
// expanding or hiding one file no longer flashes every native editor.
interface Rect { left: number; top: number; width: number; height: number }
interface PaneBox { id: EditorId; rect: Rect }
interface SashBox { path: string; direction: 'row' | 'column'; rect: Rect; axisPx: number }

const MIN_PANE_PX = 60;

function layoutTree(
  node: MosaicNode,
  path: string,
  rect: Rect,
  // Only ever invoked on split nodes (the leaf branch returns above it).
  ratioFor: (path: string, node: MosaicNode & { kind: 'split' }) => number,
  panes: PaneBox[],
  sashes: SashBox[],
): void {
  if (node.kind === 'leaf') {
    panes.push({ id: node.id, rect });
    return;
  }
  const ratio = ratioFor(path, node); // 0..1 share for `first`
  if (node.direction === 'row') {
    const firstW = rect.width * ratio;
    layoutTree(node.first, path + '.first',
      { left: rect.left, top: rect.top, width: firstW, height: rect.height },
      ratioFor, panes, sashes);
    layoutTree(node.second, path + '.second',
      { left: rect.left + firstW, top: rect.top, width: rect.width - firstW, height: rect.height },
      ratioFor, panes, sashes);
    sashes.push({
      path, direction: 'row', axisPx: rect.width,
      rect: { left: rect.left + firstW, top: rect.top, width: 0, height: rect.height },
    });
  } else {
    const firstH = rect.height * ratio;
    layoutTree(node.first, path + '.first',
      { left: rect.left, top: rect.top, width: rect.width, height: firstH },
      ratioFor, panes, sashes);
    layoutTree(node.second, path + '.second',
      { left: rect.left, top: rect.top + firstH, width: rect.width, height: rect.height - firstH },
      ratioFor, panes, sashes);
    sashes.push({
      path, direction: 'column', axisPx: rect.height,
      rect: { left: rect.left, top: rect.top + firstH, width: rect.width, height: 0 },
    });
  }
}

/** Extract pointer position from Lynx touch or mouse event. */
function getPos(e: any, horizontal: boolean): number | null {
  const touch = e?.touches?.[0] || e?.changedTouches?.[0];
  if (touch) return horizontal ? touch.pageX : touch.pageY;
  if (e?.detail) {
    const v = horizontal ? (e.detail.pageX ?? e.detail.x) : (e.detail.pageY ?? e.detail.y);
    if (v != null) return v;
  }
  if (e?.pageX != null) return horizontal ? e.pageX : e.pageY;
  return null;
}

export function Editors(props: EditorsProps) {
  // Upstream "maximize" = expand the pane's ancestors to 70% toward it.
  const [expandedId, setExpandedId] = useState<EditorId | null>(null);
  // Per-split drag ratios keyed by tree path; reset when the pane set changes
  // (upstream rebuilds a balanced tree on any visibility change).
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [surface, setSurface] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ path: string; horizontal: boolean; startPos: number; startRatio: number; axisPx: number } | null>(null);
  const lastMoveRef = useRef(0);

  const visibleIds = [...props.files.values()]
    .filter(f => f.visible)
    .map(f => f.id)
    .sort(compareEditors);
  const visibleKey = visibleIds.join('|');

  useEffect(() => {
    setRatios({});
    setExpandedId(null);
    dragRef.current = null;
    setDragging(false);
  }, [visibleKey]);

  const tree = createMosaic(visibleIds);

  const onSurfaceLayout = useCallback((e: any) => {
    const w = e?.detail?.width;
    const h = e?.detail?.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
      setSurface(prev => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    }
  }, []);

  const handleMaximize = useCallback((id: EditorId) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const handleHide = useCallback((id: EditorId) => {
    setExpandedId(null);
    props.onHideEditor(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onHideEditor]);

  // ── Sash drag: ratio-only state updates; panes restyle, never remount. ──
  const ratiosRef = useRef(ratios);
  ratiosRef.current = ratios;
  const onSashDown = useCallback((sash: SashBox, e: any) => {
    const horizontal = sash.direction === 'row';
    const pos = getPos(e, horizontal);
    if (pos == null || sash.axisPx <= 0) return;
    // Dragging a sash leaves "maximized" mode (the drag overrides the 70/30).
    setExpandedId(null);
    dragRef.current = {
      path: sash.path,
      horizontal,
      startPos: pos,
      startRatio: ratiosRef.current[sash.path] ?? 0.5,
      axisPx: sash.axisPx,
    };
    setDragging(true);
  }, []);

  const onSashMove = useCallback((e: any) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Move with no pressed button = missed mouseup — end the drag.
    const buttons = e?.detail?.buttons ?? e?.buttons;
    if (typeof buttons === 'number' && buttons === 0) { onSashEndRef.current?.(); return; }
    const now = Date.now();
    if (now - lastMoveRef.current < 16) return;
    lastMoveRef.current = now;
    const pos = getPos(e, drag.horizontal);
    if (pos == null) return;
    const minRatio = Math.min(0.45, MIN_PANE_PX / drag.axisPx);
    const next = Math.max(minRatio, Math.min(1 - minRatio,
      drag.startRatio + (pos - drag.startPos) / drag.axisPx));
    setRatios(prev => (prev[drag.path] === next ? prev : { ...prev, [drag.path]: next }));
  }, []);

  const onSashEnd = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);
  const onSashEndRef = useRef(onSashEnd);
  onSashEndRef.current = onSashEnd;

  if (!tree) {
    // Upstream zeroStateView: all editors hidden.
    return (
      <view className="FiddleEditors">
        <NonIdealState
          icon="applications"
          title=""
          description="You have closed all editors. You can open them again with the button below or in the sidebar menu!"
          action={<Button text="Reset editors" onClick={props.onResetLayout} />}
        />
      </view>
    );
  }

  // expand-to-70% along the path to expandedId (react-mosaic expand default);
  // otherwise the stored drag ratio, else 50/50.
  const ratioFor = (path: string, node: MosaicNode & { kind: 'split' }): number => {
    if (expandedId) {
      if (leavesOf(node.first).includes(expandedId)) return 0.7;
      if (leavesOf(node.second).includes(expandedId)) return 0.3;
    }
    return ratios[path] ?? 0.5;
  };

  const panes: PaneBox[] = [];
  const sashes: SashBox[] = [];
  if (surface.w > 0 && surface.h > 0) {
    layoutTree(tree, 'root', { left: 0, top: 0, width: surface.w, height: surface.h },
      ratioFor, panes, sashes);
  }

  const px = (n: number) => `${Math.round(n * 100) / 100}px`;

  return (
    <view className="FiddleEditors">
      <view className="MosaicSurface" bindlayoutchange={onSurfaceLayout}>
        {panes.map(p => {
          const file = props.files.get(p.id)!;
          return (
            <view
              key={p.id}
              className="MosaicCell"
              style={{ left: px(p.rect.left), top: px(p.rect.top), width: px(p.rect.width), height: px(p.rect.height) }}
            >
              <EditorPane
                suppressed={props.suppressed}
                file={file}
                active={p.id === props.activeEditorId}
                onHide={handleHide}
                onMaximize={handleMaximize}
                onFocus={props.onSelectEditor}
                pushContent={props.pushContent}
                findBar={props.findBarEditorId === p.id ? props.findBar : null}
              />
            </view>
          );
        })}
        {sashes.map(s => (
          <view
            key={s.path}
            className={`MosaicSash ${s.direction === 'row' ? 'MosaicSashH' : 'MosaicSashV'}`}
            style={s.direction === 'row'
              ? { left: px(s.rect.left), top: px(s.rect.top), height: px(s.rect.height) }
              : { left: px(s.rect.left), top: px(s.rect.top), width: px(s.rect.width) }}
            bindmousedown={(e: any) => onSashDown(s, e)}
            bindmousemove={onSashMove}
            bindmouseup={onSashEnd}
            bindtouchstart={(e: any) => onSashDown(s, e)}
            bindtouchmove={onSashMove}
            bindtouchend={onSashEnd}
            bindtouchcancel={onSashEnd}
          />
        ))}
        {dragging ? (
          <view
            className="MosaicDragOverlay"
            bindmousemove={onSashMove}
            bindmouseup={onSashEnd}
            bindtouchmove={onSashMove}
            bindtouchend={onSashEnd}
            bindtouchcancel={onSashEnd}
          />
        ) : null}
      </view>
    </view>
  );
}
