import { createPreloadBridge } from './preload-bridge';

const { contextBridge } = require('lynxtron');

contextBridge.exposeInLynxBTS(createPreloadBridge());

console.log('[PC Preload] Node.js capabilities exported');
