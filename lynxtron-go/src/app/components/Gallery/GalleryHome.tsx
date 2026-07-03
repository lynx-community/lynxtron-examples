import './GalleryHome.css';
import { SHOWCASE_PREVIEW, SHOWCASE_REGISTRY, type ShowcaseEntry } from '../../store';

interface GalleryHomeProps {
  lastWorkspacePath: string | null;
  onOpenFolder: () => void;
  onOpenShowcasePicker: () => void;
  onResumeWorkspace: () => void;
  onOpenShowcase: (entry: ShowcaseEntry) => void;
  onRunShowcase: (entry: ShowcaseEntry) => void;
  onRunShowcaseOnWeb: (entry: ShowcaseEntry) => void;
  onDebugExampleRoute: () => void;
}

function getWorkspaceLabel(path: string | null): string {
  if (!path) return '';
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

function getThumbnailFallback(name: string): string {
  const head = name.trim().slice(0, 2).toUpperCase();
  return head || 'GO';
}

export function GalleryHome({
  lastWorkspacePath,
  onOpenFolder,
  onOpenShowcasePicker,
  onResumeWorkspace,
  onOpenShowcase,
  onRunShowcase,
  onRunShowcaseOnWeb,
  onDebugExampleRoute,
}: GalleryHomeProps) {
  const featured = SHOWCASE_REGISTRY;
  const lastWorkspaceLabel = getWorkspaceLabel(lastWorkspacePath);

  return (
    <view className="GalleryHome">
      <scroll-view className="GalleryScroll" scroll-y>
        <view className="GalleryBackdrop GalleryBackdropOne" />
        <view className="GalleryBackdrop GalleryBackdropTwo" />

        <view className="GalleryHero">
          <view className="GalleryHeroTop">
            <text className="GalleryKicker">LYNXTRON GO</text>
            {SHOWCASE_PREVIEW && <text className="GalleryBadge">PREVIEW</text>}
          </view>
          <text className="GalleryTitle">Showcase gallery and runner</text>
          <text className="GallerySubtitle">
            Start here to browse the built-in showcases, then jump into the IDE shell when you need a workspace.
          </text>

          <view className="GalleryActions">
            <view className="GalleryButton GalleryButtonPrimary" bindtap={onOpenFolder}>
              <text className="GalleryButtonText">Open Folder</text>
            </view>
            <view className="GalleryButton GalleryButtonSecondary" bindtap={onOpenShowcasePicker}>
              <text className="GalleryButtonText">Open Showcase</text>
            </view>
            {lastWorkspacePath ? (
              <view className="GalleryButton GalleryButtonGhost" bindtap={onResumeWorkspace}>
                <text className="GalleryButtonText">Resume {lastWorkspaceLabel}</text>
              </view>
            ) : null}
            <view className="GalleryButton GalleryButtonDebug" bindtap={onDebugExampleRoute}>
              <text className="GalleryButtonText">Debug Example Route</text>
            </view>
          </view>
        </view>

        <view className="GalleryInfoRow">
          <view className="GalleryInfoCard">
            <text className="GalleryInfoValue">{featured.length}</text>
            <text className="GalleryInfoLabel">showcases ready</text>
          </view>
          <view className="GalleryInfoCard">
            <text className="GalleryInfoValue">1</text>
            <text className="GalleryInfoLabel">workspace runner</text>
          </view>
          <view className="GalleryInfoCard">
            <text className="GalleryInfoValue">Cmd+P</text>
            <text className="GalleryInfoLabel">command palette anytime</text>
          </view>
        </view>

        <view className="GallerySectionHeader">
          <text className="GallerySectionTitle">Featured showcases</text>
          <text className="GallerySectionCaption">
            Open to inspect. Run desktop or web directly from the gallery.
          </text>
        </view>

        <view className="GalleryGrid">
          {featured.map(entry => (
            <view
              key={entry.name}
              className="GalleryCard"
              bindtap={() => onOpenShowcase(entry)}
            >
              <view className="GalleryThumb">
                {entry.thumbnail ? (
                  <image className="GalleryThumbImage" src={entry.thumbnail} mode="aspectFill" />
                ) : (
                  <view className="GalleryThumbFallback">
                    <text className="GalleryThumbFallbackText">{getThumbnailFallback(entry.name)}</text>
                  </view>
                )}
                <view className="GalleryThumbOverlay">
                  <text className="GalleryThumbOverlayText">
                    {entry.url.startsWith('file://') ? 'LOCAL' : 'REMOTE'}
                  </text>
                </view>
              </view>

              <view className="GalleryCardBody">
                <view className="GalleryCardHeader">
                  <view className="GalleryCardTitleRow">
                    <text className="GalleryCardTitle">{entry.name}</text>
                    {entry.path ? <text className="GalleryCardPath">{entry.path}</text> : null}
                  </view>
                  <text className="GalleryCardDescription">{entry.description}</text>
                </view>

                <view className="GalleryTagRow">
                  {entry.tags.map(tag => (
                    <view key={`${entry.name}-${tag}`} className="GalleryTag">
                      <text className="GalleryTagText">{tag}</text>
                    </view>
                  ))}
                </view>

                <view className="GalleryCardActions" catchtap={() => {}}>
                  <view className="GalleryCardAction GalleryCardActionPrimary" bindtap={() => onOpenShowcase(entry)}>
                    <text className="GalleryCardActionText">Open</text>
                  </view>
                  <view className="GalleryCardAction GalleryCardActionSecondary" bindtap={() => onRunShowcase(entry)}>
                    <text className="GalleryCardActionText">Run</text>
                  </view>
                  {entry.targets.includes('web') ? (
                    <view className="GalleryCardAction GalleryCardActionWeb" bindtap={() => onRunShowcaseOnWeb(entry)}>
                      <text className="GalleryCardActionText">Run on Web</text>
                    </view>
                  ) : null}
                </view>
              </view>
            </view>
          ))}
        </view>
      </scroll-view>
    </view>
  );
}
