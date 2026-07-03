import { useEffect, useRef } from '@lynx-js/react';
import './LogView.css';

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
  const prevChildrenRef = useRef<any>(null);

  // Auto-scroll to bottom when children change
  useEffect(() => {
    if (prevChildrenRef.current !== children) {
      prevChildrenRef.current = children;
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
    }
  }, [children, scrollId]);

  return (
    <scroll-view id={scrollId} className="LogViewScroll" scroll-y>
      <text className="LogViewText" text-selection flatten={false}>
        {children}
      </text>
    </scroll-view>
  );
}
