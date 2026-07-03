export type WorkspaceRouteSource = 'folder' | 'showcase' | 'example-artifact';

export type AppRoute =
  | { kind: 'home' }
  | {
      kind: 'workspace';
      source: WorkspaceRouteSource;
      rootPath: string;
      activeFile?: string;
    };

export type WorkspaceRoute = Extract<AppRoute, { kind: 'workspace' }>;

export interface WorkspaceRouteSnapshot<TWorkspaceSession> {
  route: WorkspaceRoute;
  workspaceSession: TWorkspaceSession;
}

export interface RouteNavigationState<TWorkspaceSession> {
  currentRoute: AppRoute;
  forwardWorkspace: WorkspaceRouteSnapshot<TWorkspaceSession> | null;
}

export function createHomeRoute(): AppRoute {
  return { kind: 'home' };
}

export function createWorkspaceRoute(
  source: WorkspaceRouteSource,
  rootPath: string,
  activeFile?: string,
): AppRoute {
  return { kind: 'workspace', source, rootPath, activeFile };
}

export function createRouteNavigationState<TWorkspaceSession>(
  currentRoute: AppRoute = createHomeRoute(),
): RouteNavigationState<TWorkspaceSession> {
  return {
    currentRoute,
    forwardWorkspace: null,
  };
}

export function createWorkspaceRouteSnapshot<TWorkspaceSession>(
  route: AppRoute,
  workspaceSession: TWorkspaceSession,
): WorkspaceRouteSnapshot<TWorkspaceSession> | null {
  if (route.kind !== 'workspace') return null;
  return {
    route,
    workspaceSession,
  };
}

export function canNavigateRouteBack<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
): boolean {
  return state.currentRoute.kind === 'workspace';
}

export function canNavigateRouteForward<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
): boolean {
  return state.currentRoute.kind === 'home' && state.forwardWorkspace !== null;
}

export function enterHomeRoute<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
): RouteNavigationState<TWorkspaceSession> {
  if (state.currentRoute.kind === 'home' && state.forwardWorkspace === null) {
    return state;
  }
  return {
    currentRoute: createHomeRoute(),
    forwardWorkspace: null,
  };
}

export function enterWorkspaceRoute<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
  snapshot: WorkspaceRouteSnapshot<TWorkspaceSession>,
): RouteNavigationState<TWorkspaceSession> {
  if (state.currentRoute === snapshot.route && state.forwardWorkspace === null) {
    return state;
  }
  return {
    currentRoute: snapshot.route,
    forwardWorkspace: null,
  };
}

export function navigateRouteBack<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
  currentWorkspace: WorkspaceRouteSnapshot<TWorkspaceSession> | null,
): RouteNavigationState<TWorkspaceSession> {
  if (!canNavigateRouteBack(state) || !currentWorkspace) return state;
  return {
    currentRoute: createHomeRoute(),
    forwardWorkspace: currentWorkspace,
  };
}

export interface RouteForwardResult<TWorkspaceSession> {
  state: RouteNavigationState<TWorkspaceSession>;
  restoredWorkspace: WorkspaceRouteSnapshot<TWorkspaceSession> | null;
}

export function navigateRouteForward<TWorkspaceSession>(
  state: RouteNavigationState<TWorkspaceSession>,
): RouteForwardResult<TWorkspaceSession> {
  if (!canNavigateRouteForward(state) || !state.forwardWorkspace) {
    return {
      state,
      restoredWorkspace: null,
    };
  }

  return {
    state: {
      currentRoute: state.forwardWorkspace.route,
      forwardWorkspace: null,
    },
    restoredWorkspace: state.forwardWorkspace,
  };
}
