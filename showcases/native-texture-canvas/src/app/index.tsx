import { root } from '@lynx-js/react';
import { App } from './App';

declare const __LYNXTRON_NATIVE_EXTENSION_MANIFEST__: string;

// This inert assignment keeps the signed native-extension declaration inside
// the compiled bundle. Lynxtron Go reads it before creating a preview window;
// the Lynx runtime itself never uses or executes the declaration.
(globalThis as any).__LYNXTRON_NATIVE_EXTENSION_MANIFEST__ =
  __LYNXTRON_NATIVE_EXTENSION_MANIFEST__;

root.render(<App />);
