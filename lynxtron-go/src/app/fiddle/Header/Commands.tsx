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
  /** Unsaved changes. Rendered as its own dot, not glued to the title. */
  isEdited?: boolean;
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
        {/* Text and a chevron, nothing else. A mark here competed with the one
            on Run for the same glance, and this control is a value you are
            reading — a version — not an action you are taking. */}
        <Tooltip content="Choose Lynxtron version">
          <Button
            className="commands-version"
            rightIcon="chevron-down"
            text={props.currentVersion}
            minimal
            disabled={gallery}
            onClick={props.onOpenVersionChooser}
          />
        </Tooltip>
        {/* The one filled control in the bar, and the only one that keeps a
            word. It wears the Lynxtron mark rather than a play triangle: this
            is not "play media", it is "build this and launch Lynxtron", and
            the mark says which runtime is about to start. Stop keeps a square,
            because the mark cannot mean stop. */}
        <Button
          className="commands-run"
          iconNode={!props.isRunning && BRAND_MARK_URL
            ? <image className="commands-run-mark" src={BRAND_MARK_URL} />
            : undefined}
          icon={props.isRunning ? 'stop' : undefined}
          text={props.isRunning ? 'Stop' : 'Run'}
          intent={props.isRunning ? 'danger' : 'primary'}
          disabled={gallery && !props.isRunning}
          onClick={props.onRun}
        />
        {/* A field, not a button. Search reads as somewhere you type, so it
            wears the recessed ground an input has and the accelerator sits in
            it the way placeholder text would. On the left because that is
            where you look for it — it was on the right only to balance the
            title, which is the wrong reason to place a control. */}
        <Tooltip content="Quick Open — type > for commands" hotkey={isMac ? '⌘K' : 'Ctrl+K'}>
          <Button
            className="commands-search"
            icon="search"
            text={isMac ? '⌘P' : 'Ctrl+P'}
            minimal
            onClick={() => props.onOpenPalette?.()}
          />
        </Tooltip>
        <view className="commands-views">
          <Tooltip content={props.isConsoleShowing ? 'Hide console' : 'Show console'}>
            <Button
              icon="console"
              minimal
              active={props.isConsoleShowing}
              onClick={props.onToggleConsole}
            />
          </Tooltip>
          {/* Gallery drops its word for the same reason Console did: it is a
              view toggle whose state is on screen, and hovering still names
              it. */}
          <Tooltip content={gallery ? 'Back to Fiddle' : 'Browse showcases'}>
            <Button
              icon="folder-open"
              minimal
              active={gallery}
              onClick={props.onToggleGallery}
            />
          </Tooltip>
        </view>
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
        {/* A status dot, not a full stop. It was concatenated onto the title
            string as " •", which put a bullet in the middle of a sentence-shaped
            line and read as stray punctuation — and it could not be styled,
            spaced or dimmed, because it was a character inside someone else's
            text node. */}
        {props.isEdited ? <view className="commands-dirty" /> : null}
      </view>
      <view className="commands-right">
        <view className="commands-address">
          {/* One gating mechanism (disabled), and one validator: onLoadGist's
              parseGistId decides what's loadable, for Enter and click alike. */}
          {/* No leading icon. It was a magnifier, which now reads as a second
              search in a bar that already has one, and at this width it sat on
              top of the placeholder. The placeholder is the label. */}
          <InputGroup
            placeholder="gist URL"
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
              small
              minimal
              disabled={!gistInput || gallery}
              onClick={() => { if (gistInput) props.onLoadGist(gistInput); }}
            />
          </Tooltip>
        </view>
        <Tooltip
          content={props.gistId ? 'Update the gist this Fiddle came from' : 'Publish these files as a GitHub gist'}
          align="end"
        >
          <Button icon="upload" minimal disabled={gallery} onClick={props.onPublishGist} />
        </Tooltip>
        {/* The line falls where the SCOPE changes: Load and Publish act on this
            Fiddle's documents, Settings and the overflow act on the app. */}
        <view className="commands-divider" />
        <view className="commands-rail">
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
    </view>
  );
}
