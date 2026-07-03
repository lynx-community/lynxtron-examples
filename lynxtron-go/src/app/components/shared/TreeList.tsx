import { useState } from '@lynx-js/react';
import './TreeList.css';

export interface TreeGroup {
  key: string;
  label: string;
  badge?: string;     // e.g. result count
  children: TreeItem[];
}

export interface TreeItem {
  key: string;
  icon?: string;
  label: string;
  detail?: string;    // secondary text (e.g. line preview)
  detailHighlight?: { start: number; length: number }; // highlight range in detail
  onTap?: () => void;
}

interface TreeListProps {
  groups: TreeGroup[];
  defaultExpanded?: boolean;
}

export function TreeList({ groups, defaultExpanded = true }: TreeListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <scroll-view className="TreeListScroll" scroll-y>
      {groups.map(group => {
        const isExpanded = defaultExpanded ? !collapsed.has(group.key) : collapsed.has(group.key);
        return (
          <view key={group.key} className="TreeListGroup">
            <view className="TreeListGroupHeader" bindtap={() => toggle(group.key)}>
              <text className="TreeListArrow">{isExpanded ? '\u25BC' : '\u25B6'}</text>
              <text className="TreeListGroupLabel">{group.label}</text>
              {group.badge && (
                <text className="TreeListBadge">{group.badge}</text>
              )}
            </view>
            {isExpanded && group.children.map(item => (
              <view
                key={item.key}
                className="TreeListItem"
                bindtap={item.onTap || (() => {})}
              >
                {item.icon && <text className="TreeListItemIcon">{item.icon}</text>}
                <view className="TreeListItemContent">
                  <text className="TreeListItemLabel">{item.label}</text>
                  {item.detail && (
                    <text className="TreeListItemDetail">
                      {item.detailHighlight ? (
                        <>
                          {item.detail.substring(0, item.detailHighlight.start)}
                          <text className="TreeListHighlight">
                            {item.detail.substring(item.detailHighlight.start, item.detailHighlight.start + item.detailHighlight.length)}
                          </text>
                          {item.detail.substring(item.detailHighlight.start + item.detailHighlight.length)}
                        </>
                      ) : item.detail}
                    </text>
                  )}
                </view>
              </view>
            ))}
          </view>
        );
      })}
    </scroll-view>
  );
}
