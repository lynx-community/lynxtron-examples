import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasPendingChangesets } from './pending-changesets.mjs';

test('route pending and consumed changesets without treating metadata as a release', () => {
  const root = mkdtempSync(join(tmpdir(), 'pending-changesets-'));
  try {
    writeFileSync(join(root, 'README.md'), 'Instructions');
    writeFileSync(join(root, 'config.json'), '{}');
    mkdirSync(join(root, 'ignored.md'));
    assert.equal(hasPendingChangesets(root), false);
    const change = join(root, 'benchmark.md');
    writeFileSync(change, '---\n"@lynxtron-examples/benchmark": patch\n---\nMeasure startup.\n');
    assert.equal(hasPendingChangesets(root), true);
    writeFileSync(change, '---\n---\n');
    assert.equal(hasPendingChangesets(root), true);
    rmSync(change);
    assert.equal(hasPendingChangesets(root), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing changeset directory fails closed instead of enabling publication', () => {
  const root = mkdtempSync(join(tmpdir(), 'missing-changesets-'));
  try { assert.throws(() => hasPendingChangesets(join(root, 'missing')), /ENOENT/); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
