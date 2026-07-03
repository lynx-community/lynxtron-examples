import { describe, expect, it } from 'vitest';
import {
  createExampleArtifactWorkspaceSession,
  createFolderWorkspaceSession,
  createRouteFromWorkspaceSession,
  createShowcaseWorkspaceSession,
  resolveWorkspaceRunTarget,
  setWorkspaceSessionActiveFile,
} from './workspace-session';

describe('workspace session helpers', () => {
  it('maps each workspace session kind to a workspace route with explicit source', () => {
    expect(createRouteFromWorkspaceSession(createFolderWorkspaceSession('/tmp/folder'))).toEqual({
      kind: 'workspace',
      source: 'folder',
      rootPath: '/tmp/folder',
      activeFile: undefined,
    });

    expect(
      createRouteFromWorkspaceSession(
        createShowcaseWorkspaceSession('/tmp/showcase', '/tmp/showcase/src/app.tsx'),
      ),
    ).toEqual({
      kind: 'workspace',
      source: 'showcase',
      rootPath: '/tmp/showcase',
      activeFile: '/tmp/showcase/src/app.tsx',
    });

    expect(
      createRouteFromWorkspaceSession(
        createExampleArtifactWorkspaceSession({
          cachePath: '/tmp/example-cache',
          activeFile: '/tmp/example-cache/package.json',
          templateFile: 'dist/main.lynx.bundle',
          title: 'examples/view — main',
        }),
      ),
    ).toEqual({
      kind: 'workspace',
      source: 'example-artifact',
      rootPath: '/tmp/example-cache',
      activeFile: '/tmp/example-cache/package.json',
    });
  });

  it('maps each workspace session kind to the correct run target', () => {
    expect(resolveWorkspaceRunTarget(createFolderWorkspaceSession('/tmp/folder'))).toEqual({
      kind: 'none',
      reason: 'Run is not available for folder workspaces',
    });

    expect(resolveWorkspaceRunTarget(createShowcaseWorkspaceSession('/tmp/showcase'))).toEqual({
      kind: 'showcase',
      rootPath: '/tmp/showcase',
    });

    expect(
      resolveWorkspaceRunTarget(
        createExampleArtifactWorkspaceSession({
          cachePath: '/tmp/example-cache',
          templateFile: 'dist/main.lynx.bundle',
          title: 'examples/view — main',
        }),
      ),
    ).toEqual({
      kind: 'example-artifact',
      cachePath: '/tmp/example-cache',
      templateFile: 'dist/main.lynx.bundle',
      title: 'examples/view — main',
    });
  });

  it('does not infer example-artifact run without a template', () => {
    expect(
      resolveWorkspaceRunTarget(
        createExampleArtifactWorkspaceSession({
          cachePath: '/tmp/example-cache',
          title: 'examples/view — preview',
        }),
      ),
    ).toEqual({
      kind: 'none',
      reason: 'Example artifact does not have a run template',
    });
  });

  it('updates active file without changing workspace identity', () => {
    const session = createShowcaseWorkspaceSession('/tmp/showcase');
    const updated = setWorkspaceSessionActiveFile(session, '/tmp/showcase/src/app.tsx');

    expect(updated).toEqual({
      kind: 'showcase',
      rootPath: '/tmp/showcase',
      activeFile: '/tmp/showcase/src/app.tsx',
    });

    expect(createRouteFromWorkspaceSession(updated)).toEqual({
      kind: 'workspace',
      source: 'showcase',
      rootPath: '/tmp/showcase',
      activeFile: '/tmp/showcase/src/app.tsx',
    });

    expect(setWorkspaceSessionActiveFile(updated, undefined)).toEqual({
      kind: 'showcase',
      rootPath: '/tmp/showcase',
      activeFile: undefined,
    });
  });
});
