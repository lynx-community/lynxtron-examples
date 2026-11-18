import { root, useState } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';

declare const __WEBVIEW_ENGINE__: string;
declare const __LOCAL_PAGE__: string;
const website = 'https://lynxjs.org/';

function App() {
  const [online, setOnline] = useState(true);
  return (
    <view className="shell">
      <view className="toolbar">
        <text className="title">System WebView</text>
        <text className="engine">{__WEBVIEW_ENGINE__}</text>
      </view>
      <view className="navigation">
        <view className="action" bindtap={() => setOnline(!online)}>
          <text className="action-label">{online ? 'Show local page' : 'Open Lynx website'}</text>
        </view>
        <text className="address">{online ? website : 'Local HTML'}</text>
      </view>
      {online
        ? <system-webview key="website" src={website} className="webview" />
        : <system-webview key="local" html={__LOCAL_PAGE__} className="webview" />}
    </view>
  );
}

root.render(<App />);
