import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as tar from 'tar';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(pkgDir, '../../showcases/browser');
const target = path.join(pkgDir, 'dist/browser-demo');
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), 'create-browser-demo-'),
);
try {
  // pnpm resolves catalog: and workspace: ranges in the packed source.
  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['pack', '--pack-destination', temporary],
    {
      cwd: source,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    },
  );
  const archive = (await fs.readdir(temporary)).find((name) =>
    name.endsWith('.tgz'),
  );
  if (!archive) throw new Error('Browser source archive was not produced');
  await tar.x({ file: path.join(temporary, archive), cwd: temporary });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(path.join(temporary, 'package'), target, { recursive: true });
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
