export type RunControlState = 'idle' | 'loading' | 'running';

/** Running wins so the button becomes Stop as soon as a PID exists. */
export function resolveRunControlState(isRunning: boolean, isLoading: boolean): RunControlState {
  if (isRunning) return 'running';
  if (isLoading) return 'loading';
  return 'idle';
}
