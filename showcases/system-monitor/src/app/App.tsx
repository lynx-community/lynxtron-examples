import { useState, useEffect, useCallback } from '@lynx-js/react';
import './App.css';

interface SystemInfo {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  platform: string;
  arch: string;
  uptime: number;
}

declare const NativeModules: {
  bridge: {
    call: (method: string, data?: any) => Promise<any>;
    send: (method: string, data?: any) => void;
  };
};

declare const GlobalEventEmitter: {
  addListener: (event: string, callback: (data: any) => void) => void;
  removeListener: (event: string, callback: (data: any) => void) => void;
};

export function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [isLoading, setIsLoading] = useState(true);

  const loadSystemInfo = useCallback(async () => {
    try {
      const info = await NativeModules.bridge.call('getSystemInfo');
      setSystemInfo(info);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading system info:', error);
    }
  }, []);

  const handleSetInterval = useCallback((interval: number) => {
    setRefreshInterval(interval);
    NativeModules.bridge.send('setRefreshInterval', { interval });
  }, []);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  };

  useEffect(() => {
    loadSystemInfo();

    const handleSystemInfoUpdate = (data: SystemInfo) => {
      console.log('systemInfoUpdate', data);
      setSystemInfo(data);
      setIsLoading(false);
    };

    lynx.getJSModule('GlobalEventEmitter').addListener('systemInfoUpdate', handleSystemInfoUpdate);

    return () => {
      lynx.getJSModule('GlobalEventEmitter').removeListener('systemInfoUpdate', handleSystemInfoUpdate);
    };
  }, [loadSystemInfo]);

  if (isLoading) {
    return (
      <view className="container">
        <text className="title">Loading...</text>
      </view>
    );
  }

  return (
    <view className="container">
      <text className="title">System Monitor</text>
      
      <view className="card">
        <text className="card-title">CPU Usage</text>
        <text className="card-value">{systemInfo?.cpuUsage.toFixed(1)}%</text>
        <view className="progress-bar">
          <view 
            className="progress-fill" 
            style={{ width: `${Math.min(systemInfo?.cpuUsage || 0, 100)}%` }}
          />
        </view>
      </view>

      <view className="card">
        <text className="card-title">Memory Usage</text>
        <text className="card-value">{systemInfo?.memoryUsage.toFixed(1)}%</text>
        <view className="progress-bar">
          <view 
            className="progress-fill" 
            style={{ width: `${Math.min(systemInfo?.memoryUsage || 0, 100)}%` }}
          />
        </view>
        <text className="sub-text">
          Total: {systemInfo?.totalMemory.toFixed(2)} GB | Free: {systemInfo?.freeMemory.toFixed(2)} GB
        </text>
      </view>

      <view className="card">
        <text className="card-title">System Info</text>
        <text className="sub-text">Platform: {systemInfo?.platform}</text>
        <text className="sub-text">Architecture: {systemInfo?.arch}</text>
        <text className="sub-text">Uptime: {systemInfo ? formatUptime(systemInfo.uptime) : ''}</text>
      </view>

      <view className="card">
        <text className="card-title">Refresh Interval</text>
        <view className="interval-buttons">
          <view 
            className={`interval-button ${refreshInterval === 500 ? 'active' : ''}`}
            bindtap={() => handleSetInterval(500)}
          >
            <text className="interval-button-text">500ms</text>
          </view>
          <view 
            className={`interval-button ${refreshInterval === 1000 ? 'active' : ''}`}
            bindtap={() => handleSetInterval(1000)}
          >
            <text className="interval-button-text">1s</text>
          </view>
          <view 
            className={`interval-button ${refreshInterval === 2000 ? 'active' : ''}`}
            bindtap={() => handleSetInterval(2000)}
          >
            <text className="interval-button-text">2s</text>
          </view>
          <view 
            className={`interval-button ${refreshInterval === 5000 ? 'active' : ''}`}
            bindtap={() => handleSetInterval(5000)}
          >
            <text className="interval-button-text">5s</text>
          </view>
        </view>
      </view>
    </view>
  );
}
