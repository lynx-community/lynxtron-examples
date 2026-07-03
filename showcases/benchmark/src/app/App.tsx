import { useState, useEffect, useCallback } from '@lynx-js/react';
import './App.css';
import { MetricCard } from './components/MetricCard';
import { SizeBreakdown } from './components/SizeBreakdown';

interface AppSize {
  runtime: number;
  business: number;
  extensions: number;
  total: number;
}

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
  if (ms < 200) return '#22c55e';
  if (ms < 500) return '#eab308';
  return '#ef4444';
}

export function App() {
  const [appSize, setAppSize] = useState<AppSize | null>(null);
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

      // Load app size
      const size: AppSize = api.getAppSize();
      setAppSize(size);

      // Load startup time
      const ms: number = api.getStartupTime();
      setStartupTime(ms);

      // Load platform info
      const info: PlatformInfo = api.getPlatformInfo();
      setPlatform(info);
    } catch (_) {
      // ignore
    }

    // Initial memory read
    refreshMemory();
    refreshSecondWindowDelta();

    // Poll memory every 2 seconds
    const interval = setInterval(() => {
      refreshMemory();
      refreshSecondWindowDelta();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshMemory, refreshSecondWindowDelta]);

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
        <text className="page-title">LIGHT-WEIGHT AND FAST</text>
        <text className="page-heading">LYNXTRON BENCHMARK</text>
        <text className="page-copy">
          Minimal runtime baseline for a Lynxtron app: package size, startup latency, physical
          memory counters, and JS heap without extra stress widgets layered on top.
        </text>

        <view className="action-row" style={{ flexDirection: 'row' }}>
          <view
            className={secondWindowBusy ? 'action-chip action-chip-disabled' : 'action-chip'}
            bindtap={openSecondWindow}
          >
            <text className="action-chip-text">
              {secondWindowBusy ? 'Measuring…' : secondWindowOpen ? 'Show 2nd Window Delta' : 'Open 2nd Window'}
            </text>
          </view>
          <text className="action-note">{secondWindowStatus}</text>
        </view>

        <view className="cards-row" style={{ flexDirection: 'row' }}>
          <MetricCard
            title="APP SIZE"
            value={appSize != null ? formatMB(appSize.total) : '—'}
            subtitle="Runtime"
          />
          <MetricCard
            title="STARTUP"
            value={startupTime > 0 ? formatMS(startupTime) : '—'}
            subtitle="Preload → First Call"
            accentColor={startupTime > 0 ? startupColor(startupTime) : '#ffffff'}
          />
          <MetricCard
            title="MEMORY"
            value={memValue}
            subtitle={memorySubtitle}
            extraInfo={memHeapInfo}
          />
          <MetricCard
            title="PLATFORM"
            value={platform != null ? `${platform.platform}` : '—'}
            subtitle={platform != null ? `${platform.arch} · v${platform.version}` : 'Loading runtime info'}
          />
          <MetricCard
            title="SECOND WINDOW"
            value={secondWindowValue}
            subtitle={secondWindowSubtitle}
            extraInfo="Measured after one extra LynxWindow finishes loading."
            accentColor={secondWindowDelta != null ? '#f97316' : '#ffffff'}
          />
        </view>

        {appSize != null ? (
          <SizeBreakdown
            runtime={appSize.runtime}
            business={appSize.business}
            extensions={appSize.extensions}
          />
        ) : null}

        <text className="footer">{footerText}</text>
      </scroll-view>
    </view>
  );
}
