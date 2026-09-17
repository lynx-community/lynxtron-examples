import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('publish validation accepts nested upload-artifact paths and rejects missing architectures', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/release-installers.yml', import.meta.url), 'utf8');
  // Stop at any sibling step (name, uses, id...), not only an action step.
  // Otherwise a following named run step becomes part of the shell script.
  const block = workflow.split('      - name: Verify all architectures are present\n')[1].split(/^      - /m)[0];
  const script = block.split('        run: |\n')[1].replace(/^          /gm, '');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-release-assets-test-'));
  const installer = path.join(root, 'release-assets/lynxtron-go/dist');
  const showcases = path.join(root, 'release-assets/dist/showcase-artifacts');
  try {
    fs.mkdirSync(installer, { recursive: true });
    fs.mkdirSync(showcases, { recursive: true });
    for (const name of ['lynxtron-go-darwin-arm64.dmg', 'lynxtron-go-darwin-x64.dmg', 'lynxtron-go-win32-x64.exe']) {
      fs.writeFileSync(path.join(installer, name), '');
    }
    const run = () => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], { cwd: root });
    assert.notEqual(run().status, 0, 'an empty showcase set must fail');
    for (const arch of ['mac-arm64', 'mac-x64', 'win-x64']) {
      fs.writeFileSync(path.join(showcases, `lynxtron-examples-browser-${arch}.tgz`), '');
    }
    const complete = run();
    assert.equal(complete.status, 0, `all architectures in nested paths should pass: ${complete.stderr}`);
    fs.unlinkSync(path.join(showcases, 'lynxtron-examples-browser-mac-x64.tgz'));
    assert.notEqual(run().status, 0, 'missing x64 showcase must fail');
    fs.writeFileSync(path.join(showcases, 'lynxtron-examples-browser-mac-x64.tgz'), '');
    fs.unlinkSync(path.join(installer, 'lynxtron-go-darwin-x64.dmg'));
    assert.notEqual(run().status, 0, 'missing x64 installer must fail');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
