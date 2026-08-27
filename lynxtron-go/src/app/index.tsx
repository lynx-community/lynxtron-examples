import { root, useEffect, useState } from '@lynx-js/react';

import { App } from './App';

/**
 * Wrap <App/> in a key that flips when the host asks for a reload. LynxWindow
 * has no reload() and loadFile-ing the same bundle is a no-op, so we simulate
 * "restart the renderer" by unmounting and remounting the whole component
 * tree here. Cold-start restoreLastSession then picks up the session that the
 * persistNow handshake just wrote, giving us Electron Fiddle's semantics
 * (shell restart, user content preserved) without touching the host process.
 */
function AppRoot() {
  const [gen, setGen] = useState(0);
  useEffect(() => {
    // @ts-ignore
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const bump = () => setGen((g) => g + 1);
    emitter.addListener('fiddle:remount', bump);
    return () => { try { emitter.removeListener('fiddle:remount', bump); } catch (_) {} };
  }, []);
  return <App key={gen} />;
}

root.render(<AppRoot />);

// @ts-ignore
if (import.meta.webpackHot) {
  // @ts-ignore
  import.meta.webpackHot.accept();
}
