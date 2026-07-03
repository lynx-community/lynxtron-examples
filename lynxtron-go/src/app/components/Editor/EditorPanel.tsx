import './Editor.css';
import { EDITOR_ID } from '../../store';

interface EditorPanelProps {
  activeTabId: string | null;
}

export function EditorPanel({ activeTabId }: EditorPanelProps) {
  return (
    <view className="EditorWrapper">
      {activeTabId
        ? <scintilla-view className="Editor" editor-id={EDITOR_ID} />
        : (
          <view className="Welcome">
            <text className="WelcomeTitle">Lynxtron IDE</text>
            <text className="WelcomeText">{'\u2318\u21E7O  Open Folder'}</text>
          </view>
        )
      }
    </view>
  );
}
