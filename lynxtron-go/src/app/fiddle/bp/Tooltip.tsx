import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';
import { PlatformOverlay } from '../../components/shared/PlatformOverlay';
import './bp.css';

/**
 * Hover tooltip.
 *
 * Lynx has no native one — `title` on a view does nothing here, and the only
 * "tooltip" in the Lynxtron API is a vibrancy material name and a jump-list
 * description, neither of which draws anything. So every `title` in this app
 * has been decoration: the affordance it promised never existed.
 *
 * That matters beyond politeness. A control cannot drop its label until its
 * name is recoverable some other way, so the absence of tooltips is what has
 * been keeping words in the commands bar that would rather be icons.
 *
 * Two things used to make a bar tooltip impossible, and both are gone:
 *
 *  - the header clips its children, so a bubble anchored inside it was cut off
 *    at the 51px boundary. The bubble now renders into the shared platform
 *    overlay host, which is a sibling of the whole shell.
 *  - native Scintilla painted above all Lynx UI, so even an unclipped bubble
 *    came up behind the code. The editor is mounted inside the Lynx hierarchy
 *    now, and the overlay host is a platform layer above it.
 *
 * What the overlay costs is position: content routed there is no longer a
 * child of its anchor, so the anchor has to be measured. `:hover` is a
 * Lynxtron extension and works, but only for styling — there is no CSS way to
 * reveal a sibling, let alone one in another subtree — so both the visibility
 * and the coordinates are state.
 */

let nextAnchorId = 0;

interface AnchorRect {
  left: number;
  right: number;
  bottom: number;
}

export interface TooltipProps {
  content: string;
  /** Accelerator shown as a key cap after the label, e.g. '⌘P'. */
  hotkey?: string;
  /**
   * Which edge of the bubble lines up with the same edge of the control.
   * `end` for anything near the window's right edge: a start-aligned bubble on
   * the last button in the bar opens off-screen.
   */
  align?: 'start' | 'end';
  /** Grace period before showing, so sweeping across a row stays quiet. */
  delayMs?: number;
  children?: any;
}

export function Tooltip(props: TooltipProps) {
  const idRef = useRef('');
  if (!idRef.current) idRef.current = `tt-anchor-${++nextAnchorId}`;
  const timerRef = useRef<any>(null);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const align = props.align ?? 'start';

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const hide = useCallback(() => {
    clearTimer();
    setRect(current => (current === null ? current : null));
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      try {
        // @ts-ignore — SelectorQuery is a runtime global, not in the app types.
        lynx.createSelectorQuery()
          .select(`#${idRef.current}`)
          .invoke({
            method: 'boundingClientRect',
            params: {},
            success: (res: any) => {
              if (typeof res?.bottom !== 'number') return;
              setRect({ left: res.left, right: res.right, bottom: res.bottom });
            },
            // A tooltip that cannot find its anchor simply does not appear.
            fail: () => {},
          })
          .exec();
      } catch (_) { /* no query available — no tooltip, no crash */ }
    }, props.delayMs ?? 350);
  }, [props.delayMs]);

  // A pointer that leaves by way of a click, a scroll, or an unmount never
  // sends mouseleave; without this the bubble outlives its anchor.
  useEffect(() => clearTimer, []);

  /**
   * `end` alignment without knowing the window width: the bubble sits in a
   * row that starts at the window's left edge and ends at the control's right
   * edge, pushed to that row's end. The measurement already in hand is enough.
   */
  const frameStyle = align === 'end'
    ? { left: '0px', width: `${Math.max(0, rect?.right ?? 0)}px`, top: `${(rect?.bottom ?? 0) + 6}px` }
    : { left: `${rect?.left ?? 0}px`, top: `${(rect?.bottom ?? 0) + 6}px` };

  return (
    <view
      id={idRef.current}
      className="bp3-tooltip-anchor"
      bindmouseenter={show}
      bindmouseleave={hide}
      // Acting on the control answers the question the tooltip was asking.
      bindtap={hide}
    >
      {props.children}
      {rect ? (
        <PlatformOverlay priority={600}>
          <view
            className={'bp3-tooltip-frame' + (align === 'end' ? ' bp3-tooltip-frame--end' : '')}
            style={frameStyle}
          >
            <view className="bp3-tooltip">
              <text className="bp3-tooltip-text">{props.content}</text>
              {props.hotkey ? <text className="bp3-tooltip-key">{props.hotkey}</text> : null}
            </view>
          </view>
        </PlatformOverlay>
      ) : null}
    </view>
  );
}
