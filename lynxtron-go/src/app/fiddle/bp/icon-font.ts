// ?inline → data:font/ttf;base64,… — the desktop (Clay) text stack decodes
// data: font URLs natively (FontResourceManager::DecodeBase64Str); file:// and
// http(s) font fetches never reach a working loader on this runtime.
import fontUrl from './assets/blueprint-icons-16.ttf?inline';

// Blueprint 3 icon font (icons-16.ttf from @blueprintjs/icons@3.33.0).
// Codepoints extracted from lib/esm/generated/iconContents.js of that package —
// the same glyphs upstream Electron Fiddle renders via @blueprintjs/core <Icon>.
export const ICON_FONT_FAMILY = 'blueprint-icons-16';

export const ICON_CODEPOINTS: Record<string, string> = {
  cog: '\ue645',
  console: '\ue79b',
  play: '\ue6ab',
  stop: '\ue6aa',
  refresh: '\ue643',
  add: '\ue63e',
  delete: '\ue644',
  edit: '\u270e',
  'floppy-disk': '\ue6b7',
  'cloud-upload': '\ue691',
  'cloud-download': '\ue690',
  'chevron-down': '\ue697',
  'chevron-up': '\ue696',
  'chevron-right': '\ue695',
  'chevron-left': '\ue694',
  search: '\ue64b',
  document: '\ue630',
  'folder-close': '\ue652',
  'folder-open': '\ue651',
  'th-list': '\ue668',
  more: '\ue62a',
  cross: '\u2717',
  tick: '\u2713',
  'warning-sign': '\ue647',
  'info-sign': '\u2139',
  error: '\ue648',
  application: '\ue735',
  home: '\u2302',
  code: '\ue661',
  inbox: '\ue629',
  link: '\ue62d',
  history: '\ue64a',
  applications: '\ue621',
  clipboard: '\ue61d',
  cloud: '\u2601',
  desktop: '\ue6af',
  'document-open': '\ue71e',
  download: '\ue62f',
  duplicate: '\ue69c',
  filter: '\ue638',
  geosearch: '\ue613',
  'git-branch': '\ue72a',
  'grid-view': '\ue6e4',
  help: '\u003f',
  'lab-test': '\ue90e',
  lock: '\ue625',
  'log-in': '\ue69a',
  'log-out': '\ue64c',
  maximize: '\ue635',
  media: '\ue62c',
  'numbered-list': '\ue746',
  presentation: '\ue687',
  redo: '\ue6c4',
  remove: '\ue63f',
  repeat: '\ue692',
  'step-forward': '\ue6ad',
  'tick-circle': '\ue779',
  tint: '\ue6b2',
  trash: '\ue63b',
  unlock: '\ue626',
  wrench: '\ue734',
  saved: '\ue6b6',
  compressed: '\ue6c0',
  issue: '\ue774',
  plus: '\u002b',
  upload: '\ue68f',
  book: '\ue6b8',
  'eye-open': '\ue66f',
  'eye-off': '\ue6cc',
  minimize: '\ue634',
};

type Listener = () => void;
let loaded = false;
let requested = false;
const listeners: Listener[] = [];

function debugLog(msg: string): void {
  'background only';
  try {
    console.log(msg);
    (NativeModules as any)?.bridge?.send?.('logFromUi', { message: msg });
  } catch (_) {}
}

export function isIconFontLoaded(): boolean {
  return loaded;
}

export function onIconFontLoaded(fn: Listener): () => void {
  'background only';
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

// Loads the icon font via lynx.addFont. Safe to call repeatedly; only the
// first call issues the request. If the host has no font resource loader the
// callback never fires and <Icon> keeps its unicode-glyph fallback.
export function ensureIconFont(): void {
  'background only';
  if (requested) return;
  requested = true;
  try {
    (lynx as any).addFont(
      { 'font-family': ICON_FONT_FAMILY, src: `url(${fontUrl})` },
      (err: unknown) => {
        if (err) {
          debugLog(`[icon-font] addFont failed: ${JSON.stringify(err)}`);
          return; // keep unicode fallback
        }
        loaded = true;
        for (const fn of [...listeners]) fn();
      },
    );
  } catch (e) {
    // host has no font loader — unicode fallback stays in place
    debugLog(`[icon-font] addFont threw: ${String(e)}`);
  }
}
