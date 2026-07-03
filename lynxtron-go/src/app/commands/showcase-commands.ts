import { registerCommand } from './registry';
import {
  isRunnableWorkspaceSession,
  isShowcaseWorkspaceSession,
  type WorkspaceSession,
} from '../shared/workspace-session';

export function registerShowcaseCommands(deps: {
  openFolder: (path: string) => void;
  setPickerOpen: (open: boolean) => void;
  setPickerQuery: (q: string) => void;
  getWorkspaceSession: () => WorkspaceSession | null;
  hasCurrentShowcaseWebTarget: () => boolean;
  runCurrentWorkspace: () => void;
  runCurrentWorkspaceOnWeb: () => void;
  debugCurrentShowcase: () => void;
  debugCurrentShowcaseOnWeb: () => void;
  installCurrentShowcaseDependencies: () => void;
  openFolderDialog: () => void;
  startShowcaseList: () => void;
  startUrlFetch: () => void;
  startBundleUrlFetch: () => void;
  startBundleFileRun: () => void;
  startExampleFetch: () => void;
}) {
  registerCommand({
    id: 'showcase.open',
    label: 'Open Showcase',
    execute: () => {
      // Switch picker to showcase list mode
      deps.startShowcaseList();
    },
  });

  registerCommand({
    id: 'showcase.openUrl',
    label: 'Open Showcase (URL)',
    execute: () => {
      deps.startUrlFetch();
    },
  });

  registerCommand({
    id: 'bundle.runUrl',
    label: 'Run Bundle URL',
    execute: () => {
      deps.startBundleUrlFetch();
    },
  });

  registerCommand({
    id: 'bundle.runFile',
    label: 'Run Bundle File',
    execute: () => {
      deps.startBundleFileRun();
    },
  });

  registerCommand({
    id: 'example.open',
    label: 'Open Example Artifact',
    execute: () => {
      deps.startExampleFetch();
    },
  });

  registerCommand({
    id: 'showcase.run',
    label: 'Run',
    execute: () => {
      deps.setPickerOpen(false);
      deps.runCurrentWorkspace();
    },
    when: () => {
      try {
        return isRunnableWorkspaceSession(deps.getWorkspaceSession());
      } catch { return false; }
    },
  });

  registerCommand({
    id: 'showcase.debug',
    label: 'Debug',
    execute: () => {
      deps.setPickerOpen(false);
      deps.debugCurrentShowcase();
    },
    when: () => {
      try {
        return isShowcaseWorkspaceSession(deps.getWorkspaceSession());
      } catch {
        return false;
      }
    },
  });

  registerCommand({
    id: 'showcase.runWeb',
    label: 'Run on Web',
    execute: () => {
      deps.setPickerOpen(false);
      deps.runCurrentWorkspaceOnWeb();
    },
    when: () => {
      try {
        return isShowcaseWorkspaceSession(deps.getWorkspaceSession()) && deps.hasCurrentShowcaseWebTarget();
      } catch {
        return false;
      }
    },
  });

  registerCommand({
    id: 'showcase.debugWeb',
    label: 'Debug on Web',
    execute: () => {
      deps.setPickerOpen(false);
      deps.debugCurrentShowcaseOnWeb();
    },
    when: () => {
      try {
        return isShowcaseWorkspaceSession(deps.getWorkspaceSession()) && deps.hasCurrentShowcaseWebTarget();
      } catch {
        return false;
      }
    },
  });

  registerCommand({
    id: 'showcase.installDependencies',
    label: 'Install Dependencies',
    execute: () => {
      deps.setPickerOpen(false);
      deps.installCurrentShowcaseDependencies();
    },
    when: () => {
      try {
        return isShowcaseWorkspaceSession(deps.getWorkspaceSession());
      } catch {
        return false;
      }
    },
  });

  registerCommand({
    id: 'folder.open',
    label: 'Open Folder',
    keybinding: 'Cmd+Shift+O',
    execute: () => { deps.setPickerOpen(false); deps.openFolderDialog(); },
  });
}
