import { useEffect, useState } from '@lynx-js/react';
import { showcaseApi, SHOWCASE_REGISTRY, type ShowcaseEntry } from '../store';

const bakedEntries = [...SHOWCASE_REGISTRY];
let inflight: Promise<void> | undefined;
const listeners = new Set<() => void>();

export async function refreshShowcaseCatalog(): Promise<void> {
  const catalog = showcaseApi()?.catalog;
  if (!catalog) return;
  if (!inflight) {
    inflight = (async () => {
      try {
        const remote: ShowcaseEntry[] = await catalog(bakedEntries);
        if (!remote?.length) return;
        const builtins = new Set(bakedEntries.filter(e => e.distribution === 'builtin').map(e => e.name));
        const merged = new Map(bakedEntries.map(entry => [entry.name, entry]));
        for (const entry of remote) {
          if (!builtins.has(entry.name)) merged.set(entry.name, { ...merged.get(entry.name), ...entry });
        }
        SHOWCASE_REGISTRY.splice(0, SHOWCASE_REGISTRY.length, ...merged.values());
        for (const listener of listeners) listener();
      } catch { /* The baked registry remains usable offline and on old hosts. */ }
    })().finally(() => { inflight = undefined; });
  }
  return inflight;
}

/** Refresh asynchronously: never put the first screen behind the network. */
export function useShowcaseCatalog(): void {
  const [, rerender] = useState(0);
  useEffect(() => {
    const notify = () => rerender(value => value + 1);
    listeners.add(notify);
    void refreshShowcaseCatalog();
    const timer = setInterval(() => { void refreshShowcaseCatalog(); }, 60_000);
    return () => { clearInterval(timer); listeners.delete(notify); };
  }, []);
}
