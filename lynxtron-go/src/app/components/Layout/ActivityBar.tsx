import './ActivityBar.css';
import { panelRegistry, type PanelDescriptor } from './PanelRegistry';

interface ActivityBarProps {
  activePanelId: string;
  onSelect: (panelId: string) => void;
}

/**
 * Narrow icon strip on the far left. Each icon corresponds to a sidebar panel.
 * Clicking switches the active panel; clicking the active icon again could
 * collapse the sidebar (future Phase D).
 */
export function ActivityBar({ activePanelId, onSelect }: ActivityBarProps) {
  const panels: PanelDescriptor[] = panelRegistry.getByLocation('sidebar');

  return (
    <view className="ActivityBar">
      {panels.map(p => (
        <view
          key={p.id}
          className={`ActivityBarItem${p.id === activePanelId ? ' ActivityBarItemActive' : ''}`}
          bindtap={() => onSelect(p.id)}
        >
          <text className="ActivityBarIcon">{p.icon}</text>
        </view>
      ))}
    </view>
  );
}
