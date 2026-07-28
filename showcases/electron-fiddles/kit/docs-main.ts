import { shell } from '@lynx-js/lynxtron';
import type { LynxWindow } from '@lynx-js/lynxtron';
import { DOCS_BASE } from './docs';

/**
 * Let the UI open an API's documentation page in the user's browser.
 *
 * Lynx has no `window.open`, so the tap has to reach the main process; this
 * registers the one handler that does it. Every fiddle calls this, which is why
 * it lives in the kit rather than being pasted into 44 main processes.
 *
 * Safe by construction: only URLs under the published docs base are opened, so
 * a compromised or buggy UI cannot turn this into a general "launch anything"
 * primitive.
 */
export function attachDocsLinks(win: LynxWindow): void {
  win.on('-lynx-message', (name, data) => {
    if (name !== 'open-docs') return;
    const url = String((data as Record<string, unknown>)?.url ?? '');
    if (!url.startsWith(`${DOCS_BASE}/`)) {
      console.error(`[docs] refusing to open a URL outside the API docs: ${url}`);
      return;
    }
    // Opening a browser is an outward-facing action; say so in the log, so a
    // tap that appears to do nothing can be told apart from one that never
    // reached main.
    console.log(`[docs] opening ${url}`);
    shell.openExternal(url);
  });
}
