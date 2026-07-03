import { describe, expect, it } from 'vitest';
import { checkDeepLinkActionReadiness } from './deep-link-runtime';
import type { ShowcaseEntry } from '../store';

const showcaseEntry: ShowcaseEntry = {
  name: 'benchmark',
  description: 'bench',
  tags: [],
  url: 'https://example.com/benchmark',
};

describe('checkDeepLinkActionReadiness', () => {
  it('treats null, home, and error actions as ready', () => {
    expect(checkDeepLinkActionReadiness(null, { showcaseReady: false, exampleReady: false })).toEqual({ ready: true });
    expect(checkDeepLinkActionReadiness({ kind: 'home' }, { showcaseReady: false, exampleReady: false })).toEqual({ ready: true });
    expect(checkDeepLinkActionReadiness(
      { kind: 'error', message: 'bad link' },
      { showcaseReady: false, exampleReady: false },
    )).toEqual({ ready: true });
  });

  it('requires showcase runtime before applying showcase action', () => {
    expect(checkDeepLinkActionReadiness(
      { kind: 'open-showcase', entry: showcaseEntry },
      { showcaseReady: false, exampleReady: true },
    )).toEqual({
      ready: false,
      reason: 'showcase api not ready',
    });

    expect(checkDeepLinkActionReadiness(
      { kind: 'open-showcase', entry: showcaseEntry },
      { showcaseReady: true, exampleReady: false },
    )).toEqual({ ready: true });
  });

  it('requires example runtime before applying example action', () => {
    expect(checkDeepLinkActionReadiness(
      { kind: 'open-example', examplePath: 'view' },
      { showcaseReady: true, exampleReady: false },
    )).toEqual({
      ready: false,
      reason: 'example artifact api not ready',
    });

    expect(checkDeepLinkActionReadiness(
      { kind: 'open-example', examplePath: 'view' },
      { showcaseReady: false, exampleReady: true },
    )).toEqual({ ready: true });
  });
});
