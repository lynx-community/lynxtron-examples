export type ShowcaseSourceMode = 'remote' | 'local-registry' | 'local-workspace';

export function resolveExplicitShowcaseSourceMode(
  value: string | undefined,
): ShowcaseSourceMode | undefined {
  if (
    value === 'remote'
    || value === 'local-registry'
    || value === 'local-workspace'
  ) {
    return value;
  }
  return undefined;
}

export function resolveRemoteShowcaseRef(
  explicitRef: string | undefined,
  gitRef: string,
): string {
  return explicitRef?.trim() || gitRef;
}
