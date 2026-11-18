import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

const require = createRequire(import.meta.url);
const tokens = readFileSync(require.resolve('@lynxtron-examples/config/tokens.css'), 'utf8');
const page = readFileSync(new URL('./src/app/page.html', import.meta.url), 'utf8');

export default createShowcaseConfig({
  lynxDistPath: './dist',
  sourceDefine: {
    __WEBVIEW_ENGINE__: JSON.stringify(process.platform === 'win32' ? 'WebView2' : 'WKWebView'),
    __LOCAL_PAGE__: JSON.stringify(page.replace('/* showcase tokens */', tokens)),
  },
});
