// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moveFile } from '../../../scripts/move-file.mjs';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('moveFile', () => {
  it('copies and removes the source when rename crosses volumes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-move-file-'));
    roots.push(root);
    const source = path.join(root, 'source.tgz');
    const destination = path.join(root, 'destination.tgz');
    fs.writeFileSync(source, 'artifact');

    await moveFile(source, destination, {
      renameFile: async () => {
        const error = new Error('cross-device link not permitted') as NodeJS.ErrnoException;
        error.code = 'EXDEV';
        throw error;
      },
    });

    expect(fs.existsSync(source)).toBe(false);
    expect(fs.readFileSync(destination, 'utf8')).toBe('artifact');
  });
});
