import { WorkspaceManager } from '../workspace/manager.js';
import { emit } from '../utils/ndjson.js';
import * as fs from 'fs';
import * as path from 'path';

export async function list(workspaceRoot: string): Promise<void> {
  const manager = new WorkspaceManager(workspaceRoot);
  const locals = manager.listLocal();

  const showcases = locals.map(({ name, type, path: dir }) => {
    let description = '';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      description = pkg.showcase?.description ?? pkg.description ?? '';
    } catch {
      // ignore
    }
    return { name, description, local: true };
  });

  emit({ type: 'list', showcases });
}
