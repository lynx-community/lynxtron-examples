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
  eventThrough?: boolean;
}

export function Icon(props: IconProps) {
  const [fontReady, setFontReady] = useState(isIconFontLoaded());
  useEffect(() => {
    'background only';
    // Subscribe before requesting so the first icon cannot miss a fast
    // callback. Then synchronize this component's render snapshot: icons that
    // rendered before the shared font loaded but run their effect afterwards
    // otherwise remain on the fallback forever.
    const unsubscribe = onIconFontLoaded(() => {
      setFontReady(true);
    });
    ensureIconFont();
    if (isIconFontLoaded()) setFontReady(true);
    return unsubscribe;
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
  // Keep the loaded-font and fallback cases as distinct JSX branches. Clay's
  // addFont callback is dispatched before its font/layout work is guaranteed
  // complete; mutating an existing fallback text node to a downloaded family
  // can leave that native node bound to its old typeface and render PUA glyphs
  // as tofu. A fresh text node resolves the now-registered family correctly.
  if (useFont) {
    return (
      <text
        event-through={props.eventThrough ?? false}
        className={cls}
        style={{ ...textStyle, fontFamily: ICON_FONT_FAMILY }}
      >
        {ICON_CODEPOINTS[props.icon]}
      </text>
    );
  }
  return (
    <text event-through={props.eventThrough ?? false} className={cls} style={textStyle}>
      {GLYPH[props.icon] ?? '?'}
    </text>
  );
}
