import './GalleryHome.css';
import { Button } from '../../fiddle/bp';
import { isDevMode } from '../../fiddle/dev-preset';
import {
  SHOWCASE_LOCAL_WORKSPACE,
  SHOWCASE_PREVIEW,
  SHOWCASE_REGISTRY,
  type ShowcaseEntry,
} from '../../store';

interface GalleryHomeProps {
  onBack: () => void;
  onOpenFolder: () => void;
  onOpenShowcase: (entry: ShowcaseEntry) => void;
  /** Legacy route: open the workspace in the old IDE shell instead of the Fiddle. */
  onOpenShowcaseLegacy: (entry: ShowcaseEntry) => void;
  onRunShowcase: (entry: ShowcaseEntry) => void;
  onRunShowcaseOnWeb: (entry: ShowcaseEntry) => void;
  onDebugExampleRoute: () => void;
  /** Full-screen fallback (legacy IDE) — no commands bar above, so the page
      must carry its own exit. In the Fiddle shell the bar's pressed Gallery
      toggle is the exit and this stays hidden. */
  standalone?: boolean;
}

function getThumbnailFallback(name: string): string {
  const head = name.trim().slice(0, 2).toUpperCase();
  return head || 'GO';
}

// go-web-style tag chips: a small set of tints, assigned deterministically so
// the same tag always gets the same color across cards and sessions.
const TAG_TINTS = ['blue', 'green', 'orange', 'violet', 'teal'] as const;
function tagTint(tag: string): (typeof TAG_TINTS)[number] {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_TINTS[h % TAG_TINTS.length];
}

export function GalleryHome({
  onBack,
  onOpenFolder,
  onOpenShowcase,
  onOpenShowcaseLegacy,
  onRunShowcase,
  onRunShowcaseOnWeb,
  onDebugExampleRoute,
  standalone = false,
}: GalleryHomeProps) {
  const featured = SHOWCASE_REGISTRY;

  return (
    <view className="GalleryHome">
      <scroll-view className="GalleryScroll" scroll-y>
        {/* Slim top bar — the app's real commands bar sits right above this
            layer, so the gallery only labels itself and offers its actions,
            using the same Blueprint Button component as the rest of the app. */}
        <view className="GalleryTopBar">
          <view className="GalleryTopBarTitleGroup">
            <text className="GalleryTitle">Showcase gallery</text>
            {SHOWCASE_PREVIEW && <text className="GalleryBadge">PREVIEW</text>}
          </view>
          <view className="GalleryTopBarActions">
            {standalone ? <Button text="← Back" small minimal onClick={onBack} /> : null}
            {/* Gallery-unique actions only: browsing lives on this page itself
                (the old "Browse All" opened a picker that did exactly what the
                cards' Open does), and the deep-link debug probe is dev-only. */}
            <Button text="Open Folder…" small title="Open a folder as an IDE workspace" onClick={onOpenFolder} />
            {isDevMode() ? (
              <Button text="debug route" small minimal title="Dev: probe the example deep-link route" onClick={onDebugExampleRoute} />
            ) : null}
          </view>
        </view>

        <view className="GallerySectionRule">
          <text className="GallerySectionLabel">FEATURED SHOWCASES · {String(featured.length)}</text>
          <view className="GallerySectionLine" />
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
                    {SHOWCASE_LOCAL_WORKSPACE || entry.url.startsWith('file://') || !entry.url ? 'LOCAL' : 'REMOTE'}
                  </text>
                </view>
              </view>

              <view className="GalleryCardBody">
                <view className="GalleryCardTitleRow">
                  <text className="GalleryCardTitle" text-maxline="1">{entry.name}</text>
                  <view className="GalleryTagRow">
                    {entry.tags.slice(0, 3).map(tag => (
                      <view key={`${entry.name}-${tag}`} className={`GalleryTag GalleryTag--${tagTint(tag)}`}>
                        <text className={`GalleryTagText GalleryTagText--${tagTint(tag)}`}>{tag}</text>
                      </view>
                    ))}
                  </view>
                </view>
                <text className="GalleryCardDescription" text-maxline="2">{entry.description}</text>
              </view>

              <view className="GalleryCardFooter" catchtap={() => {}}>
                <view className="GalleryCardAction GalleryCardAction--primary" bindtap={() => onOpenShowcase(entry)}>
                  <text className="GalleryCardActionText GalleryCardActionText--primary">Open</text>
                </view>
                <view className="GalleryCardAction" bindtap={() => onRunShowcase(entry)}>
                  <text className="GalleryCardActionText">Run</text>
                </view>
                <view className="GalleryCardAction" bindtap={() => onOpenShowcaseLegacy(entry)}>
                  <text className="GalleryCardActionText">IDE</text>
                </view>
                {entry.targets.includes('web') ? (
                  <view className="GalleryCardAction GalleryCardAction--web" bindtap={() => onRunShowcaseOnWeb(entry)}>
                    <text className="GalleryCardActionText GalleryCardActionText--web">Web</text>
                  </view>
                ) : null}
              </view>
            </view>
          ))}
        </view>
      </scroll-view>
    </view>
  );
}
