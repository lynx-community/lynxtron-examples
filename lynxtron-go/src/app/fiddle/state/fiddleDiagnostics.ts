import type { EditorId, FiddleSnapshot } from './FiddleState';

export interface FiddleDiagnosticsPathApi {
  join?: (...parts: string[]) => string;
  tmpdir?: () => string;
}

function fallbackJoin(...parts: string[]): string {
  return parts
    .map((part, index) => index === 0 ? part.replace(/[\\/]+$/, '') : part.replace(/^[\\/]+|[\\/]+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function safeVirtualSourceName(snap: FiddleSnapshot): string {
  const raw = `${snap.source.kind}-${snap.source.ref ?? snap.title}`;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

/**
 * Resolve the path used as the diagnostics document URI.
 *
 * Real local/showcase workspaces keep their absolute path so the TypeScript
 * service can discover package.json and tsconfig files. In-memory fiddles use
 * a stable virtual path below tmpdir; the extension host stores their contents
 * in memory, so no file has to be written to disk.
 */
export function diagnosticUriForFiddleFile(
  snap: FiddleSnapshot,
  id: EditorId,
  pathApi?: FiddleDiagnosticsPathApi | null,
): string | null {
  if (!id || id.startsWith('/') || id.includes('\\')) return null;
  if (!id.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..')) return null;

  const join = pathApi?.join ?? fallbackJoin;
  if ((snap.source.kind === 'showcase' || snap.source.kind === 'local') && snap.source.ref) {
    return join(snap.source.ref, id);
  }

  const tmpRoot = pathApi?.tmpdir?.() ?? '/tmp';
  return join(tmpRoot, 'lynxtron-fiddle-diagnostics', safeVirtualSourceName(snap), id);
}
