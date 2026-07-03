import { useState, useEffect } from '@lynx-js/react';
import './BottomPanel.css';
import { panelRegistry, type PanelDescriptor } from './PanelRegistry';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { OutputPanel } from '../Output/OutputPanel';

interface BottomPanelProps {
  onClose: () => void;
  /** Current workspace root — passed to Terminal for CWD. */
  rootPath?: string;
  /** Force-switch to a specific tab (e.g. 'output' on error). */
  activeTabOverride?: string;
}

/**
 * Bottom panel area with tab bar (Terminal / Output / Problems).
 * Appears below the editor when toggled open.
 */
export function BottomPanel({ onClose, rootPath, activeTabOverride }: BottomPanelProps) {
  const panels: PanelDescriptor[] = panelRegistry.getByLocation('bottom');
  const [activeId, setActiveId] = useState(panels[0]?.id || 'terminal');

  // Allow parent to force-switch tab (e.g. show Output on error)
  useEffect(() => {
    if (activeTabOverride) setActiveId(activeTabOverride);
  }, [activeTabOverride]);

  function renderBody() {
    if (activeId === 'terminal') {
      return <TerminalPanel cwd={rootPath} />;
    }
    if (activeId === 'output') {
      return <OutputPanel />;
    }
    return (
      <view className="BottomPanelPlaceholder">
        <text className="BottomPanelPlaceholderText">
          No problems detected.
        </text>
      </view>
    );
  }

  return (
    <view className="BottomPanel">
      <view className="BottomPanelHeader">
        <view className="BottomPanelTabs">
          {panels.map(p => (
            <view
              key={p.id}
              className={`BottomPanelTab${p.id === activeId ? ' BottomPanelTabActive' : ''}`}
              bindtap={() => setActiveId(p.id)}
            >
              <text className="BottomPanelTabText">{p.title.toUpperCase()}</text>
            </view>
          ))}
        </view>
        <view className="BottomPanelClose" bindtap={onClose}>
          <text className="BottomPanelCloseText">{'\u2715'}</text>
        </view>
      </view>

      <view className="BottomPanelBody">
        {renderBody()}
      </view>
    </view>
  );
}
