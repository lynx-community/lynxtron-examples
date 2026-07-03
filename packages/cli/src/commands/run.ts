import { WorkspaceManager } from '../workspace/manager.js';
import { emit, log } from '../utils/ndjson.js';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function run(name: string, workspaceRoot: string): Promise<void> {
  const manager = new WorkspaceManager(workspaceRoot);
  const showcasePath = findShowcasePath(name, manager);

  if (!showcasePath) {
    log(`Showcase "${name}" not found`);
    process.exit(1);
  }

  const distDesktop = path.join(showcasePath, 'dist', 'desktop');
  if (!fs.existsSync(path.join(distDesktop, 'main.js'))) {
    log(`No built output found for "${name}". Run "build" first.`);
    process.exit(1);
  }

  log(`Launching ${name}...`);
  const child = spawn('lynxtron', [distDesktop], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  emit({ type: 'run-start', name, pid: child.pid ?? 0 });

  child.stdout.on('data', (data: Buffer) => log(data.toString()));
  child.stderr.on('data', (data: Buffer) => log(data.toString()));

  child.on('close', (code) => {
    emit({ type: 'run-exit', name, code: code ?? 1 });
  });

  await new Promise<void>((resolve) => child.on('close', resolve));
}

function findShowcasePath(name: string, manager: WorkspaceManager): string | null {
  const repoPath = manager.getShowcasePath(name);
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return repoPath;
  const extPath = manager.getExternalPath(name);
  if (fs.existsSync(path.join(extPath, 'package.json'))) return extPath;
  return null;
}
