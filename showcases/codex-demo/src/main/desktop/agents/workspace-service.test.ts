import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { WorkspaceService } from './workspace-service';

describe('WorkspaceService', () => {
  it('lists and reads repository files while rejecting escaped paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'codex-demo-workspace-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'main.ts'), 'export const value = 42;\n');
    spawnSync('git', ['init', '-q'], { cwd: root });
    spawnSync('git', ['add', 'src/main.ts'], { cwd: root });

    const service = new WorkspaceService();
    expect(service.snapshot(join(root, 'src')).files).toContain('src/main.ts');
    expect(service.readFile(root, 'src/main.ts')).toMatchObject({
      path: 'src/main.ts',
      language: 'typescript',
      binary: false,
    });
    expect(service.filePath(root, 'src/main.ts')).toBe(join(realpathSync(root), 'src', 'main.ts'));
    expect(() => service.readFile(root, '../outside.txt')).toThrow(/repository-relative|outside/);

    const outside = join(root, '..', 'codex-demo-outside.txt');
    writeFileSync(outside, 'outside');
    symlinkSync(outside, join(root, 'src', 'outside-link'));
    expect(() => service.readFile(root, 'src/outside-link')).toThrow(/outside/);
  });
});
