import { useEffect, useState } from '@lynx-js/react';
import { Button, Dialog, NonIdealState, Spinner, Tag } from '../bp';
import { getExposed, appendFiddleOutput as appendOutput, foundationApi } from '../../store';
import { AddVersionDialog } from './AddVersionDialog';
import { fetchLynxtronVersions, type CatalogVersion } from './catalog';
import { installLynxtronVersion } from './install';
import { AppToaster } from '../bp';

interface LocalVersion {
  name: string;
  folder: string;
}

function loadLocalVersions(): LocalVersion[] {
  const cfg = foundationApi()?.config;
  const raw = cfg?.get?.('fiddle.localVersions');
  return Array.isArray(raw) ? raw as LocalVersion[] : [];
}

function saveLocalVersions(versions: LocalVersion[]) {
  foundationApi()?.config?.set?.('fiddle.localVersions', versions);
}

export interface VersionChooserProps {
  isOpen: boolean;
  currentVersion: string;
  selectedLocalName: string | null;
  onSelect: (localName: string | null) => void;
  onClose: () => void;
}

export function VersionChooser(props: VersionChooserProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [localVersions, setLocalVersions] = useState<LocalVersion[]>(() => loadLocalVersions());
  const [catalog, setCatalog] = useState<CatalogVersion[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showPrereleases, setShowPrereleases] = useState(false);

  useEffect(() => {
    if (!props.isOpen || catalog !== null) return;
    setCatalogLoading(true);
    setCatalogError(null);
    fetchLynxtronVersions()
      .then(v => setCatalog(v))
      .catch(e => setCatalogError(e?.message ?? String(e)))
      .finally(() => setCatalogLoading(false));
  }, [props.isOpen, catalog]);

  const filteredCatalog = catalog
    ? catalog.filter(v => showPrereleases || !v.isPrerelease)
    : [];

  const handleAdd = (name: string, folder: string) => {
    const next = [...localVersions, { name, folder }];
    setLocalVersions(next);
    saveLocalVersions(next);
  };

  const handleRemove = (name: string) => {
    const next = localVersions.filter(v => v.name !== name);
    setLocalVersions(next);
    saveLocalVersions(next);
  };

  const [installingVersion, setInstallingVersion] = useState<string | null>(null);

  const handleDownload = async (v: CatalogVersion) => {
    setInstallingVersion(v.version);
    AppToaster.show({
      message: `Installing @lynx-js/lynxtron@${v.version}…`,
      intent: 'primary',
      icon: 'cloud-download',
      timeout: 3000,
    });
    const result = await installLynxtronVersion('@lynx-js/lynxtron', v.version);
    setInstallingVersion(null);
    if (result.ok) {
      const name = `Lynxtron ${v.version}`;
      const next = [...localVersions, { name, folder: result.installDir }];
      setLocalVersions(next);
      saveLocalVersions(next);
      AppToaster.show({
        message: `Installed ${v.version}`,
        intent: 'success',
        icon: 'tick',
      });
    } else {
      AppToaster.show({
        message: `Install failed: ${result.error ?? 'unknown'}`,
        intent: 'danger',
        icon: 'error',
        timeout: 6000,
      });
    }
  };

  return (
    <>
      <Dialog isOpen={props.isOpen} title="Lynxtron Version" onClose={props.onClose} width={640}>
        <view className="Version-List">
          <view
            className={'Version-Item' + (props.selectedLocalName == null ? ' Version-Item--active' : '')}
            bindtap={() => props.onSelect(null)}
          >
            <text className="Version-ItemText">{props.currentVersion}</text>
            <Tag intent="success" minimal>bundled</Tag>
            {props.selectedLocalName == null ? <text className="Version-Check">✓</text> : null}
          </view>

          {localVersions.length > 0 && (
            <>
              <view style={{ padding: '8px 12px 4px 12px' } as any}>
                <text className="bp-muted" style={{ fontSize: '11px', letterSpacing: '0.5px' } as any}>LOCAL</text>
              </view>
              {localVersions.map(v => (
                <view
                  key={v.name}
                  className={'Version-Item' + (props.selectedLocalName === v.name ? ' Version-Item--active' : '')}
                  bindtap={() => props.onSelect(v.name)}
                >
                  <view style={{ flex: 1, display: 'flex', flexDirection: 'column' } as any}>
                    <text className="Version-ItemText">{v.name}</text>
                    <text className="bp-muted" style={{ fontSize: '11px', fontFamily: 'monospace' } as any}>{v.folder}</text>
                  </view>
                  {props.selectedLocalName === v.name ? <text className="Version-Check">✓</text> : null}
                  <view bindtap={(e: any) => { e?.stopPropagation?.(); handleRemove(v.name); }} style={{ padding: '2px 8px', cursor: 'pointer' } as any}>
                    <text style={{ color: '#ff7373', fontSize: '11px' } as any}>Remove</text>
                  </view>
                </view>
              ))}
            </>
          )}

          <view style={{ padding: '8px 12px 4px 12px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as any}>
            <text className="bp-muted" style={{ fontSize: '11px', letterSpacing: '0.5px' } as any}>REMOTE CATALOG</text>
            <view bindtap={() => setShowPrereleases(v => !v)} style={{ cursor: 'pointer', padding: '2px 6px' } as any}>
              <text style={{ color: '#48aff0', fontSize: '11px' } as any}>
                {showPrereleases ? 'Hide prereleases' : 'Show prereleases'}
              </text>
            </view>
          </view>

          {catalogLoading ? (
            <view style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px' } as any}>
              <Spinner size={24} intent="primary" />
              <text className="bp-muted" style={{ fontSize: '12px' } as any}>Fetching version catalog…</text>
            </view>
          ) : catalogError ? (
            <NonIdealState
              icon="warning-sign"
              title="Couldn't fetch catalog"
              description={catalogError}
            />
          ) : (
            <scroll-view className="Version-CatalogList" scroll-orientation="vertical">
              {filteredCatalog.slice(0, 40).map(v => (
                <view key={v.version} className="Version-Item">
                  <view style={{ flex: 1, display: 'flex', flexDirection: 'column' } as any}>
                    <view style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', columnGap: '6px' } as any}>
                      <text className="Version-ItemText">{v.version}</text>
                      {v.isPrerelease ? <Tag intent="warning" minimal>prerelease</Tag> : null}
                    </view>
                    {v.publishedAt ? (
                      <text className="bp-muted" style={{ fontSize: '11px', fontFamily: 'monospace' } as any}>
                        {v.publishedAt.slice(0, 10)}
                      </text>
                    ) : null}
                  </view>
                  {installingVersion === v.version ? (
                    <Spinner size={14} intent="primary" />
                  ) : (
                    <Button text="Download" small onClick={() => handleDownload(v)} disabled={installingVersion !== null} />
                  )}
                </view>
              ))}
            </scroll-view>
          )}
        </view>
        <view style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px' } as any}>
          <Button icon="add" text="Add Local Version" onClick={() => setAddOpen(true)} />
          <Button text="Done" intent="primary" onClick={props.onClose} />
        </view>
      </Dialog>
      <AddVersionDialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </>
  );
}
