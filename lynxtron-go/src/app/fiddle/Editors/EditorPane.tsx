import { useEffect, useRef } from '@lynx-js/react';
import { Button } from '../bp';
import { scintillaApi } from '../../store';
import { getEditorTitle } from '../types';
import { scintillaIdFor } from '../state/useFiddle';
import { applyEditorTheme, editorFontSize, isDarkTheme } from '../theme';
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
  /** Search UI for this pane; reserves space above the native editor body. */
  findBar?: any;
  /** Host has a dialog/overlay up — the native view must stay detached. */
  suppressed?: boolean;
}

/**
 * One mosaic pane: 30px toolbar (upstream .mosaic-window-toolbar — title +
 * 0.75-scaled maximize/cross controls) above a live scintilla-view.
 */
export function EditorPane(props: EditorPaneProps) {
  const { file } = props;
  const nudged = useRef(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push content when this pane (re)mounts. ScintillaRegistry buffers
  // setText/setStyles issued before the native view registers, so this is
  // safe in both orders.
  useEffect(() => {
    props.pushContent(file.id);
    applyEditorTheme(file.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);
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

  return (
    <view className="MosaicWindow" bindtap={() => props.onFocus(file.id)}>
      <view className="MosaicToolbar">
        <text
          className={'MosaicToolbar-Title' + (props.active ? ' MosaicToolbar-Title--active' : '')}
          text-maxline="1"
        >{getEditorTitle(file.id)}</text>
        <view className="MosaicToolbar-Controls">
          <Button icon="maximize" small minimal title="Maximize" onClick={() => props.onMaximize(file.id)} />
          <Button icon="cross" small minimal title="Hide" onClick={() => props.onHide(file.id)} />
        </view>
      </view>
      {props.findBar}
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
