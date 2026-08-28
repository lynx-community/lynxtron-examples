import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveBuiltinShowcaseSourceUrl } from './preload-showcase-service';

const temporaryRoots: string[] = [];
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynxtron-builtin-showcase-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveBuiltinShowcaseSourceUrl', () => {
  it('registers Hello as an installer-bundled standard showcase', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'showcase-registry.json'), 'utf8'));
    const entry = registry.showcases.find((item: any) => item.name === '@lynxtron-examples/hello-lynxtron');
    expect(entry).toMatchObject({
      path: 'showcases/hello-lynxtron',
      distribution: 'builtin',
      targets: ['desktop'],
    });
  });

  it('maps a logical built-in URL to its versioned installer artifact', () => {
    const root = makeRoot();
    const artifact = path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.6-64b8f7.tgz');
    fs.writeFileSync(artifact, 'fixture');

    const resolved = resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    );

    expect(fileURLToPath(resolved)).toBe(artifact);
  });

  it('fails loudly when the installer omitted the built-in artifact', () => {
    const root = makeRoot();
    expect(() => resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    )).toThrow('Built-in showcase artifact not found for hello-lynxtron');
  });

  it('rejects an ambiguous installer resource directory', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.5.tgz'), 'old');
    fs.writeFileSync(path.join(root, 'lynxtron-examples-hello-lynxtron-0.1.6.tgz'), 'new');

    expect(() => resolveBuiltinShowcaseSourceUrl(
      'builtin-showcase://hello-lynxtron',
      [root],
    )).toThrow('Multiple built-in artifacts found for hello-lynxtron');
  });
});
