import { useState, useEffect, useRef, useCallback } from '@lynx-js/react';
import './TerminalPanel.css';
import { getExposed } from '../../store';
import { LogView } from '../shared/LogView';

interface TerminalPanelProps {
  cwd?: string;
}

const SESSION_ID = 'main-terminal';
const POLL_MS = 100;
const MAX_LINES = 500;

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const [lines, setLines] = useState<string[]>(['Initializing terminal…']);
  const [input, setInput] = useState('');
  const [alive, setAlive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendOutput = useCallback((text: string) => {
    if (!text) return;
    const newLines = text.split('\n');
    setLines(prev => {
      const merged = [...prev, ...newLines];
      return merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged;
    });
  }, []);

  useEffect(() => {
    let pty: any = null;
    try { pty = getExposed()?.pty; } catch (e) {
      setLines([`Error: could not access PTY API — ${e}`]);
      return;
    }
    if (!pty) {
      setLines(['Error: PTY API not available (preload may not have loaded)']);
      return;
    }

    const workDir = cwd || '/';
    try {
      pty.create(SESSION_ID, workDir);
    } catch (e) {
      setLines([`Error: pty.create failed — ${e}`]);
      return;
    }

    setLines([`Connecting to shell… (${workDir})`, '']);
    setAlive(true);

    pollRef.current = setInterval(() => {
      try {
        const out: string = pty.read(SESSION_ID);
        if (out) appendOutput(out);
        const isAlive: boolean = pty.isAlive(SESSION_ID);
        if (!isAlive) setAlive(false);
      } catch (_) {}
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [cwd, appendOutput]);

  useEffect(() => {
    if (cwd && alive) {
      try { getExposed()?.pty?.cd(SESSION_ID, cwd); } catch (_) {}
    }
  }, [cwd, alive]);

  const submitCommand = useCallback(() => {
    const cmd = input.trim();
    setInput('');
    if (!alive) return;
    appendOutput(`$ ${cmd}`);
    try {
      getExposed()?.pty?.write(SESSION_ID, cmd + '\n');
    } catch (_) {}
  }, [input, alive, appendOutput]);

  const handleKeyPress = useCallback((e: any) => {
    const key = e?.detail?.key || e?.key;
    if (key === 'Enter') submitCommand();
  }, [submitCommand]);

  return (
    <view className="TerminalPanel">
      <LogView id="terminal">
        {lines.join('\n') || ' '}
      </LogView>

      <view className="TerminalInputRow">
        <text className="TerminalPrompt">{alive ? '>' : '[exited]'}</text>
        <input
          className="TerminalInput"
          value={input}
          placeholder="type command…"
          bindinput={(e: any) => setInput(e?.detail?.value ?? e?.value ?? '')}
          bindconfirm={submitCommand}
          bindkeyboardheightchange={handleKeyPress}
        />
        <view className="TerminalEnterBtn" bindtap={submitCommand}>
          <text className="TerminalEnterText">{'\u21B5'}</text>
        </view>
      </view>
    </view>
  );
}
