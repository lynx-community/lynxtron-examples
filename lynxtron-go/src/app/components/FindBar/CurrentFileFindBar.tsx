import { useEffect } from '@lynx-js/react';
import { Icon } from '../../fiddle/bp';
import './CurrentFileFindBar.css';

const FIND_INPUT_REFOCUS_DELAYS_MS = [120, 240];

export interface CurrentFileFindBarProps {
  inputId: string;
  query: string;
  currentIndex: number;
  total: number;
  focusKey: number;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function CurrentFileFindBar({
  inputId,
  query,
  currentIndex,
  total,
  focusKey,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: CurrentFileFindBarProps) {
  const status = !query
    ? '0 / 0'
    : total > 0
      ? `${currentIndex + 1} / ${total}`
      : 'No results';

  const handleConfirm = (event?: any) => {
    const detail = event?.detail ?? {};
    const isPrevious = !!(detail.shiftKey || detail.shift || detail.isShiftPressed);
    if (isPrevious) onPrevious();
    else onNext();
  };

  useEffect(() => {
    const focusInput = () => {
      try {
        lynx.createSelectorQuery()
          .select(`#${inputId}`)
          .invoke({
            method: 'focus',
            params: {},
            success: () => {},
            fail: () => {},
          })
          .exec();
      } catch (_) {}
    };

    focusInput();
    const timers = FIND_INPUT_REFOCUS_DELAYS_MS.map(delay => setTimeout(focusInput, delay));
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [focusKey, inputId]);

  return (
    <view className="CurrentFileFindBar">
      <input
        id={inputId}
        className="CurrentFileFindInput"
        bindinput={(e: any) => onQueryChange(e.detail.value)}
        bindconfirm={handleConfirm}
        placeholder="Find in file"
      />
      <text className={total === 0 && query ? 'CurrentFileFindStatus CurrentFileFindStatus--empty' : 'CurrentFileFindStatus'}>
        {status}
      </text>
      <view className="CurrentFileFindButton" bindtap={onPrevious}>
        <Icon icon="chevron-up" size={14} className="CurrentFileFindButtonIcon" />
      </view>
      <view className="CurrentFileFindButton" bindtap={onNext}>
        <Icon icon="chevron-down" size={14} className="CurrentFileFindButtonIcon" />
      </view>
      <view className="CurrentFileFindButton CurrentFileFindButton--close" bindtap={onClose}>
        <Icon icon="cross" size={14} className="CurrentFileFindButtonIcon" />
      </view>
    </view>
  );
}
