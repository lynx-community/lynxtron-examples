import { contextBridge } from '@lynx-js/lynxtron/context-bridge';
import os from 'os';
import { getMemoryUsageSnapshot } from './memory-metrics';

contextBridge.exposeInLynxBTS({
  benchmark: {
    getMemoryUsage() {
      return getMemoryUsageSnapshot();
    },

    getPlatformInfo() {
      return {
        platform: os.platform(),
        arch: os.arch(),
        version: '0.0.3',
      };
    },
  },
});
