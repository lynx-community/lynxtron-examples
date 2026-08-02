import { useRef, useEffect } from '@lynx-js/react'; // eslint-disable-line
import './Editor.css';
import { EDITOR_ID } from '../../store';

interface EditorPanelProps {
  activeTabId: string | null;
  /** A workspace this window was opened to prepare could not be prepared. */
  workspaceError?: string | null;
  onRetryWorkspace?: () => void;
  // Re-push the active tab's content into the native editor. Content applied
  // before the scintilla-view's first attach/paint lands in the document but
  // does not repaint (blank pane), so we call this once after first layout.
  onEditorLayout?: () => void;
}

export function EditorPanel({ activeTabId, workspaceError, onRetryWorkspace, onEditorLayout }: EditorPanelProps) {
  const nudged = useRef(false);
  // Reset the one-shot nudge whenever the editor unmounts (back to Welcome),
  // so re-opening a file after closing all tabs paints again.
  useEffect(() => {
    if (!activeTabId) nudged.current = false;
  }, [activeTabId]);

  const handleLayout = () => {
    if (nudged.current) return;
    nudged.current = true;
    // Slight delay so the SCI re-push lands after the view is framed/attached.
    setTimeout(() => onEditorLayout?.(), 150);
  };

  return (
    <view className="EditorWrapper">
      {activeTabId
        ? (
          <view className="EditorBody" bindlayoutchange={handleLayout}>
            <scintilla-view className="Editor" editor-id={EDITOR_ID} />
          </view>
        )
        : workspaceError
        ? (
          // A window spawned to open a showcase that never arrived used to show
          // the same "Open Folder" invitation as an idle one, so a failed fetch
          // was indistinguishable from having opened nothing — the reason sat
          // in the Output panel, which is closed by default.
          <view className="Welcome">
            <text className="WelcomeTitle">Couldn't prepare this workspace</text>
            <text className="WelcomeError">{workspaceError}</text>
            {onRetryWorkspace ? (
              <view className="WelcomeAction" bindtap={onRetryWorkspace}>
                <text className="WelcomeActionText">Try again</text>
              </view>
            ) : null}
            <text className="WelcomeText">{'⌘⇧O  Open a folder instead'}</text>
          </view>
        )
        : (
          <view className="Welcome">
            <text className="WelcomeTitle">Lynxtron IDE</text>
            <text className="WelcomeText">{'⌘⇧O  Open Folder'}</text>
          </view>
        )
      }
    </view>
  );
}
