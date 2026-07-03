import { app, LynxWindow } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
import os from 'os';

interface SystemInfo {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  platform: string;
  arch: string;
  uptime: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

let refreshInterval = 1000;
let interval: NodeJS.Timeout | null = null;

function getSystemInfo(): SystemInfo {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
  // console.log('freeMemory', (freeMemory / (1024 * 1024 * 1024)).toFixed(2));
  // console.log('memoryUsage', memoryUsage);
  // console.log('totalMemory', (totalMemory / (1024 * 1024 * 1024)).toFixed(2));
  // console.log('freeMemory', (freeMemory / (1024 * 1024 * 1024)).toFixed(2));

  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  
  const cpuUsage = 100 - (totalIdle / totalTick) * 100;

  return {
    cpuUsage: parseFloat(cpuUsage.toFixed(2)),
    memoryUsage: parseFloat(memoryUsage.toFixed(2)),
    totalMemory: totalMemory / (1024 * 1024 * 1024),
    freeMemory: freeMemory / (1024 * 1024 * 1024),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
  };
}

app.whenReady().then(() => {
  const w = new LynxWindow({
    width: 500,
    height: 600,
    title: 'System Monitor',
  });

  w.on('-lynx-invoke', async (callback, name) => {
    if (name === 'getSystemInfo') {
      callback.sendReply(getSystemInfo());
    }
  });

  w.on('-lynx-message', (name, data) => {
    if (name === 'setRefreshInterval') {
      const intervalParam = asRecord(data).interval;
      refreshInterval = typeof intervalParam === 'number' ? intervalParam : refreshInterval;
      if (interval) {
        clearInterval(interval);
      }
      interval = setInterval(() => {
        w.sendGlobalEvent('systemInfoUpdate', getSystemInfo());
      }, refreshInterval);
    }
  });

  w.show();
  w.loadFile(LYNX_BUNDLE_PATH);

  interval = setInterval(() => {
    w.sendGlobalEvent('systemInfoUpdate', getSystemInfo());
  }, refreshInterval);
});
