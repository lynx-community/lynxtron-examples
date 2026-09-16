// Adapted from lynx-family/lynxtron browser-demo for the showcases toolchain.
import { root } from '@lynx-js/react';

import { App } from './App';

root.render(<App />);

// @ts-ignore
if (import.meta.webpackHot) {
  // @ts-ignore
  import.meta.webpackHot.accept();
}
