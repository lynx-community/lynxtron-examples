import type { AppRoute } from './navigation';
import { createWorkspaceRoute } from './navigation';
import type { ExampleArtifactRunContext } from './example-artifact';

export type WorkspaceSession =
  | {
      kind: 'folder';
      rootPath: string;
      activeFile?: string;
    }
  | {
      kind: 'showcase';
      rootPath: string;
      activeFile?: string;
    }
  | ({
      kind: 'example-artifact';
      rootPath: string;
      activeFile?: string;
    } & ExampleArtifactRunContext);

export type ResumableWorkspaceSession = Extract<WorkspaceSession, { kind: 'folder' | 'showcase' }>;
export type ShowcaseWorkspaceSession = Extract<WorkspaceSession, { kind: 'showcase' }>;

export type WorkspaceRunTarget =
  | { kind: 'none'; reason: string }
  | { kind: 'showcase'; rootPath: string }
  | { kind: 'example-artifact'; cachePath: string; templateFile: string; title: string };

export interface ExampleArtifactWorkspaceSessionInput {
  cachePath: string;
  activeFile?: string;
  templateFile?: string;
  title?: string;
}

export function createFolderWorkspaceSession(rootPath: string, activeFile?: string): ResumableWorkspaceSession {
  return { kind: 'folder', rootPath, activeFile };
}

export function createShowcaseWorkspaceSession(rootPath: string, activeFile?: string): ResumableWorkspaceSession {
  return { kind: 'showcase', rootPath, activeFile };
}

export function createExampleArtifactWorkspaceSession(
  input: ExampleArtifactWorkspaceSessionInput,
): WorkspaceSession {
  return {
    kind: 'example-artifact',
    rootPath: input.cachePath,
    activeFile: input.activeFile,
    cachePath: input.cachePath,
    templateFile: input.templateFile ?? '',
    title: input.title?.trim() || 'Example Artifact Preview',
  };
}

export function createRouteFromWorkspaceSession(session: WorkspaceSession): AppRoute {
  return createWorkspaceRoute(session.kind, session.rootPath, session.activeFile);
}

export function setWorkspaceSessionActiveFile(
  session: WorkspaceSession,
  activeFile?: string,
): WorkspaceSession {
  if (session.activeFile === activeFile) {
    return session;
  }
  return {
    ...session,
    activeFile,
  };
}

export function isRunnableWorkspaceSession(
  session: WorkspaceSession | null | undefined,
): session is Exclude<WorkspaceSession, { kind: 'folder' }> {
  return !!session && session.kind !== 'folder';
}

export function isShowcaseWorkspaceSession(
  session: WorkspaceSession | null | undefined,
): session is ShowcaseWorkspaceSession {
  return !!session && session.kind === 'showcase';
}

export function resolveWorkspaceRunTarget(session: WorkspaceSession | null): WorkspaceRunTarget {
  if (!session) {
    return { kind: 'none', reason: 'No active workspace' };
  }

  if (session.kind === 'folder') {
    return { kind: 'none', reason: 'Run is not available for folder workspaces' };
  }

  if (session.kind === 'showcase') {
    return { kind: 'showcase', rootPath: session.rootPath };
  }

  const templateFile = session.templateFile.trim();
  if (!templateFile) {
    return { kind: 'none', reason: 'Example artifact does not have a run template' };
  }

  return {
    kind: 'example-artifact',
    cachePath: session.cachePath,
    templateFile,
    title: session.title.trim() || 'Example Artifact Preview',
  };
}
