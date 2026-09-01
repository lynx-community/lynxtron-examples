import { useState, useEffect } from '@lynx-js/react';
import { AppToaster, Button, Callout, Checkbox, Dialog, FormGroup, InputGroup, Spinner, Tag } from '../bp';
import { getExposed, foundationApi } from '../../store';
import { AddThemeDialog } from './AddThemeDialog';
import { TOKEN_CREATION_URL, validateGitHubToken, type GitHubUser } from '../gist/github-auth';

export interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Theme / editor font size changed — host re-applies UI class + editor themes. */
  onAppearanceChange?: () => void;
  /**
   * Pane to land on. Dev automation only: three of the four panes are reachable
   * solely by clicking the nav, so they could not be captured or regressed
   * without a human at the keyboard — the same gap `fiddle:toggleGallery`
   * exists to close.
   */
  initialPanel?: Panel;
}

type Panel = 'general' | 'appearance' | 'execution' | 'github';

interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  blockAccelerators: boolean;
  runtimeFlags: string;
  githubToken: string;
  showWelcomeTour: boolean;
}

const DEFAULTS: SettingsState = {
  theme: 'dark',
  fontSize: 13,
  blockAccelerators: false,
  runtimeFlags: '',
  githubToken: '',
  showWelcomeTour: true,
};

function loadPersisted(): SettingsState {
  const cfg = foundationApi()?.config;
  const raw = cfg?.get?.('fiddle.settings');
  return { ...DEFAULTS, ...(raw as any || {}) };
}

function persist(next: SettingsState) {
  foundationApi()?.config?.set?.('fiddle.settings', next);
}

