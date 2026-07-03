import fs from 'fs';
import os from 'os';
import path from 'path';

export type DebugLogger = (message: string) => void;

export const DEBUG_LOG = path.join(os.tmpdir(), 'lynxtron_debug.log');

console.log('[DEBUG] DEBUG_LOG path:', DEBUG_LOG);

export function writeDebugLog(scope: string, message: string) {
  const logMessage = `[${new Date().toISOString()}] [${scope}] ${message}\n`;
  
  // 同时输出到 console
  console.log(logMessage.trim());
  
  try {
    console.log('[DEBUG] Attempting to write to log file');
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(DEBUG_LOG, logMessage);
    console.log('[DEBUG] Successfully wrote to log file');
  } catch (error) {
    console.error('[DEBUG] Failed to write log file:', error);
  }
}

export function createDebugLogger(scope: string): DebugLogger {
  return (message: string) => {
    writeDebugLog(scope, message);
  };
}
