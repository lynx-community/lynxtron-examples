// Maps a fiddle id -> its main-process setup. `registerMain` is called on the
// fiddle's LynxWindow BEFORE loadFile, so `-lynx-invoke` / `-lynx-message`
// handlers are attached before the UI can call them.
//
// Each fiddle that needs main-process logic lives at
// `src/fiddles/<dir>/main.ts` and exports `registerMain(win, ctx)`. This map is
// generated from those files (see the port workflow).
import type { LynxWindow } from '@lynx-js/lynxtron';

export interface FiddleContext {
  /** The fiddle's own window. */
  win: LynxWindow;
  /** Open another top-level fiddle window by id (used by window fiddles). */
  openFiddle: (id: string) => void;
}

export type RegisterMain = (win: LynxWindow, ctx: FiddleContext) => void;

import { registerMain as appInformation } from '../../fiddles/app-information/main';
import { registerMain as clipboardCopy } from '../../fiddles/clipboard-copy/main';
import { registerMain as clipboardPaste } from '../../fiddles/clipboard-paste/main';
import { registerMain as contextMenuDom } from '../../fiddles/context-menu-dom/main';
import { registerMain as contextMenuWebContents } from '../../fiddles/context-menu-web-contents/main';
import { registerMain as dialogError } from '../../fiddles/dialog-error/main';
import { registerMain as dialogInformation } from '../../fiddles/dialog-information/main';
import { registerMain as dialogOpenFile } from '../../fiddles/dialog-open-file/main';
import { registerMain as dialogSave } from '../../fiddles/dialog-save/main';
import { registerMain as dndFiles } from '../../fiddles/dnd-files/main';
import { registerMain as dockMenu } from '../../fiddles/dock-menu/main';
import { registerMain as externalLinks } from '../../fiddles/external-links/main';
import { registerMain as fitScreen } from '../../fiddles/fit-screen/main';
import { registerMain as ipcPattern1 } from '../../fiddles/ipc-pattern-1/main';
import { registerMain as ipcPattern2 } from '../../fiddles/ipc-pattern-2/main';
import { registerMain as ipcPattern3 } from '../../fiddles/ipc-pattern-3/main';
import { registerMain as menuShortcuts } from '../../fiddles/menu-shortcuts/main';
import { registerMain as notificationBasic } from '../../fiddles/notification-basic/main';
import { registerMain as notificationMain } from '../../fiddles/notification-main/main';
import { registerMain as notificationRenderer } from '../../fiddles/notification-renderer/main';
import { registerMain as onlineDetection } from '../../fiddles/online-detection/main';
import { registerMain as progressBar } from '../../fiddles/progress-bar/main';
import { registerMain as protocolHandler } from '../../fiddles/protocol-handler/main';
import { registerMain as recentDocuments } from '../../fiddles/recent-documents/main';
import { registerMain as representedFile } from '../../fiddles/represented-file/main';
import { registerMain as trayMenu } from '../../fiddles/tray-menu/main';
import { registerMain as wcFrameless } from '../../fiddles/wc-frameless/main';
import { registerMain as wcNativeWindowControls } from '../../fiddles/wc-native-window-controls/main';
import { registerMain as wcRemoveTitleBar } from '../../fiddles/wc-remove-title-bar/main';
import { registerMain as wcStarterCode } from '../../fiddles/wc-starter-code/main';
import { registerMain as windowEvents } from '../../fiddles/window-events/main';
import { registerMain as windowFrameless } from '../../fiddles/window-frameless/main';
import { registerMain as windowNew } from '../../fiddles/window-new/main';
import { registerMain as windowState } from '../../fiddles/window-state/main';

// Keyed by manifest id (== fiddle dir).
export const fiddleMains: Record<string, RegisterMain> = {
  'app-information': appInformation,
  'clipboard-copy': clipboardCopy,
  'clipboard-paste': clipboardPaste,
  'context-menu-dom': contextMenuDom,
  'context-menu-web-contents': contextMenuWebContents,
  'dialog-error': dialogError,
  'dialog-information': dialogInformation,
  'dialog-open-file': dialogOpenFile,
  'dialog-save': dialogSave,
  'dnd-files': dndFiles,
  'dock-menu': dockMenu,
  'external-links': externalLinks,
  'fit-screen': fitScreen,
  'ipc-pattern-1': ipcPattern1,
  'ipc-pattern-2': ipcPattern2,
  'ipc-pattern-3': ipcPattern3,
  'menu-shortcuts': menuShortcuts,
  'notification-basic': notificationBasic,
  'notification-main': notificationMain,
  'notification-renderer': notificationRenderer,
  'online-detection': onlineDetection,
  'progress-bar': progressBar,
  'protocol-handler': protocolHandler,
  'recent-documents': recentDocuments,
  'represented-file': representedFile,
  'tray-menu': trayMenu,
  'wc-frameless': wcFrameless,
  'wc-native-window-controls': wcNativeWindowControls,
  'wc-remove-title-bar': wcRemoveTitleBar,
  'wc-starter-code': wcStarterCode,
  'window-events': windowEvents,
  'window-frameless': windowFrameless,
  'window-new': windowNew,
  'window-state': windowState,
};
