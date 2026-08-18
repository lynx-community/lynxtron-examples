import { describe, it, expect } from 'vitest';
import { resolveShowcaseUrl } from '../src/registry/resolver';

describe('resolveShowcaseUrl', () => {
  it('identifies repo showcase from GitHub tree URL', () => {
    const result = resolveShowcaseUrl(
      'https://github.com/user/lynxtron-show-cases/tree/main/showcases/todo-app'
    );
    expect(result).toEqual({
      type: 'repo',
      owner: 'user',
      repo: 'lynxtron-show-cases',
      ref: 'main',
      path: 'showcases/todo-app',
      name: 'todo-app',
    });
  });

  it('handles branch names with slashes', () => {
    const result = resolveShowcaseUrl(
      'https://github.com/user/lynxtron-show-cases/tree/feat/my-branch/showcases/counter'
    );
    expect(result).toEqual({
      type: 'repo',
      owner: 'user',
      repo: 'lynxtron-show-cases',
      ref: 'feat/my-branch',
      path: 'showcases/counter',
      name: 'counter',
    });
  });

  it('identifies external git repo', () => {
    const result = resolveShowcaseUrl('https://github.com/other/my-lynx-app');
    expect(result).toEqual({
      type: 'external',
      url: 'https://github.com/other/my-lynx-app',
      name: 'my-lynx-app',
    });
  });

  it('identifies external git repo with .git suffix', () => {
    const result = resolveShowcaseUrl('https://github.com/other/my-lynx-app.git');
    expect(result).toEqual({
      type: 'external',
      url: 'https://github.com/other/my-lynx-app.git',
      name: 'my-lynx-app',
    });
  });

  it('identifies local tarball from file:// URL', () => {
    const result = resolveShowcaseUrl('file:///path/to/showcases/counter/counter-0.0.1.tgz');
    expect(result).toEqual({
      type: 'local',
      filePath: '/path/to/showcases/counter/counter-0.0.1.tgz',
      name: 'counter',
    });
  });

  it('extracts name from tarball without version', () => {
    const result = resolveShowcaseUrl('file:///tmp/my-app.tgz');
    expect(result).toEqual({
      type: 'local',
      filePath: '/tmp/my-app.tgz',
      name: 'my-app',
    });
  });

  it('identifies a versioned remote tarball artifact', () => {
    expect(resolveShowcaseUrl('https://example.com/releases/counter-0.0.4.tgz')).toEqual({
      type: 'remote-tarball',
      url: 'https://example.com/releases/counter-0.0.4.tgz',
      name: 'counter',
    });
  });

  it('restores the bare showcase name from a scoped release asset', () => {
    const url = 'https://github.com/lynx-community/lynxtron-examples/releases/download/lynxtron-go-v0.0.7/lynxtron-examples-floating-clock.tgz';
    expect(resolveShowcaseUrl(url)).toEqual({
      type: 'remote-tarball',
      url,
      name: 'floating-clock',
    });
  });
});
