import { describe, expect, it } from 'vitest';
import { appResourceUrl, joinResourceUrl } from './resource-url';

describe('joinResourceUrl', () => {
  it('joins a packaged resource root without leaking a build path', () => {
    expect(joinResourceUrl(
      'file:///Applications/Lynxtron%20Go.app/Contents/Resources/',
      'thumbnails/showcases__counter__thumbnail.png',
    )).toBe(
      'file:///Applications/Lynxtron%20Go.app/Contents/Resources/thumbnails/showcases__counter__thumbnail.png',
    );
  });

  it('normalizes separators and URL-encodes path segments', () => {
    expect(joinResourceUrl('file:///tmp/resources', '\\brand\\Lynxtron mark.png'))
      .toBe('file:///tmp/resources/brand/Lynxtron%20mark.png');
  });

  it('rejects an empty root or path', () => {
    expect(joinResourceUrl('', 'brand/lynxtron.png')).toBe('');
    expect(joinResourceUrl('file:///tmp/resources', '')).toBe('');
  });

  it('reads the resource root from Lynx global props', () => {
    (globalThis as any).lynx = {
      __globalProps: { lynxtronGoResourceRoot: 'file:///tmp/runtime-resources/' },
    };
    expect(appResourceUrl('brand/lynxtron.png'))
      .toBe('file:///tmp/runtime-resources/brand/lynxtron.png');
    delete (globalThis as any).lynx;
  });
});
