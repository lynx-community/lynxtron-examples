import { useCallback, useEffect } from '@lynx-js/react';
import './LogView.css';

const AUTO_SCROLL_DELAYS_MS = [0, 80];

interface LogViewProps {
  id: string;
  children: any;
}

/**
 * Shared scrollable, selectable, auto-scroll-to-bottom text log view.
 * Used by Terminal and Output panels.
 */
export function LogView({ id, children }: LogViewProps) {
  const scrollId = `${id}-scroll`;

  const scrollToBottom = useCallback(() => {
    try {
      lynx.createSelectorQuery()
        .select(`#${scrollId}`)
        .invoke({
          method: 'scrollTo',
          params: { offset: 999999, smooth: false },
          success: () => {},
          fail: () => {},
        })
        .exec();
    } catch (_) {}
  }, [scrollId]);

  // contentsizechanged is the precise post-layout signal. The deferred calls
  // also cover updates whose text changes without changing the content size.
  useEffect(() => {
    const timers = AUTO_SCROLL_DELAYS_MS.map(delay => setTimeout(scrollToBottom, delay));
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [children, scrollToBottom]);

  return (
    <scroll-view
      id={scrollId}
      className="LogViewScroll"
      scroll-y
      bindcontentsizechanged={scrollToBottom}
    >
      <text className="LogViewText" text-selection={true} flatten={false}>
        {children}
      </text>
    </scroll-view>
  );
}
