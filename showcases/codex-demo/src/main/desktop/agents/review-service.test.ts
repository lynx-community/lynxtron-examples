import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
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
  it('summarizes Git changes and returns a structured line diff', async () => {
    const directory = repository();
    writeFileSync(join(directory, 'modified.ts'), 'const value = 2;\nexport { value };\n');
    writeFileSync(join(directory, 'new.ts'), 'export const added = true;\n');
    mkdirSync(join(directory, 'hello-world'));
    writeFileSync(join(directory, 'hello-world', 'hello.js'), 'console.log("Hello, world!");\n');
    unlinkSync(join(directory, 'deleted.ts'));

    const service = new ReviewService();
    const snapshot = await service.snapshot(directory);

    expect(snapshot.files.map((file) => [file.path, file.status])).toEqual([
      ['deleted.ts', 'deleted'],
      ['hello-world/hello.js', 'added'],
      ['modified.ts', 'modified'],
      ['new.ts', 'added'],
    ]);
    expect(snapshot.additions).toBeGreaterThanOrEqual(3);
    expect(snapshot.deletions).toBeGreaterThanOrEqual(2);

    const lastTurn = await service.snapshot(directory, ['modified.ts']);
    expect(lastTurn.files.map((file) => file.path)).toEqual(['modified.ts']);

    const changedDirectory = await service.snapshot(directory, ['hello-world']);
    expect(changedDirectory.files.map((file) => file.path)).toEqual(['hello-world/hello.js']);

    const diff = await service.fileDiff(directory, 'modified.ts');
    expect(diff.lines.some((line) => line.kind === 'deletion' && line.text.includes('value = 1'))).toBe(true);
    expect(diff.lines.some((line) => line.kind === 'addition' && line.text.includes('value = 2'))).toBe(true);

    const untracked = await service.fileDiff(directory, 'new.ts');
    expect(untracked.lines.some((line) => line.kind === 'addition' && line.text.includes('added = true'))).toBe(true);
  });

  it('rejects previews outside the repository', async () => {
    const directory = repository();
    const service = new ReviewService();
    await expect(service.fileDiff(directory, '../outside.ts')).rejects.toThrow('outside the task repository');
  });

  it('includes files changed by the agent even when Git ignores them', async () => {
    const directory = repository();
    writeFileSync(join(directory, '.git', 'info', 'exclude'), 'agent-only/\n');
    mkdirSync(join(directory, 'agent-only'));
    writeFileSync(join(directory, 'agent-only', 'ignored.txt'), 'hello\n');

    const service = new ReviewService();
    const gitOnly = await service.snapshot(directory);
    expect(gitOnly.files.some((file) => file.path === 'agent-only/ignored.txt')).toBe(false);

    const turn = await service.snapshot(directory, ['agent-only/ignored.txt']);
    expect(turn.files).toEqual([expect.objectContaining({
      path: 'agent-only/ignored.txt',
      status: 'added',
      source: 'agent',
      additions: 1,
    })]);

    const diff = await service.fileDiff(directory, 'agent-only/ignored.txt', turn.files[0]);
    expect(diff.lines.some((line) => line.kind === 'addition' && line.text === 'hello')).toBe(true);
  });
});
