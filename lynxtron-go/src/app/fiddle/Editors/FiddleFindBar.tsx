import { useEffect, useRef } from '@lynx-js/react';
import '../../components/FindBar/CurrentFileFindBar.css';

interface Props {
  query: string;
  index: number;
  total: number;
  focusKey: number;
  onQuery: (query: string) => void;
  onNavigate: (direction: 'next' | 'previous') => void;
  onClose: () => void;
}

export function FiddleFindBar(props: Props) {
  const focused = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const focus = () => lynx.createSelectorQuery().select('#fiddle-find-input')
    .invoke({ method: 'focus', params: {} }).exec();
  const cancelFocus = () => {
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current = [];
  };
  useEffect(() => {
    focus();
    timers.current = [120, 240].map(delay => setTimeout(focus, delay));
    return cancelFocus;
  }, [props.focusKey]);
  const keyDown = (e: any) => {
    if (!focused.current) return;
    const key = e.key ?? e.detail?.key;
    if (key === 'Escape') props.onClose();
  };
  return (
    <view className="CurrentFileFindBar" catchtap={() => {}} global-bindkeydown={keyDown}>
      <input
        id="fiddle-find-input"
        className="CurrentFileFindInput"
        style={{ width: '0px', flexGrow: 1, minWidth: '0px' }}
        // Native input owns the text while typing. Echoing an asynchronous
        // BTS query back through value can overwrite newer native keystrokes.
        // Changing editor remounts this component and starts a fresh query.
        value=""
        placeholder="Find in editor"
        bindfocus={() => { focused.current = true; }}
        bindblur={() => { focused.current = false; cancelFocus(); }}
        bindinput={(e: any) => props.onQuery(e.detail.value)}
        bindconfirm={(e: any) => {
          props.onNavigate(e?.detail?.shiftKey ? 'previous' : 'next');
          // Desktop input ends editing on Return. Keep repeated navigation
          // in the query instead of leaving the native field unfocused.
          focus();
        }}
      />
      <text className="CurrentFileFindStatus">
        {props.total ? `${props.index + 1} / ${props.total}` : props.query ? 'No results' : '0 / 0'}
      </text>
      <view className="CurrentFileFindButton" bindtap={() => props.onNavigate('previous')}>
        <text className="CurrentFileFindButtonText">↑</text>
      </view>
      <view className="CurrentFileFindButton" bindtap={() => props.onNavigate('next')}>
        <text className="CurrentFileFindButtonText">↓</text>
      </view>
      <view className="CurrentFileFindButton" bindtap={props.onClose}>
        <text className="CurrentFileFindButtonText">×</text>
      </view>
    </view>
  );
}
