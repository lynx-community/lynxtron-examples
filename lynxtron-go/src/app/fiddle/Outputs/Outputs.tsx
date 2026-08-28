import { useEffect, useState, useRef, useCallback } from '@lynx-js/react';
import {
  foundationApi,
  ensureProcessLogPolling,
  getProcessLog,
  subscribeProcessLog,
  clearProcessLog,
  type ProcessLogEntry,
} from '../../store';
import { Tag, Spinner } from '../bp';
import './Outputs.css';

export interface OutputsProps {
  runningPid: number | null;
  runStartMs: number | null;
  bumpKey?: number;
  /** A run launched outside the fiddle runner (gallery Run / Run-on-Web). */
  externalPid?: number | null;
  onStopExternal?: () => void;
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function Outputs(props: OutputsProps) {
  const [entries, setEntries] = useState<ProcessLogEntry[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // Clear the console when a new run starts (bumpKey changes).
  const firstBump = useRef(true);
  useEffect(() => {
    if (firstBump.current) { firstBump.current = false; return; }
    clearProcessLog();
    setEntries([]);
  }, [props.bumpKey]);

  // Render from the SHARED process log (store owns the single drain poller;
  // the gallery console reads the same stream). Synchronous subscription —
  // no consumer-side re-poll of an array in the same JS context.
  useEffect(() => {
    ensureProcessLogPolling();
    const sync = () => setEntries([...getProcessLog()]);
    sync();
    return subscribeProcessLog(sync);
  }, []);

  // Uptime ticker while a fiddle is running.
  useEffect(() => {
    if (props.runningPid == null) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [props.runningPid]);

  const clear = useCallback(() => { clearProcessLog(); setEntries([]); }, []);

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<any>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const copyAll = useCallback(() => {
    const text = entriesRef.current
      .map(e => `${e.timestamp} ${e.message}`)
      .join('\n');
    if (!text) return;
    const ok = foundationApi()?.clipboard?.writeText?.(text) === true;
    if (!ok) return;
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1200);
  }, []);
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  const uptimeMs = props.runningPid != null && props.runStartMs != null
    ? nowMs - props.runStartMs
    : null;
  return (
    <view className="Outputs">
      <view className="Outputs-Header">
        <view className="Outputs-HeaderLeft">
          <text className="Outputs-Title">Console</text>
          {props.runningPid != null ? (
            <view className="Outputs-Status">
              <Spinner size={12} intent="success" />
              <Tag intent="success" minimal>
                pid {props.runningPid} · {uptimeMs != null ? formatUptime(uptimeMs) : ''}
              </Tag>
            </view>
          ) : props.externalPid != null ? (
            <view className="Outputs-Status">
              <Spinner size={12} intent="success" />
              <Tag intent="success" minimal>pid {props.externalPid}</Tag>
            </view>
          ) : entries.length > 0 ? (
            <Tag minimal>idle</Tag>
          ) : null}
        </view>
        <view className="Outputs-HeaderRight">
          {props.externalPid != null && props.onStopExternal ? (
            <view className="Outputs-Clear" bindtap={props.onStopExternal}>
              <text className="Outputs-StopText">Stop</text>
            </view>
          ) : null}
          <view className="Outputs-Clear" bindtap={copyAll}>
            <text className="Outputs-ClearText">{copied ? 'Copied!' : 'Copy'}</text>
          </view>
          <view className="Outputs-Clear" bindtap={clear}>
            <text className="Outputs-ClearText">Clear</text>
          </view>
        </view>
      </view>
      <scroll-view className="Outputs-Body" scroll-orientation="vertical">
        <text
          className={entries.length === 0 ? 'Outputs-Log Outputs-IdleHint' : 'Outputs-Log'}
          text-selection={true}
          flatten={false}
        >
          {entries.length === 0
            ? 'Run output streams here · ⌘R'
            : entries.map((entry, index) => (
              // Keep every styled span below one selectable text root. This
              // preserves PR #78's continuous cross-line selection while
              // restoring the per-stream intent colours it removed.
              <text key={entry.seq ?? index} className="Outputs-Entry">
                <text className="Outputs-Timestamp">{entry.timestamp}</text>
                {'  '}
                <text className={`Outputs-Message Outputs-Message--${entry.stream}`}>{entry.message}</text>
                {index < entries.length - 1 ? '\n' : ''}
              </text>
            ))}
        </text>
      </scroll-view>
    </view>
  );
}
