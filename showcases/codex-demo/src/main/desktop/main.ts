import { app, devtool, dialog, LynxWindow, Menu, shell } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import { cpSync, mkdirSync } from 'fs';
import path from 'path';
import type { BridgeResult } from '../../shared/agent';
import { installComputerUseRuntime } from './computer-use-runtime';
import { installOpenCodeRuntime } from './opencode-runtime';
import { ServiceClient } from './transport/service-client';
import { LYNX_BUNDLE_PATH } from './vendorPaths';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function ok<T>(value: T): BridgeResult<T> {
  return { ok: true, value };
}

function fail(error: unknown): BridgeResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function prepareOpenCodeConfig(): { configDir: string; computerUseBin: string; openCodeBin: string; openCodeVersion: string } {
  const bootstrapStartedAt = performance.now();
  const source = path.join(__dirname, 'opencode');
  const target = path.join(app.getPath('userData'), 'codex-demo', 'opencode');
  mkdirSync(target, { recursive: true });
  cpSync(path.join(source, 'opencode.json'), path.join(target, 'opencode.json'), { force: true });
  cpSync(path.join(source, 'skills'), path.join(target, 'skills'), { recursive: true, force: true });

  const computerUseStartedAt = performance.now();
  const computerUseBin = installComputerUseRuntime(
    path.join(source, 'runtime'),
    path.join(app.getPath('userData'), 'codex-demo', 'runtime'),
  );
  console.info('[Codex Demo][bootstrap] computer-use', Math.round(performance.now() - computerUseStartedAt), 'ms');
  const openCodeStartedAt = performance.now();
  const openCode = installOpenCodeRuntime(
    path.join(source, 'agent-runtime'),
    path.join(app.getPath('userData'), 'codex-demo', 'opencode-runtime'),
  );
  console.info('[Codex Demo][bootstrap] opencode', Math.round(performance.now() - openCodeStartedAt), 'ms');
  console.info('[Codex Demo][bootstrap] total', Math.round(performance.now() - bootstrapStartedAt), 'ms');
  return { configDir: target, computerUseBin, openCodeBin: openCode.bin, openCodeVersion: openCode.version };
}

app.whenReady().then(async () => {
  if (process.env.CODEX_DEMO_DEVTOOLS === '1') devtool.setDevToolEnabled(true);
  const w = new LynxWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 620,
    title: 'Codex Demo',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    lynxPreference: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  w.on('blur', () => {
    try { w.sendGlobalEvent('window:blur', { at: Date.now() }); } catch {}
  });

  const prepared = prepareOpenCodeConfig();
  process.env.OPENCODE_BIN = prepared.openCodeBin;
  const service = new ServiceClient({
    env: Object.fromEntries(Object.entries({
      ...process.env,
      CODEX_DEMO_TASKS_FILE: path.join(app.getPath('userData'), 'codex-demo', 'tasks.json'),
      OPENCODE_CONFIG_DIR: prepared.configDir,
      CODEX_DEMO_COMPUTER_USE_BIN: prepared.computerUseBin,
      OPENCODE_BIN: prepared.openCodeBin,
      CODEX_DEMO_OPENCODE_VERSION: prepared.openCodeVersion,
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    onAgentEvent: (event) => {
      try {
        w.sendGlobalEvent('agent:event', event);
      } catch (error) {
        console.error('[Codex Demo] Failed to push agent event:', error);
      }
    },
    onStateChange: (state, detail) => {
      console.info('[Codex Demo][service]', state, detail ?? '');
      try { w.sendGlobalEvent('service:state', { state, detail }); } catch {}
    },
  });
  await service.start();

  const menuTemplate: any[] = [];
  if (process.platform === 'darwin') menuTemplate.push({ role: 'appMenu' });
  menuTemplate.push({
    label: 'Edit',
    submenu: [
      { role: 'copy' },
      { role: 'selectAll' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'paste' },
    ],
  });
  if (process.platform === 'darwin') menuTemplate.push({ role: 'windowMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  w.on('-lynx-invoke', async (callback, name, data) => {
    const params = asRecord(data);
    try {
      switch (name) {
        case 'agent:listBackends':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:listTasks':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:eventsSince':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:timelinePage':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'debug:historyLoad':
          console.info('[Codex Demo][history-load]', JSON.stringify(params));
          callback.sendReply(ok(true));
          break;
        case 'debug:chatList':
          console.info('[Codex Demo][chat-list-debug]', JSON.stringify(params));
          callback.sendReply(ok(true));
          break;
        case 'debug:diffPerformance':
          console.info('[Codex Demo][diff-perf]', JSON.stringify(params));
          callback.sendReply(ok(true));
          break;
        case 'review:snapshot':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'review:fileDiff':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'workspace:snapshot':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'workspace:file':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'workspace:open': {
          const filePath = await service.request<string>('workspace:filePath', params);
          const error = await shell.openPath(filePath);
          if (error) throw new Error(error);
          callback.sendReply(ok({ opened: true }));
          break;
        }
        case 'workspace:reveal': {
          const filePath = await service.request<string>('workspace:filePath', params);
          shell.showItemInFolder(filePath);
          callback.sendReply(ok({ revealed: true }));
          break;
        }
        case 'shell:openExternal': {
          const href = String(params.href ?? '');
          const url = new URL(href);
          if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported link protocol.');
          await shell.openExternal(url.toString());
          callback.sendReply(ok({ opened: true }));
          break;
        }
        case 'agent:startTask':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:loadTask':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:prompt':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:cancel':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:permission':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:setConfigOption':
          callback.sendReply(ok(await service.request(name, params)));
          break;
        case 'agent:chooseWorkspace': {
          const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
          callback.sendReply(ok({ path: result.canceled ? '' : result.filePaths[0] ?? '' }));
          break;
        }
        case 'agent:defaultWorkspace':
          callback.sendReply(ok({ path: process.env.CODEX_DEMO_WORKSPACE ?? process.cwd() }));
          break;
        default:
          callback.sendReply(fail(`Unknown bridge method: ${name}`));
      }
    } catch (error) {
      console.error(`[Codex Demo] ${name} failed:`, error);
      callback.sendReply(fail(error));
    }
  });

  w.on('closed', () => { void service.dispose(); });
  w.loadFile(LYNX_BUNDLE_PATH);
  w.show();
  nudgeFramedWindowViewport(w as any, { width: 1280, height: 720 });
});
