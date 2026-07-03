import { useState, useEffect } from '@lynx-js/react';
import './StatusBar.css';
import { getStatusBarItems, type StatusBarItem } from './statusbar-registry';

interface StatusBarProps {
  status: string;
}

export function StatusBar({ status }: StatusBarProps) {
  const [, setTick] = useState(0);

  // Poll registry for changes + force re-render for dynamic text() values
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Also tick on first render to pick up early registrations
  useEffect(() => { setTick(1); }, []);

  const leftItems = getStatusBarItems('left');
  const rightItems = getStatusBarItems('right');

  const renderItem = (item: StatusBarItem) => {
    const text = item.text();
    if (!text) return null;
    return (
      <view
        key={item.id}
        className={`StatusBarItem${item.onTap ? ' StatusBarItemClickable' : ''}`}
        bindtap={item.onTap || (() => {})}
      >
        <text className="StatusBarItemText">{text}</text>
      </view>
    );
  };

  return (
    <view className="StatusBar">
      <view className="StatusBarLeft">
        {leftItems.map(renderItem)}
      </view>
      <text className="StatusBarCenter">{status}</text>
      <view className="StatusBarRight">
        {rightItems.map(renderItem)}
      </view>
    </view>
  );
}
