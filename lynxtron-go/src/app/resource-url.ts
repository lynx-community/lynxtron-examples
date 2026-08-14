const RESOURCE_ROOT_PROP = 'lynxtronGoResourceRoot';

/** Join a packaged file:// resource root with a bundle-owned relative path. */
export function joinResourceUrl(root: string, relativePath: string): string {
  const normalizedRoot = root.replace(/\/+$/, '');
  const normalizedPath = relativePath
    .replace(/^[\\/]+/, '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return normalizedRoot && normalizedPath ? `${normalizedRoot}/${normalizedPath}` : '';
}

/**
 * Resolve a resource copied beside app.asar. The main process injects the
 * install-specific root through Lynx global props before the first frame, so
 * the compiled bundle never contains a CI/build-machine absolute path.
 */
export function appResourceUrl(relativePath: string): string {
  try {
    // In the Lynx background VM `lynx` is a runtime global but is deliberately
    // not attached to globalThis. Keep the globalThis branch for tests/hosts
    // that do expose it there.
    const runtimeLynx = typeof lynx !== 'undefined'
      ? (lynx as any)
      : (globalThis as any)?.lynx;
    const root = runtimeLynx?.__globalProps?.[RESOURCE_ROOT_PROP];
    return typeof root === 'string' ? joinResourceUrl(root, relativePath) : '';
  } catch (_) {
    return '';
  }
}
