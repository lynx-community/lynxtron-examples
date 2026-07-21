import { useEffect, useState } from '@lynx-js/react';
import {
  ensureIconFont,
  isIconFontLoaded,
  onIconFontLoaded,
  ICON_CODEPOINTS,
  ICON_FONT_FAMILY,
} from './icon-font';
import './bp.css';

// Any Blueprint 3 icon name present in ICON_CODEPOINTS (icon-font.ts) renders
// from the real icon font; names outside that map fall back to GLYPH below.
export type IconName = string;

// Unicode glyphs — fallback for hosts where the icon font fails to load
// (Lynx <svg content=…> renders as blank in current runtime).
const GLYPH: Record<string, string> = {
  cog: '⚙',
  console: '▤',
  play: '▶',
  stop: '■',
  refresh: '↻',
  add: '＋',
  delete: '🗑',
  edit: '✎',
  'floppy-disk': '💾',
  'cloud-upload': '⬆',
  'cloud-download': '⬇',
  'chevron-down': '▾',
  'chevron-up': '▴',
  'chevron-right': '▸',
  'chevron-left': '◂',
  search: '🔍',
  document: '📄',
  'folder-close': '▸',
  'folder-open': '📂',
  'th-list': '☰',
  more: '⋯',
  cross: '✕',
  tick: '✓',
  'warning-sign': '⚠',
  'info-sign': 'ⓘ',
  error: '⊗',
  application: '▢',
  home: '⌂',
  code: '⟨⟩',
  inbox: '✉',
  link: '🔗',
};

export interface IconProps {
  icon: IconName;
  className?: string;
  size?: number;
  color?: string;
}

export function Icon(props: IconProps) {
  const [fontReady, setFontReady] = useState(isIconFontLoaded());
  useEffect(() => {
    ensureIconFont();
    if (isIconFontLoaded()) return;
    return onIconFontLoaded(() => setFontReady(true));
  }, []);

  const cls = 'bp3-icon bp3-icon-' + props.icon + (props.className ? ' ' + props.className : '');
  const size = props.size ?? 14;
  const useFont = fontReady && ICON_CODEPOINTS[props.icon] != null;
  // Default color comes from the .bp3-icon CLASS (stylesheet var(--bp-text)
  // flips with the theme); inline var() resolution is unverified in Lynx.
  const textStyle: any = {
    fontSize: size + 'px',
    lineHeight: '1',
    width: size + 'px',
    height: size + 'px',
    display: 'inline-block',
  };
  if (props.color) textStyle.color = props.color;
  if (useFont) textStyle.fontFamily = ICON_FONT_FAMILY;
  const glyph = useFont ? ICON_CODEPOINTS[props.icon] : (GLYPH[props.icon] ?? '?');
  return <text className={cls} style={textStyle}>{glyph}</text>;
}
