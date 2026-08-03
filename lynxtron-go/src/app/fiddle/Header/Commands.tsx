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
  /** App-level palette (⌘P / ⌘K). The bar is its only visible affordance. */
  onOpenPalette?: () => void;
  /** The overflow panel is rendered by Fiddle — the 51px header clips it, and
      it has to suppress the native editors to be visible at all. */
  overflowOpen?: boolean;
  onToggleOverflow?: () => void;
  currentVersion: string;
  gistId: string | null;
  isRunning: boolean;
  title: string;
}

// Left cluster is the verbs — settings, version, run, console, gallery, and
// the palette. Centre is the window title (and the drag region). Right is the
// gist round trip, plus an overflow for the entry points that already live in
// the app menu with accelerators.
//
// Upstream keeps new/save/help out of the bar entirely, in the app menu. We
// used to keep all three as icons at the far right, which crowded the gist
// address into a field too narrow to read a URL in. The overflow is the middle
// ground: reachable by pointer, but not spending bar width on commands that
// have keys.
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
        {/* Gallery's sibling: one browses showcases by eye, the other jumps by
            typing. The accelerator is the label — a palette nobody knows the
            key for is a palette nobody opens. */}
        <ControlGroup className="commands-palette">
          <Button
            icon="search"
            text={isMac ? '\u2318P' : 'Ctrl+P'}
            title="Quick Open (files) · type > for commands, or press \u2318K"
            onClick={() => props.onOpenPalette?.()}
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
        <view className="commands-address">
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
                text="Load"
                title="Load Fiddle from this gist"
                small
                disabled={!gistInput || gallery}
                onClick={() => { if (gistInput) props.onLoadGist(gistInput); }}
              />
            }
          />
        </view>
        <Button
          icon="upload"
          text={props.gistId ? 'Update' : 'Publish'}
          disabled={gallery}
          onClick={props.onPublishGist}
        />
        <Button
          icon="more"
          title="More commands"
          minimal
          active={!!props.overflowOpen}
          onClick={() => props.onToggleOverflow?.()}
        />
      </view>
    </view>
  );
}
