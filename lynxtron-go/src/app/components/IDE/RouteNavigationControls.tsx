import './RouteNavigationControls.css';

interface RouteNavigationControlsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

const noop = () => {};

export function RouteNavigationControls({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: RouteNavigationControlsProps) {
  return (
    <view className="RouteNavigationControls">
      <view
        className={`RouteNavigationButton${canGoBack ? '' : ' RouteNavigationButtonDisabled'}`}
        bindtap={canGoBack ? onBack : noop}
      >
        <text className="RouteNavigationButtonText">{'\u2039'}</text>
      </view>
      <view
        className={`RouteNavigationButton${canGoForward ? '' : ' RouteNavigationButtonDisabled'}`}
        bindtap={canGoForward ? onForward : noop}
      >
        <text className="RouteNavigationButtonText">{'\u203A'}</text>
      </view>
    </view>
  );
}
