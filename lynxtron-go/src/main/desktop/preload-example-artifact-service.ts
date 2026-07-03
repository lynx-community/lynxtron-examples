import { fetchExampleArtifact, runExampleArtifact } from './example-artifact';
import type { DebugLogger } from './preload-log';

export function createExampleArtifactBridge(dbg: DebugLogger) {
  return {
    fetch: async (relativePath: string) => {
      dbg(`exampleArtifact.fetch: ${relativePath}`);
      return fetchExampleArtifact(relativePath);
    },
    run: (cachePath: string, templateFile: string, title?: string) => {
      dbg(`exampleArtifact.run: cachePath=${cachePath} templateFile=${templateFile} title=${title || ''}`);
      try {
        return runExampleArtifact(cachePath, templateFile, title);
      } catch (error: any) {
        dbg(`exampleArtifact.run error: ${error?.message || String(error)}`);
        throw error;
      }
    },
  };
}
