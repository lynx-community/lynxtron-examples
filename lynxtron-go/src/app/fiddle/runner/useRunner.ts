import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';
import { showcaseApi } from '../../store';

export interface RunnerState {
  pid: number | null;
  isRunning: boolean;
  startMs: number | null;
  runCount: number;
  runProject: (projectRoot: string, runtimeExecutable?: string) => Promise<number | null>;
  stop: () => boolean;
  cancelTasks: () => void;
}

export function useRunner(): RunnerState {
  const [pid, setPid] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [runCount, setRunCount] = useState<number>(0);
  const pollRef = useRef<any>(null);
  const generation = useRef(0);

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
    const current = generation.current;
    try {
      const nextPid = await showcaseApi()?.runProject?.(projectRoot, runtimeExecutable);
      if (current !== generation.current) {
        if (typeof nextPid === 'number') showcaseApi()?.stop(nextPid);
        return null;
      }
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

  const cancelTasks = useCallback(() => {
    generation.current += 1;
    showcaseApi()?.cancelTasks();
    if (pollRef.current) clearTimeout(pollRef.current);
    setPid(null);
    setStartMs(null);
  }, []);

  return { pid, isRunning: pid != null, startMs, runCount, runProject, stop, cancelTasks };
}
