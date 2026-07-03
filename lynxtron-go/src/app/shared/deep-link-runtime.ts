import type { DeepLinkDispatchAction } from './deep-link-dispatch';

export interface DeepLinkRuntimeReadiness {
  showcaseReady: boolean;
  exampleReady: boolean;
}

export interface DeepLinkActionReadinessResult {
  ready: boolean;
  reason?: string;
}

export function checkDeepLinkActionReadiness(
  action: DeepLinkDispatchAction | null,
  readiness: DeepLinkRuntimeReadiness,
): DeepLinkActionReadinessResult {
  if (!action) {
    return { ready: true };
  }

  if (action.kind === 'open-showcase') {
    return readiness.showcaseReady
      ? { ready: true }
      : { ready: false, reason: 'showcase api not ready' };
  }

  if (action.kind === 'open-example') {
    return readiness.exampleReady
      ? { ready: true }
      : { ready: false, reason: 'example artifact api not ready' };
  }

  if (action.kind === 'open-bundle-url') {
    return readiness.exampleReady
      ? { ready: true }
      : { ready: false, reason: 'deep link bridge not ready' };
  }

  return { ready: true };
}

export function shouldDeferDeepLinkAction(
  action: DeepLinkDispatchAction | null,
  readiness: DeepLinkRuntimeReadiness,
): boolean {
  return !checkDeepLinkActionReadiness(action, readiness).ready;
}
