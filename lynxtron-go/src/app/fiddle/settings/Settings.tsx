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
  const [panel, setPanel] = useState<Panel>('general');
  const [state, setState] = useState<SettingsState>(DEFAULTS);
  const [addThemeOpen, setAddThemeOpen] = useState(false);
  const [ghUser, setGhUser] = useState<GitHubUser | null>(null);
  const [ghValidating, setGhValidating] = useState(false);

  useEffect(() => {
    const cached = foundationApi()?.config?.get?.('fiddle.githubUser') as GitHubUser | null;
    if (cached) setGhUser(cached);
  }, []);

  useEffect(() => { if (props.isOpen) setState(loadPersisted()); }, [props.isOpen]);

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
              <text className="Settings-SectionTitle">General</text>
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
                  label="Block accelerators from reaching the fiddle process"
                  onChange={(v) => update('blockAccelerators', v)}
                />
              </FormGroup>
            </>
          )}
          {panel === 'appearance' && (
            <>
              <text className="Settings-SectionTitle">Appearance</text>
              <FormGroup label="Theme" helperText="System theme follows the OS light/dark preference.">
                <view className="Settings-Radios">
                  {(['dark', 'light', 'system'] as const).map(t => (
                    <Checkbox
                      key={t}
                      checked={state.theme === t}
                      label={t.charAt(0).toUpperCase() + t.slice(1)}
                      onChange={() => update('theme', t)}
                    />
                  ))}
                </view>
              </FormGroup>
              <FormGroup label="Editor font size" helperText="Applies to the code editors immediately.">
                <InputGroup
                  value={String(state.fontSize)}
                  onChange={(v) => update('fontSize', Math.max(8, Math.min(32, parseInt(v, 10) || 13)))}
                />
              </FormGroup>
              <FormGroup label="Custom themes" helperText="Import your own theme JSON to skin the whole app.">
                <Button icon="add" text="Add Theme…" onClick={() => setAddThemeOpen(true)} />
              </FormGroup>
            </>
          )}
          {panel === 'execution' && (
            <>
              <text className="Settings-SectionTitle">Execution</text>
              <FormGroup label="Runtime flags" helperText="Passed on the Lynxtron command line when Run is pressed.">
                <InputGroup
                  fill
                  value={state.runtimeFlags}
                  placeholder="--inspect=9223 --no-sandbox"
                  onChange={(v) => update('runtimeFlags', v)}
                />
              </FormGroup>
              <Callout intent="warning" icon="warning-sign" title="Custom flags are not validated">
                Bad flags may crash the fiddle process on launch. Check the console for spawn errors.
              </Callout>
            </>
          )}
          {panel === 'github' && (
            <>
              <text className="Settings-SectionTitle">GitHub</text>
              {ghUser ? (
                <Callout intent="success" icon="tick" title={`Signed in as ${ghUser.login}`}>
                  {ghUser.name ? `${ghUser.name} — ` : ''}publish + private gists enabled.
                </Callout>
              ) : (
                <Callout intent="primary" icon="info-sign">
                  Create a GitHub token with the "gist" scope to publish and load private gists.
                </Callout>
              )}
              <FormGroup label="Personal access token" helperText="Token is stored locally in fiddle.githubToken.">
                <InputGroup
                  fill
                  value={state.githubToken}
                  placeholder="ghp_…"
                  onChange={(v) => update('githubToken', v)}
                />
              </FormGroup>
              <view style={{ display: 'flex', flexDirection: 'row', columnGap: '8px', alignItems: 'center' } as any}>
                <Button
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
      <view className="Settings-Footer">
        <Button text="Done" intent="primary" onClick={props.onClose} />
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
