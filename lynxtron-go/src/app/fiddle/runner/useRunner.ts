import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { showcaseApi } from '../../store';

export interface RunnerState {
  pid: number | null;
  isRunning: boolean;
  startMs: number | null;
  runCount: number;
  start: (workspace: string) => number | null;
  /** Build then launch (installs deps + `npm start`) — always surfaces a window. */
  startBuildRun: (workspace: string) => Promise<number | null>;
  /** Run via the showcase dev pipeline (installs deps + `npm run dev`). */
  startDev: (workspace: string) => Promise<number | null>;
  stop: () => boolean;
}

export function useRunner(): RunnerState {
  const [pid, setPid] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [runCount, setRunCount] = useState<number>(0);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    if (pid == null) return;
    const tick = () => {
      try {
        const alive = showcaseApi()?.isRunning?.(pid) ?? false;
        if (!alive) { setPid(null); setStartMs(null); return; }
      } catch (_) {}
      pollRef.current = setTimeout(tick, 500);
    };
    tick();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [pid]);

  const start = useCallback((workspace: string) => {
    try {
      const nextPid = showcaseApi()?.run?.(workspace);
      if (typeof nextPid === 'number' && nextPid > 0) {
        setPid(nextPid);
        setStartMs(Date.now());
        setRunCount(c => c + 1);
        return nextPid;
      }
    } catch (_) {}
    return null;
  }, []);

  const startBuildRun = useCallback(async (workspace: string) => {
    try {
      const nextPid = await showcaseApi()?.start?.(workspace);
      if (typeof nextPid === 'number' && nextPid > 0) {
        setPid(nextPid);
        setStartMs(Date.now());
        setRunCount(c => c + 1);
        return nextPid;
      }
    } catch (_) {}
    return null;
  }, []);

  const startDev = useCallback(async (workspace: string) => {
    try {
      const nextPid = await showcaseApi()?.dev?.(workspace);
      if (typeof nextPid === 'number' && nextPid > 0) {
        setPid(nextPid);
        setStartMs(Date.now());
        setRunCount(c => c + 1);
        return nextPid;
      }
    } catch (_) {}
    return null;
  }, []);

  const stop = useCallback(() => {
    if (pid == null) return false;
    const ok = showcaseApi()?.stop?.(pid) ?? false;
    if (ok) { setPid(null); setStartMs(null); }
    return ok;
  }, [pid]);

  return { pid, isRunning: pid != null, startMs, runCount, start, startBuildRun, startDev, stop };
}
