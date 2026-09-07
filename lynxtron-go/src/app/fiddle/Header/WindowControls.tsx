import { useEffect, useState } from '@lynx-js/react';
import { Button } from '../bp';
import { Tooltip } from '../bp/Tooltip';
import './WindowControls.css';

function request(action: string, reply: (value: any) => void = () => {}) {
  // @ts-ignore — the desktop bridge is injected by Lynxtron.
  NativeModules.bridge.call('windowControl', { action }, reply);
}

export function WindowControls(props: { standalone?: boolean }) {
  const [state, setState] = useState({ enabled: false, maximized: false });
  useEffect(() => {
    const update = (value: any) => {
      try {
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        if (typeof data?.enabled === 'boolean') setState(data);
      } catch (_) {}
    };
    let emitter: any;
    try {
      // @ts-ignore
      emitter = lynx.getJSModule('GlobalEventEmitter');
      emitter?.addListener('go:windowState', update);
      request('state', update);
    } catch (_) {}
    return () => { emitter?.removeListener('go:windowState', update); };
  }, []);
  if (!state.enabled) return null;
  return (
    <view className={props.standalone ? 'go-window-header' : 'go-window-controls'}>
      {props.standalone ? <text className="go-window-title">Lynxtron Go</text> : null}
      <Tooltip content="Application menu" align="end">
        <Button className="go-window-button" minimal onClick={() => request('menu')}>
          <view className="go-window-menu"><view /><view /><view /></view>
        </Button>
      </Tooltip>
      <Tooltip content="Minimize" align="end">
        <Button className="go-window-button" minimal onClick={() => request('minimize')}>
          <view className="go-window-minimize" />
        </Button>
      </Tooltip>
      <Tooltip content={state.maximized ? 'Restore' : 'Maximize'} align="end">
        <Button className="go-window-button" minimal onClick={() => request('toggleMaximize', setState)}>
          <view className={state.maximized ? 'go-window-restore' : 'go-window-maximize'} />
        </Button>
      </Tooltip>
      <Tooltip content="Close" align="end">
        <Button className="go-window-button go-window-close" minimal icon="cross" onClick={() => request('close')} />
      </Tooltip>
    </view>
  );
}
