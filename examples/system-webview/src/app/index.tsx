import { root, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

declare const __WEBVIEW_ENGINE__: string;

function App() {
  const [compact, setCompact] = useState(true);
  return (
    <view className="shell">
      <view className="toolbar">
        <text className="title">Native UI showcase</text>
        <view className="action" bindtap={() => setCompact(!compact)}>
          <text className="action-label">{compact ? 'Expand WebView' : 'Narrow WebView'}</text>
        </view>
      </view>
      <view className={compact ? 'panel panel-compact' : 'panel'}>
        <view className="caption">
          <text className="name">Embedded WebView</text>
          <text className="engine">{__WEBVIEW_ENGINE__}</text>
        </view>
        <system-webview src="https://lynxjs.org/lynxtron/index.html" className="webview" />
      </view>
    </view>
  );
}

root.render(<App />);
