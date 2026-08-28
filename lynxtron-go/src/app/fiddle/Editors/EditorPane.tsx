import { useEffect, useRef, useState } from '@lynx-js/react';
import { Button, Icon } from '../bp';
import { scintillaApi } from '../../store';
import { getEditorTitle } from '../types';
import { scintillaIdFor } from '../state/useFiddle';
import { applyEditorTheme, editorFontSize, editorZoomLevel, isDarkTheme, resetEditorZoom } from '../theme';
import type { FiddleFile } from '../state/FiddleState';
import './Editors.css';

export interface EditorPaneProps {
  file: FiddleFile;
  /** This pane's file is the app's focused file (sidebar selection). */
  active?: boolean;
  onHide: (id: string) => void;
  onMaximize: (id: string) => void;
  onFocus: (id: string) => void;
  pushContent: (id: string) => void;
  /**
   * Detach the native view. #46 kept this channel open for exactly this: a
   * surface that REPLACES the editors rather than floating over them does not
   * need a platform overlay, and a plain Lynx view cannot cover a native one.
   */
  suppressed?: boolean;
  /** This pane is the expanded one. The control that did it says so. */
  maximized?: boolean;
}

/**
 * One mosaic pane: 30px toolbar (upstream .mosaic-window-toolbar — title +
 * 0.75-scaled maximize/cross controls) above a live scintilla-view.
 */
export function EditorPane(props: EditorPaneProps) {
  const { file } = props;
  const nudged = useRef(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On remount (see index.tsx / fiddle:remount), delay emitting the
  // <scintilla-view> for one render pass so the process-global
  // ScintillaRegistry sees a real "unmounted → remounted" transition for this
  // editor id — issuing the element in the very first pass, alongside a
  // freshly-destroyed prior ScintillaView with the same id, leaves the new
  // view registered but visually blank on first paint.
  const [mountEditor, setMountEditor] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMountEditor(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Push content when this pane (re)mounts. ScintillaRegistry buffers
  // setText/setStyles issued before the native view registers, so this is
  // safe in both orders.
  useEffect(() => {
    if (!mountEditor) return;
    props.pushContent(file.id);
    applyEditorTheme(file.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, mountEditor]);
  // The nudge below must not fire into an unmounted pane's editor id.
  useEffect(() => () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);

  // Content applied before the native view's first attach/paint doesn't
  // trigger a repaint — the pane stays visually empty even though the
  // document holds the text. Re-push once right after the body gets its
  // first layout (attach happens in the same layout pass), slightly delayed
  // so the SCI messages land after the view is framed.
  const onBodyLayout = () => {
    if (nudged.current) return;
    nudged.current = true;
    nudgeTimer.current = setTimeout(() => {
      props.pushContent(file.id);
      applyEditorTheme(file.id);
      try { scintillaApi()?.gotoLine?.(scintillaIdFor(file.id), 0); } catch (_) {}
    }, 150);
  };

  // Polled rather than pushed: SCN_ZOOM fires on the native side and this
  // module never calls into the Lynx JS thread from a notification. One read
  // per second is far below what a pinch costs anyway.
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const tick = () => setZoomed(editorZoomLevel(file.id) !== 0);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [file.id]);

  return (
    <view
      className={'MosaicWindow' + (props.active ? ' MosaicWindow--active' : '')}
      bindtap={() => props.onFocus(file.id)}
    >
      {/* The active class is set HERE rather than matched through the pane via
          `.MosaicWindow--active .MosaicToolbar` — descendant selectors are not
          something to bet a visible state on in Lynx's CSS subset. */}
      <view className={'MosaicToolbar' + (props.active ? ' MosaicToolbar--active' : '')}>
        <text
          className={'MosaicToolbar-Title' + (props.active ? ' MosaicToolbar-Title--active' : '')}
          text-maxline="1"
        >{getEditorTitle(file.id)}</text>
        <view className="MosaicToolbar-Controls">
          {/* Pinch zoom is per-pane and sticky; this is the only way back to
              the configured size. `refresh` because the icon font carries only
              maximize/minimize/refresh — anything else renders as a literal
              '?', which is worse than an approximate glyph with a clear title.
              Lit while the pane IS zoomed: otherwise the only clue is that the
              text looks unlike its neighbours', and the button reads as a
              control with no state. */}
          {/* iconNode, not `icon`: <Icon> writes font-size as an INLINE style,
              which no stylesheet rule can override — the 9px declared for these
              controls in Editors.css had been dead the whole time and the
              glyphs rendered at the 14px default. Size travels with the icon. */}
          <Button
            iconNode={<Icon icon="refresh" size={11} className="bp3-button-icon" />}
            small
            minimal
            active={zoomed}
            title={zoomed ? 'Zoomed — reset to the configured font size' : 'Reset zoom'}
            onClick={() => { resetEditorZoom(file.id); setZoomed(false); }}
          />
          <Button
            iconNode={<Icon icon={props.maximized ? 'minimize' : 'maximize'} size={11} className="bp3-button-icon" />}
            small
            minimal
            active={!!props.maximized}
            title={props.maximized ? 'Restore this pane' : 'Maximize'}
            onClick={() => props.onMaximize(file.id)}
          />
          <Button
            iconNode={<Icon icon="cross" size={11} className="bp3-button-icon" />}
            small
            minimal
            title="Hide"
            onClick={() => props.onHide(file.id)}
          />
        </view>
      </view>
      <view className="MosaicBody" bindlayoutchange={onBodyLayout}>
        <scintilla-view
          className="MosaicEditor"
          editor-id={scintillaIdFor(file.id)}
          font-size={String(editorFontSize())}
          theme-dark={isDarkTheme() ? 'true' : 'false'}
          suppressed={props.suppressed ? 'true' : 'false'}
        />
      </view>
    </view>
  );
}
