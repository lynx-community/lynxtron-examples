import { WorkspaceManager } from '../workspace/manager.js';
import { emit, log } from '../utils/ndjson.js';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface BuildOptions {
  watch?: boolean;
  workspaceRoot: string;
}

export async function build(name: string, options: BuildOptions): Promise<void> {
  const manager = new WorkspaceManager(options.workspaceRoot);
  const showcasePath = findShowcasePath(name, manager);

  if (!showcasePath) {
    emit({ type: 'build-error', name, errors: [`Showcase "${name}" not found`] });
    return;
  }

  const cmd = options.watch ? 'dev' : 'build';
  emit({ type: 'build-start', name });
  log(`Running pnpm run ${cmd} in ${showcasePath}...`);

  const child = spawn('pnpm', ['run', cmd], {
    cwd: showcasePath,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';

  child.stderr.on('data', (data: Buffer) => {
    const text = data.toString();
    stderr += text;
    log(text);
  });

  child.on('close', (code) => {
    if (code === 0) {
      const distPath = path.join(showcasePath, 'dist', 'desktop');
      emit({ type: 'build-success', name, distPath });
    } else {
      emit({ type: 'build-error', name, errors: [stderr] });
    }
  });

  if (options.watch) {
    await new Promise(() => {});
  } else {
    await new Promise<void>((resolve) => child.on('close', resolve));
  }
}

function findShowcasePath(name: string, manager: WorkspaceManager): string | null {
  const repoPath = manager.getShowcasePath(name);
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return repoPath;

  const extPath = manager.getExternalPath(name);
  if (fs.existsSync(path.join(extPath, 'package.json'))) return extPath;

  return null;
}
