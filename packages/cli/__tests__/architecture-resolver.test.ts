import { expect, it } from 'vitest';
import { resolveShowcaseUrl } from '../src/registry/resolver.js';
it('keeps the package identity across every native tarball variant', () => {
  for (const name of ['browser', 'native-texture-canvas', 'todolist']) {
    for (const suffix of ['mac-arm64', 'mac-x64', 'win-x64', 'mac', 'win']) {
      expect(resolveShowcaseUrl(`https://github.com/lynx-community/lynxtron-examples/releases/download/v1/lynxtron-examples-${name}-${suffix}.tgz`).name).toBe(name);
    }
  }
});
