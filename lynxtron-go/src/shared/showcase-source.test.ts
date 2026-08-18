// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  resolveExplicitShowcaseSourceMode,
  resolveRemoteShowcaseRef,
} from './showcase-source';

describe('showcase source build configuration', () => {
  it('accepts an explicit remote source mode for release builds', () => {
    expect(resolveExplicitShowcaseSourceMode('remote')).toBe('remote');
  });

  it('keeps the existing local source modes', () => {
    expect(resolveExplicitShowcaseSourceMode('local-registry')).toBe(
      'local-registry',
    );
    expect(resolveExplicitShowcaseSourceMode('local-workspace')).toBe(
      'local-workspace',
    );
  });

  it('prefers an immutable release ref over the checkout branch', () => {
    expect(
      resolveRemoteShowcaseRef(
        'lynxtron-go-v0.1.5',
        'codex/dynamic-native-extension',
      ),
    ).toBe('lynxtron-go-v0.1.5');
  });
});
