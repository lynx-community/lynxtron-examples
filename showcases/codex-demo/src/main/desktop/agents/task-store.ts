import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { AgentTask } from '../../../shared/agent';

export class TaskStore {
  constructor(private readonly filePath: string) {}

  load(): AgentTask[] {
    try {
      const value = JSON.parse(readFileSync(this.filePath, 'utf8'));
      if (!Array.isArray(value)) return [];
      return value.filter((item): item is AgentTask => (
        item && typeof item.id === 'string' && typeof item.sessionId === 'string'
      ));
    } catch {
      return [];
    }
  }

  save(tasks: AgentTask[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
    renameSync(tempPath, this.filePath);
  }
}
