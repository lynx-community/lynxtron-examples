import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { ReviewService } from './review-service';

const directories: string[] = [];

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
}

function repository(): string {
  const directory = mkdtempSync(join(tmpdir(), 'codex-demo-review-'));
  directories.push(directory);
  git(directory, 'init', '-q');
  git(directory, 'config', 'user.name', 'Codex Demo');
  git(directory, 'config', 'user.email', 'codex-demo@example.invalid');
  writeFileSync(join(directory, 'modified.ts'), 'const value = 1;\n');
  writeFileSync(join(directory, 'deleted.ts'), 'export const removed = true;\n');
  git(directory, 'add', '.');
  git(directory, 'commit', '-qm', 'initial');
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('ReviewService', () => {
  it('summarizes Git changes and returns a structured line diff', () => {
    const directory = repository();
    writeFileSync(join(directory, 'modified.ts'), 'const value = 2;\nexport { value };\n');
    writeFileSync(join(directory, 'new.ts'), 'export const added = true;\n');
    unlinkSync(join(directory, 'deleted.ts'));

    const service = new ReviewService();
    const snapshot = service.snapshot(directory);

    expect(snapshot.files.map((file) => [file.path, file.status])).toEqual([
      ['deleted.ts', 'deleted'],
      ['modified.ts', 'modified'],
      ['new.ts', 'added'],
    ]);
    expect(snapshot.additions).toBeGreaterThanOrEqual(3);
    expect(snapshot.deletions).toBeGreaterThanOrEqual(2);

    const lastTurn = service.snapshot(directory, ['modified.ts']);
    expect(lastTurn.files.map((file) => file.path)).toEqual(['modified.ts']);

    const diff = service.fileDiff(directory, 'modified.ts');
    expect(diff.lines.some((line) => line.kind === 'deletion' && line.text.includes('value = 1'))).toBe(true);
    expect(diff.lines.some((line) => line.kind === 'addition' && line.text.includes('value = 2'))).toBe(true);

    const untracked = service.fileDiff(directory, 'new.ts');
    expect(untracked.lines.some((line) => line.kind === 'addition' && line.text.includes('added = true'))).toBe(true);
  });

  it('rejects previews outside the repository', () => {
    const directory = repository();
    const service = new ReviewService();
    expect(() => service.fileDiff(directory, '../outside.ts')).toThrow('outside the task repository');
  });
});
