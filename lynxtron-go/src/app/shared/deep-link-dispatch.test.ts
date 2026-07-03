import { describe, expect, it } from 'vitest';
import { resolveDeepLinkDispatchAction } from './deep-link-dispatch';
import type { ShowcaseEntry } from '../store';
import type { HostDeepLinkPayload } from '../../shared/deep-link';

const registry: ShowcaseEntry[] = [
  {
    name: 'benchmark',
    description: 'bench',
    tags: [],
    url: 'https://example.com/benchmark',
  },
];

describe('resolveDeepLinkDispatchAction', () => {
  it('maps home intent to home action', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: { kind: 'home' },
      rawUrl: 'lynxtron://home',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({ kind: 'home' });
  });

  it('maps showcase intent using baked registry', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: {
        kind: 'showcase-open',
        showcaseId: 'benchmark',
        navigation: {
          filePath: 'src/app/App.tsx',
          line: 12,
          column: 4,
        },
      },
      rawUrl: 'lynxtron://showcase/open?id=benchmark',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({
      kind: 'open-showcase',
      entry: registry[0],
      navigation: {
        filePath: 'src/app/App.tsx',
        line: 12,
        column: 4,
      },
    });
  });

  it('returns explicit error for unknown showcase id', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: { kind: 'showcase-open', showcaseId: 'unknown' },
      rawUrl: 'lynxtron://showcase/open?id=unknown',
      source: 'test',
    };
    const action = resolveDeepLinkDispatchAction(payload, registry);
    expect(action).toEqual({
      kind: 'error',
      message: 'Unknown showcase id: unknown',
    });
  });

  it('maps example intent to open-example action', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: {
        kind: 'example-open',
        examplePath: 'view',
        navigation: {
          filePath: 'src/App.tsx',
        },
      },
      rawUrl: 'lynxtron://example/open?path=view',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({
      kind: 'open-example',
      examplePath: 'view',
      navigation: {
        filePath: 'src/App.tsx',
      },
    });
  });

  it('passes through host parse error as user-readable message', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'error',
      error: {
        code: 'MISSING_PARAM',
        message: 'Missing showcase id in deep link',
        detail: 'Use lynxtron://showcase/open?id=<showcase-id>',
      },
      rawUrl: 'lynxtron://showcase/open',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({
      kind: 'error',
      message: 'Deep link rejected: Missing showcase id in deep link (Use lynxtron://showcase/open?id=<showcase-id>)',
    });
  });

  it('maps bundle URL intent to open-bundle-url action', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: {
        kind: 'bundle-url-open',
        url: 'https://example.com/bundle.lynx',
      },
      rawUrl: 'lynxtron://lynxview_page?bundle=https://example.com/bundle.lynx',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({
      kind: 'open-bundle-url',
      url: 'https://example.com/bundle.lynx',
    });
  });

  it('maps bundle URL intent with title to open-bundle-url action', () => {
    const payload: HostDeepLinkPayload = {
      kind: 'intent',
      intent: {
        kind: 'bundle-url-open',
        url: 'https://example.com/bundle.lynx',
        title: 'My App',
      },
      rawUrl: 'lynxtron://lynxview_page?bundle=https://example.com/bundle.lynx&title=My%20App',
      source: 'test',
    };
    expect(resolveDeepLinkDispatchAction(payload, registry)).toEqual({
      kind: 'open-bundle-url',
      url: 'https://example.com/bundle.lynx',
      title: 'My App',
    });
  });
});
