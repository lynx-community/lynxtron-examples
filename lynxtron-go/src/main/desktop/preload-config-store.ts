import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { DebugLogger } from './preload-log';

// Namespace the config file per app checkout: a global ~/.lynxtron-ide.json
// is shared by EVERY build of this app on the machine (parallel worktrees,
// self-hosted children), and their 1.5s session writers overwrite each other.
// Same-worktree instances still share one file — the session writer lease
// (fiddle.session.writer) arbitrates those.
const workspaceTag = crypto.createHash('sha1').update(__dirname).digest('hex').slice(0, 8);
const CONFIG_PATH = path.join(os.homedir(), `.lynxtron-ide.${workspaceTag}.json`);
const INSTALL_STATE_PATH = path.join(os.homedir(), '.lynxtron-go-install-state.json');

export function readConfig(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (_) {
    return {};
  }
}

export function writeConfig(data: Record<string, any>, dbg?: DebugLogger): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    if (dbg) {
      dbg(`writeConfig error: ${error}`);
    } else {
      console.error('[Preload] writeConfig error:', error);
    }
  }
}

export function readInstallState(): Record<string, string> {
  try {
    const raw = fs.readFileSync(INSTALL_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function writeInstallState(data: Record<string, string>, dbg?: DebugLogger): void {
  try {
    fs.writeFileSync(INSTALL_STATE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    if (dbg) {
      dbg(`writeInstallState error: ${error}`);
    }
  }
}
