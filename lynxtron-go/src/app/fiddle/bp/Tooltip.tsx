import { useState } from '@lynx-js/react';
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
 * `:hover` is a Lynxtron extension and works, but only for styling — there is
 * no CSS way to reveal a sibling — so the visibility is state, driven by
 * bindmouseenter/bindmouseleave.
 */
export interface TooltipProps {
  content: string;
  /** Accelerator shown as a key cap after the label, e.g. '⌘P'. */
  hotkey?: string;
  children?: any;
}

export function Tooltip(props: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <view
      className="bp3-tooltip-anchor"
      bindmouseenter={() => setOpen(true)}
      bindmouseleave={() => setOpen(false)}
    >
      {props.children}
      {open ? (
        <view className="bp3-tooltip">
          <text className="bp3-tooltip-text">{props.content}</text>
          {props.hotkey ? <text className="bp3-tooltip-key">{props.hotkey}</text> : null}
        </view>
      ) : null}
    </view>
  );
}
