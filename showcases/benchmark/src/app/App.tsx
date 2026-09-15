import { useState, useEffect, useCallback } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import './App.css';
import { MetricCard } from './components/MetricCard';

interface MemoryUsage {
  primary: number;
  secondary: number;
  primaryLabel: string;
  secondaryLabel: string;
  heapUsed: number;
  heapTotal: number;
}

interface SecondWindowDelta {
  primary: number;
  secondary: number;
  primaryLabel: string;
  secondaryLabel: string;
}

interface PlatformInfo {
  platform: string;
  arch: string;
  version: string;
}

function getBenchmarkApi() {
  // @ts-ignore — NativeModules is a Lynx global
  return NativeModules.nodejs?.exposed?.benchmark ?? null;
}

function formatMB(bytes: number): string {
  if (bytes === 0) return '—';
  return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
}

function formatMS(ms: number): string {
  if (ms === 0) return '—';
  return ms + 'ms';
}

function formatMemoryPair(primary: number, secondary: number): string {
  return `${formatMB(primary)} / ${formatMB(secondary)}`;
}

function formatMemoryDeltaPair(primary: number, secondary: number): string {
  return `+${formatMB(primary)} / +${formatMB(secondary)}`;
}

function formatMemoryLabels(primaryLabel: string, secondaryLabel: string): string {
  return `${primaryLabel} / ${secondaryLabel}`;
}

function getDefaultMemoryLabels(platform: PlatformInfo | null): Pick<
  MemoryUsage,
  'primaryLabel' | 'secondaryLabel'
> {
  if (platform?.platform === 'win32') {
    return {
      primaryLabel: 'Working Set Private',
      secondaryLabel: 'Commit',
    };
  }
  if (platform?.platform === 'darwin') {
    return {
      primaryLabel: 'Footprint',
      secondaryLabel: 'RSS',
    };
  }
  return {
    primaryLabel: 'RSS',
    secondaryLabel: 'Heap Total',
  };
}

function startupColor(ms: number): string {
  if (ms < 200) return '#3dd68c';
  if (ms < 500) return '#f5f8fa';
  return '#df3434';
}

