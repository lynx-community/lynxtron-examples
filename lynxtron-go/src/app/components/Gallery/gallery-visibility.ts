import {
  FIDDLE_SHOWCASE_NAME,
  HELLO_SHOWCASE_NAME,
  type ShowcaseEntry,
} from '../../store';

/** Resolve only the Gallery surface; the full registry remains available elsewhere. */
export function resolveGalleryShowcases(
  entries: ShowcaseEntry[],
  internalShowcasesEnabled: boolean,
): { featured: ShowcaseEntry[]; fiddleShowcase?: ShowcaseEntry } {
  const fiddleShowcase = internalShowcasesEnabled
    ? entries.find(entry => entry.name === FIDDLE_SHOWCASE_NAME)
    : undefined;
  const featured = entries.filter(entry => (
    entry.name !== FIDDLE_SHOWCASE_NAME
    && (internalShowcasesEnabled || entry.name !== HELLO_SHOWCASE_NAME)
  ));

  return { featured, fiddleShowcase };
}
