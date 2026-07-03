// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { executeCommand, filterCommands } from './registry';
import { registerShowcaseCommands } from './showcase-commands';

describe('showcase commands', () => {
  it('registers run and debug commands only for showcase mode', () => {
    const showcaseMode = { kind: 'showcase' as const, rootPath: '/tmp/showcase' };
    const folderMode = { kind: 'folder' as const, rootPath: '/tmp/folder' };
    const setPickerOpen = vi.fn();
    const runCurrentWorkspace = vi.fn();
    const runCurrentWorkspaceOnWeb = vi.fn();
    const debugCurrentShowcase = vi.fn();
    const debugCurrentShowcaseOnWeb = vi.fn();
    const installCurrentShowcaseDependencies = vi.fn();

    registerShowcaseCommands({
      openFolder: vi.fn(),
      setPickerOpen,
      setPickerQuery: vi.fn(),
      getWorkspaceSession: vi.fn(() => showcaseMode),
      hasCurrentShowcaseWebTarget: vi.fn(() => true),
      runCurrentWorkspace,
      runCurrentWorkspaceOnWeb,
      debugCurrentShowcase,
      debugCurrentShowcaseOnWeb,
      installCurrentShowcaseDependencies,
      openFolderDialog: vi.fn(),
      startShowcaseList: vi.fn(),
      startUrlFetch: vi.fn(),
      startBundleUrlFetch: vi.fn(),
      startBundleFileRun: vi.fn(),
      startExampleFetch: vi.fn(),
    });

    const runCommand = filterCommands('Run').find(cmd => cmd.id === 'showcase.run');
    const runWebCommand = filterCommands('Run on Web').find(cmd => cmd.id === 'showcase.runWeb');
    const debugCommand = filterCommands('Debug').find(cmd => cmd.id === 'showcase.debug');
    const debugWebCommand = filterCommands('Debug on Web').find(cmd => cmd.id === 'showcase.debugWeb');
    const installCommand = filterCommands('Install Dependencies').find(cmd => cmd.id === 'showcase.installDependencies');
    expect(runCommand).toBeTruthy();
    expect(runWebCommand).toBeTruthy();
    expect(debugCommand).toBeTruthy();
    expect(debugWebCommand).toBeTruthy();
    expect(installCommand).toBeTruthy();

    executeCommand('showcase.run');
    executeCommand('showcase.runWeb');
    executeCommand('showcase.debug');
    executeCommand('showcase.debugWeb');
    executeCommand('showcase.installDependencies');
    expect(setPickerOpen).toHaveBeenCalledTimes(5);
    expect(setPickerOpen).toHaveBeenNthCalledWith(1, false);
    expect(setPickerOpen).toHaveBeenNthCalledWith(2, false);
    expect(setPickerOpen).toHaveBeenNthCalledWith(3, false);
    expect(setPickerOpen).toHaveBeenNthCalledWith(4, false);
    expect(setPickerOpen).toHaveBeenNthCalledWith(5, false);
    expect(runCurrentWorkspace).toHaveBeenCalledTimes(1);
    expect(runCurrentWorkspaceOnWeb).toHaveBeenCalledTimes(1);
    expect(debugCurrentShowcase).toHaveBeenCalledTimes(1);
    expect(debugCurrentShowcaseOnWeb).toHaveBeenCalledTimes(1);
    expect(installCurrentShowcaseDependencies).toHaveBeenCalledTimes(1);

    registerShowcaseCommands({
      openFolder: vi.fn(),
      setPickerOpen: vi.fn(),
      setPickerQuery: vi.fn(),
      getWorkspaceSession: vi.fn(() => folderMode),
      hasCurrentShowcaseWebTarget: vi.fn(() => false),
      runCurrentWorkspace: vi.fn(),
      runCurrentWorkspaceOnWeb: vi.fn(),
      debugCurrentShowcase: vi.fn(),
      debugCurrentShowcaseOnWeb: vi.fn(),
      installCurrentShowcaseDependencies: vi.fn(),
      openFolderDialog: vi.fn(),
      startShowcaseList: vi.fn(),
      startUrlFetch: vi.fn(),
      startBundleUrlFetch: vi.fn(),
      startBundleFileRun: vi.fn(),
      startExampleFetch: vi.fn(),
    });

    expect(filterCommands('Debug').some(cmd => cmd.id === 'showcase.debug')).toBe(false);
    expect(filterCommands('Run on Web').some(cmd => cmd.id === 'showcase.runWeb')).toBe(false);
    expect(filterCommands('Debug on Web').some(cmd => cmd.id === 'showcase.debugWeb')).toBe(false);
    expect(filterCommands('Install Dependencies').some(cmd => cmd.id === 'showcase.installDependencies')).toBe(false);
  });

  it('registers the debug-only bundle file runner command', () => {
    const startBundleFileRun = vi.fn();

    registerShowcaseCommands({
      openFolder: vi.fn(),
      setPickerOpen: vi.fn(),
      setPickerQuery: vi.fn(),
      getWorkspaceSession: vi.fn(() => null),
      hasCurrentShowcaseWebTarget: vi.fn(() => false),
      runCurrentWorkspace: vi.fn(),
      runCurrentWorkspaceOnWeb: vi.fn(),
      debugCurrentShowcase: vi.fn(),
      debugCurrentShowcaseOnWeb: vi.fn(),
      installCurrentShowcaseDependencies: vi.fn(),
      openFolderDialog: vi.fn(),
      startShowcaseList: vi.fn(),
      startUrlFetch: vi.fn(),
      startBundleUrlFetch: vi.fn(),
      startBundleFileRun,
      startExampleFetch: vi.fn(),
    });

    const command = filterCommands('Run Bundle File').find(cmd => cmd.id === 'bundle.runFile');
    expect(command).toBeTruthy();

    executeCommand('bundle.runFile');
    expect(startBundleFileRun).toHaveBeenCalledTimes(1);
  });
});
