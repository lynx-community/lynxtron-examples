import { describe, expect, it } from 'vitest';
import {
  canNavigateRouteBack,
  canNavigateRouteForward,
  createHomeRoute,
  createRouteNavigationState,
  createWorkspaceRoute,
  createWorkspaceRouteSnapshot,
  enterHomeRoute,
  enterWorkspaceRoute,
  navigateRouteBack,
  navigateRouteForward,
} from './navigation';

interface TestWorkspaceSession {
  kind: 'folder' | 'showcase';
  rootPath: string;
  activeFile?: string;
}

function createWorkspaceSnapshot(rootPath: string, activeFile?: string) {
  const session: TestWorkspaceSession = {
    kind: 'showcase',
    rootPath,
    activeFile,
  };
  const snapshot = createWorkspaceRouteSnapshot(
    createWorkspaceRoute(session.kind, session.rootPath, session.activeFile),
    session,
  );
  if (!snapshot) throw new Error('Expected workspace snapshot');
  return snapshot;
}

describe('route navigation helpers', () => {
  it('starts on home with disabled route navigation', () => {
    const state = createRouteNavigationState<TestWorkspaceSession>();

    expect(state.currentRoute).toEqual(createHomeRoute());
    expect(canNavigateRouteBack(state)).toBe(false);
    expect(canNavigateRouteForward(state)).toBe(false);
    expect(navigateRouteBack(state, null)).toBe(state);
    expect(navigateRouteForward(state)).toEqual({
      state,
      restoredWorkspace: null,
    });
  });

  it('enters a workspace as a new branch and clears any forward target', () => {
    const firstWorkspace = createWorkspaceSnapshot('/tmp/first', '/tmp/first/src/App.tsx');
    const secondWorkspace = createWorkspaceSnapshot('/tmp/second', '/tmp/second/src/App.tsx');

    const workspaceState = enterWorkspaceRoute(
      createRouteNavigationState<TestWorkspaceSession>(),
      firstWorkspace,
    );
    const homeWithForward = navigateRouteBack(workspaceState, firstWorkspace);
    const nextWorkspaceState = enterWorkspaceRoute(homeWithForward, secondWorkspace);

    expect(nextWorkspaceState.currentRoute).toEqual(secondWorkspace.route);
    expect(nextWorkspaceState.forwardWorkspace).toBeNull();
    expect(canNavigateRouteBack(nextWorkspaceState)).toBe(true);
    expect(canNavigateRouteForward(nextWorkspaceState)).toBe(false);
  });

  it('backs from workspace to home while preserving a forward workspace snapshot', () => {
    const workspace = createWorkspaceSnapshot('/tmp/showcase', '/tmp/showcase/src/App.tsx');
    const workspaceState = enterWorkspaceRoute(
      createRouteNavigationState<TestWorkspaceSession>(),
      workspace,
    );

    const homeState = navigateRouteBack(workspaceState, workspace);

    expect(homeState.currentRoute).toEqual(createHomeRoute());
    expect(homeState.forwardWorkspace).toEqual(workspace);
    expect(canNavigateRouteBack(homeState)).toBe(false);
    expect(canNavigateRouteForward(homeState)).toBe(true);
  });

  it('forwards from home to the preserved workspace and consumes the forward target', () => {
    const workspace = createWorkspaceSnapshot('/tmp/showcase', '/tmp/showcase/package.json');
    const workspaceState = enterWorkspaceRoute(
      createRouteNavigationState<TestWorkspaceSession>(),
      workspace,
    );
    const homeState = navigateRouteBack(workspaceState, workspace);

    const result = navigateRouteForward(homeState);

    expect(result.restoredWorkspace).toEqual(workspace);
    expect(result.state.currentRoute).toEqual(workspace.route);
    expect(result.state.forwardWorkspace).toBeNull();
    expect(canNavigateRouteBack(result.state)).toBe(true);
    expect(canNavigateRouteForward(result.state)).toBe(false);
  });

  it('direct home navigation clears any forward target', () => {
    const workspace = createWorkspaceSnapshot('/tmp/showcase');
    const workspaceState = enterWorkspaceRoute(
      createRouteNavigationState<TestWorkspaceSession>(),
      workspace,
    );
    const homeWithForward = navigateRouteBack(workspaceState, workspace);

    const directHome = enterHomeRoute(homeWithForward);

    expect(directHome.currentRoute).toEqual(createHomeRoute());
    expect(directHome.forwardWorkspace).toBeNull();
    expect(canNavigateRouteForward(directHome)).toBe(false);
  });
});
