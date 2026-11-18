import { root } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

declare const __WEBVIEW_ENGINE__: string;

root.render(
  <view className="shell">
    <view className="toolbar">
      <text className="title">System WebView</text>
      <text className="engine">{__WEBVIEW_ENGINE__}</text>
    </view>
    <system-webview src="https://lynxjs.org/lynxtron/index.html" className="webview" />
  </view>,
);
