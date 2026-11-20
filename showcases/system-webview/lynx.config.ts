import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

// `build:native-ui` keeps the website example layout (`dist/main.lynx.bundle`).
// `build` targets the showcase layout, which `assemble-desktop.cjs` turns into
// `dist/desktop` next to the desktop entry.
const showcaseLayout = process.env.SHOWCASE_LAYOUT === '1';

export default createShowcaseConfig({
  lynxDistPath: showcaseLayout ? './output/bundle/lynx' : './dist',
  sourceDefine: {
    __WEBVIEW_ENGINE__: JSON.stringify(process.platform === 'win32' ? 'WebView2' : 'WKWebView'),
  },
});
