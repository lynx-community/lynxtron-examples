// Resolve a Lynxtron API reference to its page in the published API docs.
//
// The docs are typedoc output, so the page kind is part of the path and every
// member has a lowercased anchor. Verified against the live site:
//
//   app.getPath          -> Interface.App.html#getpath
//   dialog.showOpenDialog-> Interface.Dialog.html#showopendialog
//   LynxWindow           -> Class.LynxWindow.html
//   win.setTitle         -> Class.LynxWindow.html#settitle
//   Menu.setApplicationMenu -> Class.Menu.html#setapplicationmenu
//
// Note the shape: the runtime exports `app` / `dialog` / … as VARIABLES, but
// their members are documented on the INTERFACE that types them. Linking a
// member to `Variable.app.html` lands on a page with no members on it, so
// members resolve to the interface page instead.

export const DOCS_BASE = 'https://lynxjs.org/next/lynxtron/api/@lynx-js/lynxtron';

/** Exported variables, and the interface that carries their members. */
const VARIABLE_INTERFACES: Record<string, string> = {
  app: 'App',
  clipboard: 'Clipboard',
  contextBridge: 'ContextBridge',
  devtool: 'Devtool',
  dialog: 'Dialog',
  protocol: 'Protocol',
  screen: 'Screen',
  shell: 'Shell',
};

/** Exported classes. */
const CLASSES = new Set([
  'Archive',
  'BaseWindow',
  'CommandLine',
  'Dock',
  'LynxTemplateBundle',
  'LynxTemplateData',
  'LynxUpdateMeta',
  'LynxWindow',
  'Menu',
  'MenuItem',
  'NativeImage',
  'Notification',
  'Tray',
  'UtilityProcess',
]);

/**
 * Local identifiers that stand for a documented type. `win` is the LynxWindow
 * every fiddle is handed; `nativeImage` is the lowercase runtime namespace,
 * which has no page of its own — its members are documented on the class.
 */
const ALIASES: Record<string, string> = {
  win: 'LynxWindow',
  window: 'LynxWindow',
  nativeImage: 'NativeImage',
};

/**
 * Turn `"dialog.showOpenDialog"` into a docs URL, or null when the symbol has
 * no published page (`powerMonitor` and `lynxBridge` exist in the typings but
 * are not in the docs — better no link than a 404).
 */
export function docsUrlFor(reference: string): string | null {
  const [rawOwner, member] = reference.split('.');
  const owner = ALIASES[rawOwner] ?? rawOwner;

  if (CLASSES.has(owner)) {
    return `${DOCS_BASE}/Class.${owner}.html${member ? `#${member.toLowerCase()}` : ''}`;
  }
  const iface = VARIABLE_INTERFACES[owner];
  if (iface) {
    // With no member, the variable's own page is the better landing spot: it
    // says what the export is before sending you to the type behind it.
    return member
      ? `${DOCS_BASE}/Interface.${iface}.html#${member.toLowerCase()}`
      : `${DOCS_BASE}/Variable.${owner}.html`;
  }
  return null;
}
