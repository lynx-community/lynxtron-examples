import { useEffect } from '@lynx-js/react';
import './TabBar.css';
import type { Tab } from '../../store';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab }: TabBarProps) {
  // Scroll tab bar to keep active tab visible
  useEffect(() => {
    if (!activeTabId) return;
    const idx = tabs.findIndex(t => t.id === activeTabId);
    if (idx < 0) return;
    try {
      // @ts-ignore
      lynx.createSelectorQuery()
        .select('#tabbar-scroll')
        .invoke({
          method: 'scrollTo',
          params: { index: idx, smooth: true },
          success: () => {},
          fail: () => {},
        })
        .exec();
    } catch (_) {}
  }, [activeTabId, tabs.length]);

  return (
    <scroll-view id="tabbar-scroll" className="TabBar" scroll-x>
      {tabs.map(tab => (
        <view
          key={tab.id}
          className={`Tab${tab.id === activeTabId ? ' ActiveTab' : ''}`}
          flatten={false}
          bindtap={() => onSwitchTab(tab.id)}
        >
          <text className="TabName">
            {tab.isDirty ? '\u25CF ' : ''}{tab.name}
          </text>
          <view className="TabClose" catchtap={() => onCloseTab(tab.id)}>
            <text className="TabCloseText">{'\u00D7'}</text>
          </view>
        </view>
      ))}
    </scroll-view>
  );
}
