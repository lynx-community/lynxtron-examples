import { useEffect } from '@lynx-js/react';
import './CurrentFileFindBar.css';

const CURRENT_FILE_FIND_INPUT_ID = 'current-file-find-input';
const FIND_INPUT_REFOCUS_DELAYS_MS = [120, 240];

export interface CurrentFileFindBarProps {
  query: string;
  currentIndex: number;
  total: number;
  hasActiveFile: boolean;
  focusKey: number;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function CurrentFileFindBar({
  query,
  currentIndex,
  total,
  hasActiveFile,
  focusKey,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: CurrentFileFindBarProps) {
  const status = !hasActiveFile
    ? 'No file'
    : !query
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
          .select(`#${CURRENT_FILE_FIND_INPUT_ID}`)
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
  }, [focusKey]);

  return (
    <view className="CurrentFileFindBar">
      <input
        id={CURRENT_FILE_FIND_INPUT_ID}
        className="CurrentFileFindInput"
        value={query}
        bindinput={(e: any) => onQueryChange(e.detail.value)}
        bindconfirm={handleConfirm}
        placeholder="Find in file"
      />
      <text className={total === 0 && query ? 'CurrentFileFindStatus CurrentFileFindStatus--empty' : 'CurrentFileFindStatus'}>
        {status}
      </text>
      <view className="CurrentFileFindButton" bindtap={onPrevious}>
        <text className="CurrentFileFindButtonText">^</text>
      </view>
      <view className="CurrentFileFindButton" bindtap={onNext}>
        <text className="CurrentFileFindButtonText">v</text>
      </view>
      <view className="CurrentFileFindButton CurrentFileFindButton--close" bindtap={onClose}>
        <text className="CurrentFileFindButtonText">x</text>
      </view>
    </view>
  );
}
