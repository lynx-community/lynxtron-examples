import { useState, useEffect } from '@lynx-js/react';
import './OutputPanel.css';
import { getOutputLog, getOutputVersion, type OutputEntry } from '../../store';
import { LogView } from '../shared/LogView';

export function OutputPanel() {
  const [entries, setEntries] = useState<OutputEntry[]>([]);

  useEffect(() => {
    let lastVersion = -1;
    const interval = setInterval(() => {
      const v = getOutputVersion();
      if (v !== lastVersion) {
        lastVersion = v;
        setEntries([...getOutputLog()]);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <view className="OutputPanel">
      <LogView id="output">
        {entries.length === 0 ? (
          <text className="OutputDim">No output.</text>
        ) : (
          entries.map((e, i) => (
            <text key={i}>
              <text className="OutputTime">{e.timestamp}</text>
              <text className={`OutputTag OutputTag-${e.level}`}>
                {e.level === 'error' ? ' [ERROR] ' : e.level === 'warn' ? ' [WARN] ' : ' [INFO] '}
              </text>
              <text className={`OutputMsg OutputMsg-${e.level}`}>{e.message}</text>
              {'\n'}
            </text>
          ))
        )}
      </LogView>
    </view>
  );
}
