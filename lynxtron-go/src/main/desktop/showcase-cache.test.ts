import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { resolveMaterializedShowcasePath } from './showcase-cache';

describe('showcase cache resolution', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makeWorkspace(sourceUrl?: string): string {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-showcase-cache-'));
    tmpDirs.push(workspaceRoot);
    const showcasePath = path.join(workspaceRoot, 'showcases', 'floating-clock');
    fs.mkdirSync(showcasePath, { recursive: true });
    fs.writeFileSync(
      path.join(showcasePath, 'package.json'),
      JSON.stringify({
        name: '@lynxtron-examples/floating-clock',
        showcase: { description: 'clock' },
      }),
      'utf-8',
    );
    if (sourceUrl) {
      const cacheKey = createHash('sha256').update(`${process.platform}\0${process.arch}\0${sourceUrl}`).digest('hex');
      fs.writeFileSync(
        path.join(showcasePath, '.lynxtron-go-cache.json'),
        JSON.stringify({ schemaVersion: 1, cacheKey }),
        'utf-8',
      );
    }
    return workspaceRoot;
  }

  it('reuses a workspace materialized from the current registry URL', () => {
    const sourceUrl = 'https://example.com/releases/v2/floating-clock.tgz';
    const workspaceRoot = makeWorkspace(sourceUrl);

    expect(resolveMaterializedShowcasePath(
      workspaceRoot,
      '@lynxtron-examples/floating-clock',
      sourceUrl,
    )).toBe(path.join(workspaceRoot, 'showcases', 'floating-clock'));
  });

  it('invalidates a workspace materialized from an older registry URL', () => {
    const workspaceRoot = makeWorkspace('https://example.com/releases/v1/floating-clock.tgz');

    expect(resolveMaterializedShowcasePath(
      workspaceRoot,
      '@lynxtron-examples/floating-clock',
      'https://example.com/releases/v2/floating-clock.tgz',
    )).toBeNull();
  });

  it('invalidates legacy caches that have no cache identity', () => {
    const workspaceRoot = makeWorkspace();

    expect(resolveMaterializedShowcasePath(
      workspaceRoot,
      '@lynxtron-examples/floating-clock',
      'https://example.com/releases/v2/floating-clock.tgz',
    )).toBeNull();
  });

  it('invalidates the same URL materialized by another architecture', () => {
    const url = 'https://example.com/app.tgz';
    const root = makeWorkspace(url);
    const otherArch = process.arch === 'arm64' ? 'x64' : 'arm64';
    const cacheKey = createHash('sha256').update(`${process.platform}\0${otherArch}\0${url}`).digest('hex');
    fs.writeFileSync(path.join(root, 'showcases/floating-clock/.lynxtron-go-cache.json'), JSON.stringify({schemaVersion: 1, cacheKey}));
    expect(resolveMaterializedShowcasePath(root, 'floating-clock', url)).toBeNull();
  });
});
