import { useCallback } from '@lynx-js/react';
import { FIDDLES, CATEGORY_ORDER, type FiddleMeta, type FiddleStatus } from '../../catalog';
import { bridgeSend } from '@lynxtron-examples/fiddle-kit/bridge';
import './App.css';

const STATUS_LABEL: Record<FiddleStatus, string> = {
  working: 'working',
  partial: 'partial',
  na: 'N/A',
};

function FiddleCard({ meta }: { meta: FiddleMeta }) {
  const launchable = meta.status !== 'na';
  const onTap = useCallback(() => {
    if (launchable) bridgeSend('launchFiddle', { id: meta.id });
  }, [meta.id, launchable]);

  return (
    <view
      className={`card${launchable ? '' : ' card-disabled'}`}
      bindtap={onTap}
    >
      <view className="card-head">
        <text className="card-title">{meta.title}</text>
        <view className={`badge badge-${meta.status}`}>
          <text className="badge-text">{STATUS_LABEL[meta.status]}</text>
        </view>
      </view>
      <text className="card-desc">{meta.description}</text>
      {meta.notes ? <text className="card-notes">{meta.notes}</text> : null}
    </view>
  );
}

export function App() {
  const total = FIDDLES.length;
  const working = FIDDLES.filter((f) => f.status === 'working').length;
  const partial = FIDDLES.filter((f) => f.status === 'partial').length;
  const na = FIDDLES.filter((f) => f.status === 'na').length;

  return (
    <scroll-view className="home" scroll-orientation="vertical">
      <view className="home-inner">
        <text className="home-title">Electron Fiddles on Lynxtron</text>
        <text className="home-sub">
          {`${total} fiddles · ${working} working · ${partial} partial · ${na} N/A — tap a card to launch`}
        </text>

        {CATEGORY_ORDER.map((category) => {
          const items = FIDDLES.filter((f) => f.category === category);
          if (items.length === 0) return null;
          return (
            <view className="group" key={category}>
              <text className="group-title">{category}</text>
              <view className="grid">
                {items.map((meta) => (
                  <FiddleCard meta={meta} key={meta.id} />
                ))}
              </view>
            </view>
          );
        })}
      </view>
    </scroll-view>
  );
}
