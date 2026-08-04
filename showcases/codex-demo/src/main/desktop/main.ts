import { app, dialog, LynxWindow, Menu } from '@lynx-js/lynxtron';
import { nudgeFramedWindowViewport } from '@lynxtron-examples/config/window';
import path from 'path';
import type { BridgeResult, StartTaskInput } from '../../shared/agent';
import { AgentRuntime } from './agents/runtime';
import { TaskStore } from './agents/task-store';
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

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 1280,
    height: 820,
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

  const store = new TaskStore(path.join(app.getPath('userData'), 'codex-demo', 'tasks.json'));
  const runtime = new AgentRuntime(store, (event) => {
    try {
      w.sendGlobalEvent('agent:event', event);
    } catch (error) {
      console.error('[Codex Demo] Failed to push agent event:', error);
    }
  });

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
          callback.sendReply(ok(runtime.listBackends()));
          break;
        case 'agent:listTasks':
          callback.sendReply(ok(runtime.listTasks()));
          break;
        case 'agent:eventsSince':
          callback.sendReply(ok(runtime.eventsSince(Number(params.cursor ?? 0))));
          break;
        case 'review:snapshot':
          callback.sendReply(ok(runtime.reviewSnapshot(String(params.taskId ?? ''))));
          break;
        case 'review:fileDiff':
          callback.sendReply(ok(runtime.fileDiff(
            String(params.taskId ?? ''),
            String(params.path ?? ''),
          )));
          break;
        case 'agent:startTask':
          callback.sendReply(ok(await runtime.startTask(params as StartTaskInput)));
          break;
        case 'agent:loadTask':
          callback.sendReply(ok(await runtime.loadTask(String(params.taskId ?? ''))));
          break;
        case 'agent:prompt':
          runtime.startPrompt(String(params.taskId ?? ''), String(params.text ?? ''));
          callback.sendReply(ok({ accepted: true }));
          break;
        case 'agent:cancel':
          runtime.cancel(String(params.taskId ?? ''));
          callback.sendReply(ok({ cancelled: true }));
          break;
        case 'agent:permission':
          runtime.respondPermission(String(params.requestId ?? ''), params.optionId ? String(params.optionId) : undefined);
          callback.sendReply(ok({ resolved: true }));
          break;
        case 'agent:setConfigOption':
          callback.sendReply(ok(await runtime.setConfigOption(
            String(params.taskId ?? ''),
            String(params.configId ?? ''),
            typeof params.value === 'boolean' ? params.value : String(params.value ?? ''),
          )));
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

  w.on('closed', () => runtime.dispose());
  w.loadFile(LYNX_BUNDLE_PATH);
  w.show();
  nudgeFramedWindowViewport(w as any, { width: 1280, height: 820 });
});
