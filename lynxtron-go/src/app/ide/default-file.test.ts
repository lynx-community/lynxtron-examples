import { describe, it, expect } from 'vitest';
import { isMetaFile, pickDefaultFile } from './default-file';

describe('isMetaFile', () => {
  it('flags package.json, tsconfig*, *.config.*, lockfiles', () => {
    expect(isMetaFile('package.json')).toBe(true);
    expect(isMetaFile('tsconfig.tools.json')).toBe(true);
    expect(isMetaFile('lynx.config.ts')).toBe(true);
    expect(isMetaFile('rspack.config.ts')).toBe(true);
    expect(isMetaFile('pnpm-lock.yaml')).toBe(true);
  });

  it('does not flag real source or assets', () => {
    expect(isMetaFile('src/app/index.tsx')).toBe(false);
    expect(isMetaFile('App.css')).toBe(false);
    expect(isMetaFile('thumbnail.svg')).toBe(false);
    expect(isMetaFile('README.md')).toBe(false);
  });
});

describe('pickDefaultFile', () => {
  it('prefers a nested source entry point over top-level config', () => {
    // counter showcase: top level is all config + a src/ dir + an svg
    const rel = pickDefaultFile({
      topLevelFiles: ['lynx.config.ts', 'package.json', 'rspack.config.ts', 'thumbnail.svg', 'tsconfig.tools.json'],
      exists: (p) => p === 'src/app/index.tsx',
    });
    expect(rel).toBe('src/app/index.tsx');
  });

  it('honors PRIMARY_ENTRIES priority (index over App)', () => {
    const rel = pickDefaultFile({
      topLevelFiles: [],
      exists: (p) => p === 'src/index.tsx' || p === 'src/App.tsx',
    });
    expect(rel).toBe('src/index.tsx');
  });

  it('falls back to the first top-level source file when no nested entry exists', () => {
    const rel = pickDefaultFile({
      topLevelFiles: ['package.json', 'App.tsx', 'utils.ts'],
      exists: () => false,
    });
    // App.tsx sorts before utils.ts; package.json is meta and skipped
    expect(rel).toBe('App.tsx');
  });

  it('falls back to a non-meta, non-source file rather than a config file', () => {
    const rel = pickDefaultFile({
      topLevelFiles: ['package.json', 'lynx.config.ts', 'thumbnail.svg'],
      exists: () => false,
    });
    expect(rel).toBe('thumbnail.svg');
  });

  it('opens something rather than nothing when only meta files exist', () => {
    const rel = pickDefaultFile({
      topLevelFiles: ['package.json', 'tsconfig.json'],
      exists: () => false,
    });
    expect(rel).toBe('package.json');
  });

  it('returns null for an empty workspace', () => {
    expect(pickDefaultFile({ topLevelFiles: [], exists: () => false })).toBeNull();
  });
});