export function Settings(props: SettingsProps) {
  const [panel, setPanel] = useState<Panel>(props.initialPanel ?? 'general');
  // Follows the prop on every open rather than only on first mount — a remount
  // (`key=`) would land the pane too, but at the cost of throwing away the
  // loaded settings and the cached GitHub user each time.
  useEffect(() => {
    if (props.isOpen && props.initialPanel) setPanel(props.initialPanel);
  }, [props.isOpen, props.initialPanel]);
  const [state, setState] = useState<SettingsState>(DEFAULTS);
  const [addThemeOpen, setAddThemeOpen] = useState(false);
  /**
   * The font size field is typed into, so it cannot be driven straight from
   * the clamped number. Clamping on every keystroke meant the first digit of
   * "18" became 8 and the caret jumped — the field rewrote what you typed
   * before you finished typing it. The draft holds exactly what is in the box;
   * the setting is committed only once the draft is a usable number.
   */
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);
  const [ghUser, setGhUser] = useState<GitHubUser | null>(null);
  const [ghValidating, setGhValidating] = useState(false);

  useEffect(() => {
    const cached = foundationApi()?.config?.get?.('fiddle.githubUser') as GitHubUser | null;
    if (cached) setGhUser(cached);
  }, []);

  useEffect(() => {
    if (!props.isOpen) return;
    setState(loadPersisted());
    setFontSizeDraft(null);
  }, [props.isOpen]);

  const update = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => {
    setState(prev => {
      const next = { ...prev, [k]: v };
      persist(next);
      return next;
    });
    if (k === 'theme' || k === 'fontSize') props.onAppearanceChange?.();
  };

  return (
    <Dialog isOpen={props.isOpen} title="Settings" onClose={props.onClose} width={760}>
      <view className="Settings-Layout">
        <view className="Settings-Sidebar">
          {([
            ['general', 'General'],
            ['appearance', 'Appearance'],
            ['execution', 'Execution'],
            ['github', 'GitHub'],
          ] as [Panel, string][]).map(([id, label]) => {
            const cls = 'Settings-SidebarItem' + (panel === id ? ' Settings-SidebarItem--active' : '');
            return (
              <view key={id} className={cls} bindtap={() => setPanel(id)}>
                <text className="Settings-SidebarItemText">{label}</text>
              </view>
            );
          })}
        </view>
        <view className="Settings-Body">
          {panel === 'general' && (
            <>
              <FormGroup label="Welcome tour">
                <Checkbox
                  checked={state.showWelcomeTour}
                  label="Show welcome tour on next launch"
                  onChange={(v) => update('showWelcomeTour', v)}
                />
              </FormGroup>
              <FormGroup label="Keyboard accelerators">
                <Checkbox
                  checked={state.blockAccelerators}
                  label="Block accelerators from reaching the launched Lynxtron app"
                  onChange={(v) => update('blockAccelerators', v)}
                />
              </FormGroup>
            </>
          )}
          {panel === 'appearance' && (
            <>
              <FormGroup label="Theme" helperText="System follows the OS light/dark preference.">
                {/* One choice, so one control. Three checkboxes said "tick any
                    number of these" for a setting that can only ever be one —
                    and left it possible to render a state with none ticked. A
                    segment group says exclusive by its shape. */}
                <view className="Settings-Segment">
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <view
                      key={t}
                      className={'Settings-SegmentItem' + (state.theme === t ? ' Settings-SegmentItem--active' : '')}
                      bindtap={() => update('theme', t)}
                    >
                      <text className="Settings-SegmentText">
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </text>
                    </view>
                  ))}
                </view>
              </FormGroup>
              <FormGroup label="Editor font size" helperText="Applies to the code editors immediately.">
                {/* Needs a width. The inner <input> is `flex: 1` — flex-basis
                    0 — so in a group with no width of its own it collapses to
                    nothing, which is what this field had been: a 0px box with
                    the value inside it and no way to type. The gist address bar
                    escaped it only because its container is a fixed 280px. */}
                <InputGroup
                  className="SettingsNumberInput"
                  value={fontSizeDraft ?? String(state.fontSize)}
                  onChange={(v) => {
                    // Keep the raw text so the box shows what was typed —
                    // including the transient "1" on the way to "18", and the
                    // empty string on the way to replacing the value.
                    const raw = v.replace(/[^0-9]/g, '').slice(0, 2);
                    setFontSizeDraft(raw);
                    const n = parseInt(raw, 10);
                    if (Number.isFinite(n) && n >= 8 && n <= 32) update('fontSize', n);
                  }}
                  onSubmit={() => setFontSizeDraft(null)}
                />
              </FormGroup>
              <FormGroup label="Custom themes" helperText="Import your own theme JSON to skin the whole app.">
                {/* Framed, unlike the frameless controls in the commands bar. A
                    button with no ground reads as pressable because its
                    NEIGHBOURS do; this one is alone under a label, so with no
                    edge it was indistinguishable from the helper text until
                    the pointer happened to cross it. */}
                <Button icon="add" text="Add Theme…" onClick={() => setAddThemeOpen(true)} />
              </FormGroup>
            </>
          )}
          {panel === 'execution' && (
            <>
              <FormGroup label="Runtime flags" helperText="Passed on the Lynxtron command line when Run is pressed.">
                <InputGroup
                  fill
                  value={state.runtimeFlags}
                  placeholder="--inspect=9223 --no-sandbox"
                  onChange={(v) => update('runtimeFlags', v)}
                />
              </FormGroup>
              <Callout intent="warning" icon="warning-sign" title="Custom flags are not validated">
                Bad flags may crash the launched Lynxtron app. Check the console for spawn errors.
              </Callout>
            </>
          )}
          {panel === 'github' && (
            <>
              {ghUser ? (
                <Callout intent="success" icon="tick" title={`Signed in as ${ghUser.login}`}>
                  {ghUser.name ? `${ghUser.name} — ` : ''}publish + private gists enabled.
                </Callout>
              ) : (
                <Callout intent="primary" icon="info-sign">
                  Create a GitHub token with the "gist" scope to publish and load private gists.
                </Callout>
              )}
              <FormGroup label="Personal access token" helperText="Token is stored locally on this device.">
                <InputGroup
                  fill
                  value={state.githubToken}
                  placeholder="ghp_…"
                  onChange={(v) => update('githubToken', v)}
                />
              </FormGroup>
              <view style={{ display: 'flex', flexDirection: 'row', columnGap: '8px', alignItems: 'center' } as any}>
                {/* Leaves the app for a browser — it is a link, and it sits
                    beside the row's one real action. Framed, the two carried
                    equal weight and neither said which one you came here to
                    press. */}
                <Button
                  minimal
                  icon="link"
                  text="Create Token on GitHub"
                  onClick={() => {
                    try {
                      // @ts-ignore — bridge open URL
                      NativeModules.bridge.call('openExternal', { url: TOKEN_CREATION_URL }, () => {});
                    } catch (_) { /* no bridge */ }
                  }}
                />
                <Button
                  icon="tick"
                  text={ghValidating ? 'Validating…' : (ghUser ? 'Revalidate' : 'Sign In')}
                  intent="primary"
                  disabled={!state.githubToken || ghValidating}
                  onClick={async () => {
                    setGhValidating(true);
                    try {
                      const user = await validateGitHubToken(state.githubToken);
                      setGhUser(user);
                      foundationApi()?.config?.set?.('fiddle.githubUser', user);
                      AppToaster.show({ message: `Signed in as ${user.login}`, intent: 'success', icon: 'tick' });
                    } catch (e: any) {
                      AppToaster.show({ message: e?.message ?? 'Sign in failed', intent: 'danger', icon: 'error', timeout: 6000 });
                    } finally {
                      setGhValidating(false);
                    }
                  }}
                />
                {ghUser ? (
                  <Button
                    minimal
                    text="Sign Out"
                    onClick={() => {
                      setGhUser(null);
                      update('githubToken', '');
                      foundationApi()?.config?.set?.('fiddle.githubUser', null);
                      AppToaster.show({ message: 'Signed out of GitHub', intent: 'primary', icon: 'info-sign' });
                    }}
                  />
                ) : null}
                {ghValidating ? <Spinner size={16} intent="primary" /> : null}
                {ghUser ? <Tag intent="success" minimal>{ghUser.login}</Tag> : null}
              </view>
            </>
          )}
        </view>
      </view>
      <AddThemeDialog
        isOpen={addThemeOpen}
        onClose={() => setAddThemeOpen(false)}
        onAdd={(name, jsonPath) => {
          const themes = (foundationApi()?.config?.get?.('fiddle.themes') as any[]) || [];
          foundationApi()?.config?.set?.('fiddle.themes', [...themes, { name, jsonPath }]);
        }}
      />
    </Dialog>
  );
}
