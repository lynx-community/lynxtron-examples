export type EventType =
  | { type: 'fetch-start'; name: string }
  | { type: 'fetch-success'; name: string; path: string }
  | { type: 'fetch-error'; name: string; error: string }
  | { type: 'install-start'; name: string }
  | { type: 'install-success'; name: string }
  | { type: 'build-start'; name: string }
  | { type: 'build-success'; name: string; distPath: string }
  | { type: 'build-error'; name: string; errors: string[] }
  | { type: 'list'; showcases: Array<{ name: string; description: string; local: boolean }> }
  | { type: 'run-start'; name: string; pid: number }
  | { type: 'run-exit'; name: string; code: number };

export function emit(event: EventType): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

export function log(message: string): void {
  process.stderr.write(message + '\n');
}
