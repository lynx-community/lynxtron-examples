import type { ShowcaseEntry } from '../store';
import type { DeepLinkFileNavigation, HostDeepLinkPayload } from '../../shared/deep-link';

export type DeepLinkDispatchAction =
  | { kind: 'home' }
  | { kind: 'open-showcase'; entry: ShowcaseEntry; navigation?: DeepLinkFileNavigation }
  | { kind: 'open-example'; examplePath: string; navigation?: DeepLinkFileNavigation }
  | { kind: 'open-bundle-url'; url: string; title?: string }
  | { kind: 'error'; message: string };

function error(message: string): DeepLinkDispatchAction {
  return { kind: 'error', message };
}

export function resolveDeepLinkDispatchAction(
  payload: HostDeepLinkPayload | null,
  showcaseRegistry: ShowcaseEntry[],
): DeepLinkDispatchAction | null {
  if (!payload) return null;

  if (payload.kind === 'error') {
    const detail = payload.error.detail ? ` (${payload.error.detail})` : '';
    return error(`Deep link rejected: ${payload.error.message}${detail}`);
  }

  const intent = payload.intent;
  if (intent.kind === 'home') {
    return { kind: 'home' };
  }

  if (intent.kind === 'example-open') {
    return {
      kind: 'open-example',
      examplePath: intent.examplePath,
      ...(intent.navigation ? { navigation: intent.navigation } : {}),
    };
  }

  if (intent.kind === 'bundle-url-open') {
    return {
      kind: 'open-bundle-url',
      url: intent.url,
      ...(intent.title ? { title: intent.title } : {}),
    };
  }

  const showcase = showcaseRegistry.find((entry) => entry.name === intent.showcaseId);
  if (!showcase) {
    return error(`Unknown showcase id: ${intent.showcaseId}`);
  }
  return {
    kind: 'open-showcase',
    entry: showcase,
    ...(intent.navigation ? { navigation: intent.navigation } : {}),
  };
}
