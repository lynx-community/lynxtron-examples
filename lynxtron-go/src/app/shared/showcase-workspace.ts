import { showcaseApi, SHOWCASE_LOCAL_WORKSPACE, type ShowcaseEntry } from '../store';

/**
 * Where a showcase's source lives on disk, resolved the same way for both
 * products.
 *
 * The Fiddle and the IDE are two views of one workspace — the Fiddle reads a
 * handful of source files into its editor mosaic, the IDE opens the folder as a
 * tree — but each used to carry its own copy of this policy. Two functions
 * meaning the same thing drift, and they shared every failure anyway.
 *
 * The order matters:
 *
 *  1. **Local source tree.** In local-workspace builds a showcase is right
 *     there in the monorepo; downloading a copy of it would be absurd.
 *  2. **Already materialized.** `fetch` wipes and re-extracts its destination
 *     on every call, so without this step opening a showcase in the Fiddle and
 *     then in the IDE re-downloads and re-installs a workspace that is already
 *     sitting on disk, seconds apart.
 *  3. **Fetch.** Only when there is nothing to reuse.
 */
export interface ResolveShowcaseWorkspaceHooks {
  /** Called when step 3 is about to run, so callers can show progress. */
  onFetchStart?: (entry: ShowcaseEntry) => void;
  /** Called when step 2 hit, so callers can say why it was instant. */
  onReuse?: (entry: ShowcaseEntry, path: string) => void;
}

export async function resolveShowcaseWorkspacePath(
  entry: ShowcaseEntry,
  hooks: ResolveShowcaseWorkspaceHooks = {},
): Promise<string | null> {
  const api = showcaseApi();

  try {
    if (SHOWCASE_LOCAL_WORKSPACE && entry.path) {
      const local = api?.resolveRegistryPath?.(entry.path);
      if (local) return local;
    }
  } catch (_) { /* fall through to the remote paths */ }

  try {
    const existing = api?.materializedPath?.(entry.name);
    if (existing) {
      hooks.onReuse?.(entry, existing);
      return existing;
    }
  } catch (_) { /* an unreadable cache is just a cache miss */ }

  if (!entry.url) return null;
  const fetchFn = api?.fetch;
  if (typeof fetchFn !== 'function') return null;
  hooks.onFetchStart?.(entry);
  const fetched = await fetchFn(entry.url);
  return fetched || null;
}
