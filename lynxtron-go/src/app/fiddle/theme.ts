import { scintillaApi, foundationApi } from '../store';
import { scintillaIdFor } from './state/useFiddle';
import { visibleEditorIds, type FiddleSnapshot } from './state/FiddleState';

// Theme plumbing for upstream Fiddle's defaultDark/defaultLight token sets.
// The Lynx UI side is pure CSS: tokens are custom properties on `.IDE`
// (App.css) overridden by `.IDE.theme-light`. The native editors are themed
// through the scintilla extension's setEditorTheme(id, dark, sizePt).

export type ThemeSetting = 'dark' | 'light' | 'system';

function settings(): any {
  try { return (foundationApi()?.config?.get?.('fiddle.settings') as any) || {}; } catch (_) { return {}; }
}

export function themeSetting(): ThemeSetting {
  const t = settings()?.theme;
  return t === 'light' || t === 'system' ? t : 'dark';
}

/** 'system' resolves to dark: the runtime exposes no OS appearance signal yet. */
export function isDarkTheme(): boolean {
  return themeSetting() !== 'light';
}

export function editorFontSize(): number {
  const n = parseInt(String(settings()?.fontSize), 10);
  return Number.isFinite(n) && n >= 8 && n <= 32 ? n : 13;
}

export function setThemeSetting(theme: ThemeSetting): void {
  try {
    const cfg = foundationApi()?.config;
    cfg?.set?.('fiddle.settings', { ...settings(), theme });
  } catch (_) {}
}

/** Apply the current theme + font size to one native editor. */
export function applyEditorTheme(fileId: string): void {
  try { scintillaApi()?.setEditorTheme?.(scintillaIdFor(fileId), isDarkTheme(), editorFontSize()); } catch (_) {}
}

export function applyEditorThemeAll(snap: FiddleSnapshot): void {
  for (const id of visibleEditorIds(snap)) applyEditorTheme(id);
}
