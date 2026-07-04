import { useRef, useEffect } from '@lynx-js/react'; // eslint-disable-line
import './Editor.css';
import { EDITOR_ID } from '../../store';

interface EditorPanelProps {
  activeTabId: string | null;
  // Re-push the active tab's content into the native editor. Content applied
  // before the scintilla-view's first attach/paint lands in the document but
  // does not repaint (blank pane), so we call this once after first layout.
  onEditorLayout?: () => void;
}

export function EditorPanel({ activeTabId, onEditorLayout }: EditorPanelProps) {
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
