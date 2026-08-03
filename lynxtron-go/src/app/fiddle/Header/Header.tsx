import { Commands } from './Commands';
import './Header.css';

export interface HeaderProps {
  isConsoleShowing: boolean;
  onToggleConsole: () => void;
  galleryOpen?: boolean;
  onToggleGallery: () => void;
  onNewFiddle: () => void;
  onRun: () => void;
  onSave: () => void;
  onPublishGist: () => void;
  onLoadGist: (input: string) => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenVersionChooser: () => void;
  onOpenPalette?: () => void;
  overflowOpen?: boolean;
  onToggleOverflow?: () => void;
  currentVersion: string;
  gistId: string | null;
  title: string;
  isEdited: boolean;
  isRunning: boolean;
}

export function Header(props: HeaderProps) {
  return (
    <view className="FiddleHeader">
      <Commands
        isConsoleShowing={props.isConsoleShowing}
        onToggleConsole={props.onToggleConsole}
        galleryOpen={props.galleryOpen}
        onToggleGallery={props.onToggleGallery}
        onNewFiddle={props.onNewFiddle}
        onRun={props.onRun}
        onSave={props.onSave}
        onPublishGist={props.onPublishGist}
        onLoadGist={props.onLoadGist}
        onOpenHistory={props.onOpenHistory}
        onOpenSettings={props.onOpenSettings}
        onOpenHelp={props.onOpenHelp}
        onOpenVersionChooser={props.onOpenVersionChooser}
        onOpenPalette={props.onOpenPalette}
        overflowOpen={props.overflowOpen}
        onToggleOverflow={props.onToggleOverflow}
        currentVersion={props.currentVersion}
        gistId={props.gistId}
        isRunning={props.isRunning}
        title={props.galleryOpen ? 'Gallery' : props.title + (props.isEdited ? ' •' : '')}
      />
    </view>
  );
}
