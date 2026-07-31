import './GalleryHome.css';
import { Button } from '../../fiddle/bp';
import { isDevMode } from '../../fiddle/dev-preset';
import {
  FIDDLE_CATALOG,
  FIDDLE_SHOWCASE_NAME,
  SHOWCASE_LOCAL_WORKSPACE,
  SHOWCASE_PREVIEW,
  SHOWCASE_REGISTRY,
  type FiddleEntry,
  type ShowcaseEntry,
} from '../../store';

interface GalleryHomeProps {
  onBack: () => void;
  onOpenFolder: () => void;
  onOpenShowcase: (entry: ShowcaseEntry) => void;
  /** Legacy route: open the workspace in the old IDE shell instead of the Fiddle. */
  onOpenShowcaseLegacy: (entry: ShowcaseEntry) => void;
  onRunShowcase: (entry: ShowcaseEntry) => void;
  /** Build + launch a single fiddle of the Electron-fiddles collection. */
  onRunFiddle: (entry: ShowcaseEntry, fiddleId: string) => void;
  /** Load ONE fiddle's own source into the Fiddle editors. */
  onOpenFiddle: (entry: ShowcaseEntry, fiddle: { id: string; title: string; upstream: string }) => void;
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

const FIDDLE_STATUS_LABEL: Record<string, string> = {
  working: 'working',
  partial: 'partial',
  na: 'N/A',
};

/**
 * Every ported Electron `docs/fiddles` example, grouped the way the upstream
 * docs group them. This is one collection inside a single showcase, not one
 * showcase per fiddle — so it gets its own section rather than N cards in the
 * featured grid above.
 */
function ElectronFiddlesSection({
  onRunFiddle,
  onOpenFiddle,
}: {
  onRunFiddle: (f: FiddleEntry) => void;
  onOpenFiddle: (f: FiddleEntry) => void;
}) {
  const { categories, fiddles } = FIDDLE_CATALOG;
  if (!fiddles.length) return null;

  // One pass over the catalog: tally the status counts and bucket by category.
  // Categories are seeded in the manifest's declared order so they render that
  // way; anything the manifest did not declare is appended as it is met.
  const counts: Record<string, number> = {};
  const buckets = new Map<string, FiddleEntry[]>(categories.map(c => [c, []]));
  for (const f of fiddles) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
    const bucket = buckets.get(f.category);
    if (bucket) bucket.push(f);
    else buckets.set(f.category, [f]);
  }
  const grouped = [...buckets].filter(([, items]) => items.length > 0);

  return (
    <>
      <view className="GallerySectionRule">
        <text className="GallerySectionLabel">
          ELECTRON FIDDLES ON LYNXTRON · {String(fiddles.length)}
        </text>
        <view className="GallerySectionLine" />
      </view>

      <view className="FiddleIntro">
        <text className="FiddleIntroText">
          The complete Electron <text className="FiddleIntroCode">docs/fiddles</text> set, ported to
          Lynxtron — {String(counts.working ?? 0)} working, {String(counts.partial ?? 0)} partial,{' '}
          {String(counts.na ?? 0)} not portable. Each is its own project: Open loads just that
          fiddle's source, Run builds and launches it as its own process.
        </text>
      </view>

      {grouped.map(([category, items]) => (
        <view key={category} className="FiddleGroup">
          <text className="FiddleGroupTitle">{category}</text>
          <view className="FiddleList">
            {items.map(f => (
              // The same card as the featured showcases above — same class, so
              // the two grids stay identical by construction rather than by
              // two stylesheets agreeing. The body is fixed-height for the same
              // reason it is up there: it pins every footer to the bottom, so a
              // one-line description cannot pull its actions up out of line.
              <view
                key={f.id}
                className={`GalleryCard${f.status === 'na' ? ' GalleryCard--inert' : ''}`}
              >
                <view className="GalleryCardBody FiddleCardBody">
                  <view className="GalleryCardTitleRow">
                    <text className="GalleryCardTitle" text-maxline="1">{f.title}</text>
                    <view className={`FiddleBadge FiddleBadge--${f.status}`}>
                      <text className={`FiddleBadgeText FiddleBadgeText--${f.status}`}>
                        {FIDDLE_STATUS_LABEL[f.status] ?? f.status}
                      </text>
                    </view>
                  </view>
                  <text className="GalleryCardDescription" text-maxline="2">{f.description}</text>
                  {f.notes ? <text className="FiddleCardNotes" text-maxline="2">{f.notes}</text> : null}
                </view>
                {/* The footer is always present, so every card is the same
                    height. An N/A fiddle has nothing to open or assemble, so it
                    says why instead of offering actions that would not work. */}
                <view className="GalleryCardFooter">
                  {f.status === 'na' ? (
                    <text className="GalleryCardActionText">not portable</text>
                  ) : (
                    <>
                      <view
                        className="GalleryCardAction GalleryCardAction--primary"
                        bindtap={() => onOpenFiddle(f)}
                      >
                        <text className="GalleryCardActionText GalleryCardActionText--primary">Open</text>
                      </view>
                      <view className="GalleryCardAction" bindtap={() => onRunFiddle(f)}>
                        <text className="GalleryCardActionText">Run</text>
                      </view>
                    </>
                  )}
                </view>
              </view>
            ))}
          </view>
        </view>
      ))}
    </>
  );
}

export function GalleryHome({
  onBack,
  onOpenFolder,
  onOpenShowcase,
  onOpenShowcaseLegacy,
  onRunShowcase,
  onRunFiddle,
  onOpenFiddle,
  onRunShowcaseOnWeb,
  onDebugExampleRoute,
  standalone = false,
}: GalleryHomeProps) {
  // The Electron-fiddles showcase gets its own section below, so it does not
  // also take a slot in the featured grid.
  const fiddleShowcase = SHOWCASE_REGISTRY.find(e => e.name === FIDDLE_SHOWCASE_NAME);
  const featured = fiddleShowcase
    ? SHOWCASE_REGISTRY.filter(e => e.name !== FIDDLE_SHOWCASE_NAME)
    : SHOWCASE_REGISTRY;

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
                {entry.targets?.includes('web') ? (
                  <view className="GalleryCardAction GalleryCardAction--web" bindtap={() => onRunShowcaseOnWeb(entry)}>
                    <text className="GalleryCardActionText GalleryCardActionText--web">Web</text>
                  </view>
                ) : null}
              </view>
            </view>
          ))}
        </view>

        {fiddleShowcase ? (
          <ElectronFiddlesSection
            onRunFiddle={(f) => onRunFiddle(fiddleShowcase, f.id)}
            onOpenFiddle={(f) => onOpenFiddle(fiddleShowcase, f)}
          />
        ) : null}
      </scroll-view>
    </view>
  );
}
