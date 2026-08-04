import { useState } from '@lynx-js/react';
import { BRAND_MARK_ON_DARK_URL, BRAND_MARK_URL, getExposed } from '../../store';
import { Button, ControlGroup, InputGroup } from '../bp';
import { Tooltip } from '../bp/Tooltip';
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
  /** macOS fullscreen hides the traffic lights; the bar reclaims their space. */
  fullScreen?: boolean;
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
    <view className={'commands bp3-dark' + (isMac && !props.fullScreen ? ' is-mac' : '')}>
      {/* The traffic lights are laid out, not padded around. macOS removes them
          in fullscreen, and a hardcoded inset leaves that width dead — so the
          gap is a flex item the bar drops when the main process reports the
          window went fullscreen. */}
      {isMac && !props.fullScreen ? <view className="commands-trafficlights" /> : null}
      <view className="commands-left">
        <ControlGroup>
          {/* The mark itself, not a stand-in glyph. `saved` was a tick — it
              said "saved", which this button has never meant.

              Both lockups are rendered and CSS shows one. Picking in JS would
              mean threading the resolved theme down here for a value that is
              already expressed as a class on the root. */}
          <Tooltip content="Choose Lynxtron version">
            <Button
              iconNode={BRAND_MARK_URL ? (
                <view className="commands-mark">
                  <image className="commands-mark-art commands-mark-art--on-light" src={BRAND_MARK_URL} />
                  <image className="commands-mark-art commands-mark-art--on-dark" src={BRAND_MARK_ON_DARK_URL} />
                </view>
              ) : null}
              rightIcon="chevron-down"
              text={props.currentVersion}
              disabled={gallery}
              onClick={props.onOpenVersionChooser}
            />
          </Tooltip>
          <Button
            icon={props.isRunning ? 'stop' : 'play'}
            text={props.isRunning ? 'Stop' : 'Run'}
            intent={props.isRunning ? 'danger' : 'primary'}
            disabled={gallery && !props.isRunning}
            onClick={props.onRun}
          />
        </ControlGroup>
        {/* The only label in the bar that was pure repetition: this toggles a
            panel whose state is already on screen, so the word said nothing the
            console itself wasn't saying. It could only go once hovering could
            still name it. */}
        <ControlGroup>
          <Tooltip content={props.isConsoleShowing ? 'Hide console' : 'Show console'}>
            <Button
              icon="console"
              active={props.isConsoleShowing}
              onClick={props.onToggleConsole}
            />
          </Tooltip>
        </ControlGroup>
        <ControlGroup>
          <Tooltip content={gallery ? 'Back to Fiddle' : 'Browse showcases'}>
            <Button
              icon="folder-open"
              text="Gallery"
              active={gallery}
              onClick={props.onToggleGallery}
            />
          </Tooltip>
        </ControlGroup>
      </view>
      {/* hiddenInset window: the flexible middle of the header is the drag
          region (-x-app-region: drag) — controls live outside it, so the
          undocumented no-drag value is never needed. */}
      <view className="commands-drag">
        {/* The lane sits only on the left, so a title centred in the space
            between the clusters lands right of the window's centre. A mirror
            spacer on the right squares it but leaves the right cluster short
            of the edge, which reads as bad alignment — so the correction lives
            on the title instead: a centred flex item with a right margin
            shifts left by half of it. */}
        <text
          className={'commands-title' + (isMac && !props.fullScreen ? ' commands-title--offset' : '')}
          text-maxline="1"
        >{props.title}</text>
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
          />
          {/* Beside the field, not inside it. As a rightElement it was absolutely
              positioned over the input, so the URL ran underneath the button and
              the two read as one confused control. */}
          <Tooltip content="Load this gist as a Fiddle" align="end">
            <Button
              icon="cloud-download"
              text="Load"
              small
              disabled={!gistInput || gallery}
              onClick={() => { if (gistInput) props.onLoadGist(gistInput); }}
            />
          </Tooltip>
        </view>
        <Tooltip
          content={props.gistId ? 'Update the gist this Fiddle came from' : 'Publish these files as a GitHub gist'}
          align="end"
        >
          <Button
            icon="upload"
            text={props.gistId ? 'Update' : 'Publish'}
            disabled={gallery}
            onClick={props.onPublishGist}
          />
        </Tooltip>
        {/* Search lives on the right, the way it does in the editors this bar is
            modelled on — and it is what brings the two clusters to within a
            few pixels of each other, which is what lets the title be centred
            without spending its own width on the correction. The accelerator
            is the label: a palette nobody knows the key for is a palette
            nobody opens. */}
        <ControlGroup className="commands-palette">
          <Tooltip
            content="Quick Open — type > for commands"
            hotkey={isMac ? '⌘K' : 'Ctrl+K'}
            align="end"
          >
            <Button
              icon="search"
              text={isMac ? '\u2318P' : 'Ctrl+P'}
              onClick={() => props.onOpenPalette?.()}
            />
          </Tooltip>
        </ControlGroup>
        {/* App-scoped, like the overflow beside it — and moving it off the left
            evens the two clusters, which is what lets the centred title sit
            near the real centre of the window rather than the centre of
            whatever space the left cluster left over. */}
        <Tooltip content="Settings" align="end">
          <Button icon="cog" minimal onClick={props.onOpenSettings} />
        </Tooltip>
        <Tooltip content="More commands" align="end">
          <Button
            icon="more"
            minimal
            active={!!props.overflowOpen}
            onClick={() => props.onToggleOverflow?.()}
          />
        </Tooltip>
      </view>
    </view>
  );
}
