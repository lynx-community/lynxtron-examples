import { useState } from '@lynx-js/react';
import { getExposed } from '../../store';
import { Button, ControlGroup, InputGroup } from '../bp';
import './Commands.css';

export interface CommandsProps {
  isConsoleShowing: boolean;
  onToggleConsole: () => void;
  /** Gallery is a VIEW toggle like Console — pressed while the page is open. */
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
  currentVersion: string;
  gistId: string | null;
  isRunning: boolean;
  title: string;
}

// Mirrors upstream Fiddle's commands.tsx: left cluster (settings /
// version+run / console), centered window title (mac), right cluster
// (address bar / gist history / gist action). Extra entry points that
// upstream keeps in the app menu (new fiddle, browse showcases, save)
// live as minimal icons at the far right until the menu port lands.
export function Commands(props: CommandsProps) {
  const [gistInput, setGistInput] = useState('');
  // While the gallery page covers the fiddle, its DOCUMENT controls are
  // disabled (not hidden — the bar keeps its shape and reads as "these
  // belong to the page underneath"). View/app controls stay live. The Run
  // button stays reachable while a fiddle run is active so Stop still works.
  const gallery = !!props.galleryOpen;

  const isMac = (() => { try { return getExposed()?.platform === 'darwin'; } catch (_) { return false; } })();

  return (
    <view className={'commands bp3-dark' + (isMac ? ' is-mac' : '')}>
      <view className="commands-left">
        <ControlGroup>
          <Button icon="cog" title="Settings" onClick={props.onOpenSettings} />
        </ControlGroup>
        <ControlGroup>
          <Button
            icon="saved"
            rightIcon="chevron-down"
            text={props.currentVersion}
            title="Choose Lynxtron version"
            disabled={gallery}
            onClick={props.onOpenVersionChooser}
          />
          <Button
            icon={props.isRunning ? 'stop' : 'play'}
            text={props.isRunning ? 'Stop' : 'Run'}
            intent={props.isRunning ? 'danger' : 'primary'}
            disabled={gallery && !props.isRunning}
            onClick={props.onRun}
          />
        </ControlGroup>
        <ControlGroup>
          <Button
            icon="console"
            text="Console"
            active={props.isConsoleShowing}
            onClick={props.onToggleConsole}
          />
        </ControlGroup>
        <ControlGroup>
          <Button
            icon="folder-open"
            text="Gallery"
            active={gallery}
            title={gallery ? 'Back to Fiddle' : 'Browse showcases'}
            onClick={props.onToggleGallery}
          />
        </ControlGroup>
      </view>
      {/* hiddenInset window: the flexible middle of the header is the drag
          region (-x-app-region: drag) — controls live outside it, so the
          undocumented no-drag value is never needed. */}
      <view className="commands-drag">
        <text className="commands-title" text-maxline="1">{props.title}</text>
      </view>
      <view className="commands-right">
        <view className={'commands-address' + (gistInput ? '' : ' empty')}>
          {/* One gating mechanism (disabled), and one validator: onLoadGist's
              parseGistId decides what's loadable, for Enter and click alike. */}
          <InputGroup
            placeholder="https://gist.github.com/..."
            leftIcon="geosearch"
            fill
            disabled={gallery}
            value={gistInput}
            onChange={setGistInput}
            onSubmit={(v) => { if (v) props.onLoadGist(v); }}
            rightElement={
              <Button
                icon="cloud-download"
                title="Load Fiddle"
                small
                disabled={!gistInput || gallery}
                onClick={() => { if (gistInput) props.onLoadGist(gistInput); }}
              />
            }
          />
        </view>
        <Button
          icon="history"
          title="Gist History"
          disabled={!props.gistId || gallery}
          onClick={props.onOpenHistory}
        />
        <Button
          icon="upload"
          text={props.gistId ? 'Update' : 'Publish'}
          disabled={gallery}
          onClick={props.onPublishGist}
        />
        <Button icon="add" title="New Fiddle" minimal disabled={gallery} onClick={props.onNewFiddle} />
        <Button icon="floppy-disk" title="Save Fiddle" minimal disabled={gallery} onClick={props.onSave} />
        {/* App-scoped like Settings/Console — stays live over the gallery. */}
        <Button icon="help" title="Help" minimal onClick={props.onOpenHelp} />
      </view>
    </view>
  );
}
