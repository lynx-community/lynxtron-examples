import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { showcaseApi } from '../../store';

export interface RunnerState {
  pid: number | null;
  isRunning: boolean;
  startMs: number | null;
  runCount: number;
  runProject: (projectRoot: string, runtimeExecutable?: string) => Promise<number | null>;
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

  const runProject = useCallback(async (projectRoot: string, runtimeExecutable?: string) => {
    try {
      const nextPid = await showcaseApi()?.runProject?.(projectRoot, runtimeExecutable);
      if (typeof nextPid === 'number' && nextPid > 0) {
        setPid(nextPid);
        setStartMs(Date.now());
        setRunCount(c => c + 1);
        return nextPid;
      }
    } catch (error) {
      // Preserve the native cause (Node version, install/build failure, missing
      // output, spawn error). Returning null reduced all of them to the same
      // misleading "failed to spawn" message.
      throw error;
    }
    return null;
  }, []);

  const stop = useCallback(() => {
    if (pid == null) return false;
    const ok = showcaseApi()?.stop?.(pid) ?? false;
    if (ok) { setPid(null); setStartMs(null); }
    return ok;
  }, [pid]);

  return { pid, isRunning: pid != null, startMs, runCount, runProject, stop };
}
