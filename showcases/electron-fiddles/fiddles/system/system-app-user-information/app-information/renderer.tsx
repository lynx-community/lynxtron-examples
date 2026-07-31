import { root, useCallback, useEffect, useState } from '@lynx-js/react';
import { DemoPage, Section, KV, ActionButton, ResultText } from '@lynxtron-examples/fiddle-kit/ui/Demo';
import { bridgeCall } from '@lynxtron-examples/fiddle-kit/bridge';

// Port of electron docs/fiddles system/app-information. Upstream demos
// app.getAppPath(); this Lynxtron port also reads app.getName / getVersion and
// app.getPath(...) for common app + user paths, fetched from main over the
// Lynxtron bridge (Electron's ipcRenderer.invoke / ipcMain.handle pattern).
type AppInfo = {
  name: string;
  version: string;
  appPath: string;
  paths: Array<{ key: string; value: string }>;
};

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  const load = useCallback(async () => {
    const result = await bridgeCall<AppInfo>('app:getInfo');
    setInfo(result);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DemoPage title="App Information" supports="Supports: Win, macOS, Linux · Process: Main"
      apis={['app.getAppPath', 'app.getName', 'app.getPath', 'app.getVersion']}>
      <Section heading="Application">
        <ActionButton label="Refresh" onTap={load} />
        {info ? (
          <view>
            <KV k="name" v={info.name} />
            <KV k="version" v={info.version} />
            <KV k="appPath" v={info.appPath} />
          </view>
        ) : (
          <ResultText>Loading…</ResultText>
        )}
      </Section>

      {info ? (
        <Section heading="Common paths (app.getPath)">
          {info.paths.map((p) => (
            <KV k={p.key} v={p.value} key={p.key} />
          ))}
        </Section>
      ) : null}
    </DemoPage>
  );
}

root.render(<App />);
