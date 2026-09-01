import { describe, expect, it } from 'vitest';
import {
  FIDDLE_SHOWCASE_NAME,
  HELLO_SHOWCASE_NAME,
  type ShowcaseEntry,
} from '../../store';
import { resolveGalleryShowcases } from './gallery-visibility';

function entry(name: string): ShowcaseEntry {
  return { name, description: '', tags: [], url: '' };
}

describe('Gallery showcase visibility', () => {
  const fiddle = entry(FIDDLE_SHOWCASE_NAME);
  const hello = entry(HELLO_SHOWCASE_NAME);
  const regular = entry('@lynxtron-examples/native-texture-canvas');

  it('hides internal Gallery entries when the build switch is off', () => {
    expect(resolveGalleryShowcases([fiddle, hello, regular], false)).toEqual({
      featured: [regular],
      fiddleShowcase: undefined,
    });
  });

  it('restores the collection and Hello card when the build switch is on', () => {
    expect(resolveGalleryShowcases([fiddle, hello, regular], true)).toEqual({
      featured: [hello, regular],
      fiddleShowcase: fiddle,
    });
  });
});