export function App() {
  const [releaseSize, setReleaseSize] = useState<{ bytes: number; tag: string } | null>(null);
  const [releaseSizeStatus, setReleaseSizeStatus] = useState('Loading latest release metadata…');
  const [startupTime, setStartupTime] = useState<number>(0);
  const [memory, setMemory] = useState<MemoryUsage | null>(null);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [secondWindowDelta, setSecondWindowDelta] = useState<SecondWindowDelta | null>(null);
  const [secondWindowOpen, setSecondWindowOpen] = useState(false);
  const [secondWindowBusy, setSecondWindowBusy] = useState(false);
  const [secondWindowStatus, setSecondWindowStatus] = useState(
    'Open one extra LynxWindow and measure the same-process memory delta.',
  );

  const fallbackMemoryLabels = getDefaultMemoryLabels(platform);
  const memoryPrimaryLabel = memory?.primaryLabel ?? fallbackMemoryLabels.primaryLabel;
  const memorySecondaryLabel = memory?.secondaryLabel ?? fallbackMemoryLabels.secondaryLabel;
  const memoryLabelText = formatMemoryLabels(memoryPrimaryLabel, memorySecondaryLabel);

  const refreshStartupTime = useCallback(() => {
    // The host caches process-start -> synchronous loadFile completion;
    // bridge latency is not part of this benchmark's Lynx FCP metric.
    // @ts-ignore — bridge is a Lynx global
    NativeModules.bridge.call('getStartupTime', {}, (ms: number | null) => {
      if (typeof ms === 'number' && ms >= 0) setStartupTime(ms);
    });
  }, []);

  const refreshMemory = useCallback(() => {
    try {
      const api = getBenchmarkApi();
      if (api) {
        const mem: MemoryUsage = api.getMemoryUsage();
        setMemory(mem);
      }
    } catch (_) {
      // ignore
    }
  }, []);

  const refreshSecondWindowDelta = useCallback(() => {
    try {
      // @ts-ignore — bridge is a Lynx global
      NativeModules.bridge.call('getSecondWindowDelta', {}, (result: any) => {
        setSecondWindowOpen(Boolean(result?.isOpen));
        setSecondWindowDelta(result?.delta ?? null);
        if (!result?.isOpen) {
          setSecondWindowStatus('Open one extra LynxWindow and measure the same-process memory delta.');
        } else if (result?.delta) {
          setSecondWindowStatus(
            `Second window is open. Delta uses ${formatMemoryLabels(
              result.delta.primaryLabel,
              result.delta.secondaryLabel,
            )}.`,
          );
        } else {
          setSecondWindowStatus('Second window is open. Waiting for delta measurement...');
        }
      });
    } catch (_) {
      // ignore
    }
  }, []);

  const openSecondWindow = useCallback(() => {
    if (secondWindowBusy) return;
    setSecondWindowBusy(true);
    setSecondWindowStatus(`Opening second window and measuring ${memoryLabelText} delta...`);
    try {
      // @ts-ignore — bridge is a Lynx global
      NativeModules.bridge.call('openSecondWindowAndMeasure', {}, (result: any) => {
        setSecondWindowBusy(false);
        setSecondWindowOpen(Boolean(result?.ok));
        setSecondWindowDelta(result?.delta ?? null);
        if (result?.delta) {
          setSecondWindowStatus(
            result?.alreadyOpen
              ? 'Second window was already open. Showing the current measured delta.'
              : `Second window is open. Delta uses ${formatMemoryLabels(
                  result.delta.primaryLabel,
                  result.delta.secondaryLabel,
                )}.`,
          );
        } else {
          setSecondWindowStatus('Second window opened, but delta is not available yet.');
        }
      });
    } catch (_) {
      setSecondWindowBusy(false);
      setSecondWindowStatus('Failed to open the second window.');
    }
  }, [memoryLabelText, secondWindowBusy]);

  useEffect(() => {
    try {
      const api = getBenchmarkApi();
      if (!api) return;

      // Load platform info
      const info: PlatformInfo = api.getPlatformInfo();
      setPlatform(info);
    } catch (_) {
      // ignore
    }

    refreshStartupTime();
    refreshSecondWindowDelta();

    // Read cached host metrics without collecting memory during startup.
    const interval = setInterval(() => {
      refreshStartupTime();
      refreshSecondWindowDelta();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshSecondWindowDelta, refreshStartupTime]);

  useEffect(() => {
    if (startupTime <= 0) return;
    // Memory collection can synchronously invoke OS tools. Keep it out of startup.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      refreshMemory();
      interval = setInterval(refreshMemory, 2000);
    }, 1000);
    return () => {
      clearTimeout(timeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [startupTime, refreshMemory]);

  useEffect(() => {
    if (startupTime <= 0) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setReleaseSizeStatus('GitHub metadata request timed out');
    }, 15000);
    const start = setTimeout(() => {
      try {
        // @ts-ignore — bridge is a Lynx global
        NativeModules.bridge.call('getReleaseSize', {}, (result: any) => {
          if (!active) return;
          clearTimeout(timeout);
          if (result?.ok && typeof result.bytes === 'number' && result.bytes > 0) {
            setReleaseSize(result);
            setReleaseSizeStatus(`Latest ${result.tag} · release ZIP`);
          } else {
            setReleaseSizeStatus(result?.error || 'Release size unavailable');
          }
        });
      } catch (_) {
        clearTimeout(timeout);
        if (active) setReleaseSizeStatus('Release size unavailable');
      }
    }, 1000);
    return () => { active = false; clearTimeout(start); clearTimeout(timeout); };
  }, [startupTime]);

  const memHeapInfo =
    memory != null
      ? `Heap ${formatMB(memory.heapUsed)} / ${formatMB(memory.heapTotal)}`
      : undefined;
  const memValue =
    memory != null
      ? formatMemoryPair(memory.primary, memory.secondary)
      : '—';
  const memorySubtitle = memory != null ? memoryLabelText : 'Loading memory info';
  const secondWindowValue =
    secondWindowDelta != null
      ? formatMemoryDeltaPair(secondWindowDelta.primary, secondWindowDelta.secondary)
      : '—';
  const secondWindowSubtitle =
    secondWindowDelta != null
      ? `Δ ${formatMemoryLabels(secondWindowDelta.primaryLabel, secondWindowDelta.secondaryLabel)}`
      : `Δ ${memoryLabelText}`;

  const footerText =
    platform != null
      ? `Lynxtron v${platform.version} · ${platform.platform} ${platform.arch}`
      : 'Lynxtron · Loading…';

  return (
    <view className="root">
      <scroll-view scroll-y className="scroll-content">
        <text className="page-title">Runtime benchmark</text>
        <text className="page-copy">
          Minimal runtime baseline for a Lynxtron app: startup latency, physical
          memory counters, JS heap, and the latest release runtime ZIP download size.
          ZIP size is compressed runtime only, not installed app size; devtool,
          debug symbols and CEF are excluded. No local disk scanning.
        </text>

        <text className="section-label">Second window probe</text>

        <view className="action-row" style={{ flexDirection: 'row' }}>
          <view
            className={secondWindowBusy ? 'action-chip action-chip-busy' : 'action-chip'}
            bindtap={openSecondWindow}
          >
            <text className={secondWindowBusy ? 'action-chip-text action-chip-text-busy' : 'action-chip-text'}>
              {secondWindowBusy ? 'Measuring…' : secondWindowOpen ? 'Show second window delta' : 'Open second window'}
            </text>
          </view>
          <text className="action-note">{secondWindowStatus}</text>
        </view>

        <text className="section-label">Live metrics</text>

        <view className="cards-row" style={{ flexDirection: 'row' }}>
          <MetricCard
            title="Runtime ZIP"
            value={releaseSize ? `${(releaseSize.bytes / (1024 * 1024)).toFixed(1)} MiB` : '—'}
            subtitle={releaseSizeStatus}
          />
          <MetricCard
            title="Lynx FCP"
            value={startupTime > 0 ? formatMS(startupTime) : '—'}
            subtitle="Process start to loadFile completion"
            accentColor={startupTime > 0 ? startupColor(startupTime) : '#f5f8fa'}
          />
          <MetricCard
            title="Memory"
            value={memValue}
            subtitle={memorySubtitle}
            extraInfo={memHeapInfo}
          />
          <MetricCard
            title="Platform"
            value={platform != null ? `${platform.platform}` : '—'}
            subtitle={platform != null ? `${platform.arch} · v${platform.version}` : 'Loading runtime info'}
          />
          <MetricCard
            title="Second window"
            value={secondWindowValue}
            subtitle={secondWindowSubtitle}
            extraInfo="Measured after one extra LynxWindow finishes loading."
            accentColor={secondWindowDelta != null ? '#48aff0' : '#f5f8fa'}
          />
        </view>

        <text className="footer">{footerText}</text>
      </scroll-view>
    </view>
  );
}
