import { describe, expect, it } from 'vitest';
import { normalizePreloadProcessEntries } from './store';

describe('normalizePreloadProcessEntries', () => {
  it('adds timestamps and maps preload levels to UI streams', () => {
    expect(normalizePreloadProcessEntries([
      { level: 'info', source: 'showcase.run', message: '$ npm run build' },
      { level: 'info', source: 'showcase.run', message: 'compiled' },
      { level: 'error', source: 'showcase.run', message: 'failed' },
    ], '12:34:56')).toEqual([
      { timestamp: '12:34:56', stream: 'command', message: '$ npm run build' },
      { timestamp: '12:34:56', stream: 'stdout', message: 'compiled' },
      { timestamp: '12:34:56', stream: 'stderr', message: 'failed' },
    ]);
  });
});
