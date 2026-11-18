import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

export default createShowcaseConfig({
  lynxDistPath: './dist',
  sourceDefine: {
    __WEBVIEW_ENGINE__: JSON.stringify(process.platform === 'win32' ? 'WebView2' : 'WKWebView'),
  },
});
