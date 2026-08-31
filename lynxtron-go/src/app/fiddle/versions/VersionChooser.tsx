import { useEffect, useState } from '@lynx-js/react';
import { NonIdealState, Spinner, Tag } from '../bp';
import { PlatformOverlay } from '../../components/shared/PlatformOverlay';
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
  /** macOS keeps a traffic-light lane, so the anchor sits further right. */
  isMac?: boolean;
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

  if (!props.isOpen) {
    return (
      <AddVersionDialog isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    );
  }

  return (
    <>
      {/* A popover, not a modal. The control that opens this is a chevron, and a
          chevron promises a menu that drops out of it — a 640px sheet that dims
          the window is a different promise. What happens here is picking one
          value from a list, and it applies the moment you pick it: there was
          nothing for the modal's "Done" to confirm, which is why it was a
          filled brand button that only closed the thing it sat in.
          Anchored, like the commands overflow beside it, so the bar has one
          kind of list-popover rather than two. */}
      <PlatformOverlay priority={120}>
        <view event-through={false} className="Version-Backdrop" bindtap={props.onClose} />
        <view event-through={false} className={'Version-Panel' + (props.isMac ? ' Version-Panel--mac' : '')}>
          <scroll-view className="Version-Scroll" scroll-orientation="vertical">
            <text className="Version-SectionLabel">Bundled</text>
            <view
              className={'Version-Item' + (props.selectedLocalName == null ? ' Version-Item--active' : '')}
              bindtap={() => props.onSelect(null)}
            >
              <view className="Version-ItemMain">
                <text className="Version-ItemText">{props.currentVersion}</text>
              </view>
              <Tag intent="success" minimal>bundled</Tag>
              {props.selectedLocalName == null ? <text className="Version-Check">✓</text> : null}
            </view>

            {localVersions.length > 0 && (
              <>
                <text className="Version-SectionLabel">Local</text>
                {localVersions.map(v => (
                  <view
                    key={v.name}
                    className={'Version-Item' + (props.selectedLocalName === v.name ? ' Version-Item--active' : '')}
                    bindtap={() => props.onSelect(v.name)}
                  >
                    <view className="Version-ItemMain">
                      <text className="Version-ItemText">{v.name}</text>
                      <text className="Version-ItemMeta" text-maxline="1">{v.folder}</text>
                    </view>
                    {props.selectedLocalName === v.name ? <text className="Version-Check">✓</text> : null}
                    <view className="Version-ItemAction" bindtap={(e: any) => { e?.stopPropagation?.(); handleRemove(v.name); }}>
                      <text className="Version-ItemActionText">Remove</text>
                    </view>
                  </view>
                ))}
              </>
            )}

            <view className="Version-SectionRow">
              <text className="Version-SectionLabel Version-SectionLabel--inline">Catalog</text>
              <view bindtap={() => setShowPrereleases(v => !v)}>
                <text className="Version-SectionAction">
                  {showPrereleases ? 'Hide prereleases' : 'Show prereleases'}
                </text>
              </view>
            </view>

            {catalogLoading ? (
              <view className="Version-Loading">
                <Spinner size={18} intent="primary" />
                <text className="Version-LoadingText">Fetching catalog…</text>
              </view>
            ) : catalogError ? (
              <NonIdealState icon="warning-sign" title="Couldn't fetch catalog" description={catalogError} />
            ) : (
              filteredCatalog.slice(0, 40).map(v => (
                <view key={v.version} className="Version-Item">
                  <view className="Version-ItemMain">
                    <view className="Version-ItemHead">
                      <text className="Version-ItemText">{v.version}</text>
                      {v.isPrerelease ? <Tag intent="warning" minimal>prerelease</Tag> : null}
                    </view>
                    {v.publishedAt ? (
                      <text className="Version-ItemMeta">{v.publishedAt.slice(0, 10)}</text>
                    ) : null}
                  </view>
                  {installingVersion === v.version ? (
                    <Spinner size={14} intent="primary" />
                  ) : (
                    <view
                      className="Version-ItemAction"
                      bindtap={() => { if (installingVersion === null) handleDownload(v); }}
                    >
                      <text className="Version-ItemActionText">Download</text>
                    </view>
                  )}
                </view>
              ))
            )}
          </scroll-view>
          {/* One quiet row at the foot, not a button bar: there is nothing to
              confirm, so the only thing left is the one act the list cannot
              offer — pointing at a runtime already on disk. */}
          <view className="Version-Foot" bindtap={() => setAddOpen(true)}>
            <text className="Version-FootText">＋  Add a local runtime…</text>
          </view>
        </view>
      </PlatformOverlay>
      <AddVersionDialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </>
  );
}
