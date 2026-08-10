import { useCallback, useRef, useState } from '@lynx-js/react';
import {
  BidirectionalList,
  type BidirectionalListController,
  type EdgeReachedEvent,
  type EdgeSnapshot,
  type ListSnapshot,
  type ListSignalEvent,
  type ListSignalSnapshot,
  type ListTransactionResult,
  type NativeListSignal,
  type NativeListSignalType,
  type NormalizedNativeListSignal,
} from '../../src/app/components/bidirectional-list';
import './ListLab.css';

interface LabItem {
  id: string;
  ordinal: number;
  height: number;
  source: 'initial' | 'prepend' | 'append';
}

interface CallbackLogEntry {
  id: number;
  time: string;
  callback: string;
  detail: string;
}

const HEIGHTS = [72, 116, 88, 152, 96, 128];
const NATIVE_SIGNAL_TYPES: NativeListSignalType[] = [
  'layoutcomplete',
  'scroll',
  'scrolltoupper',
  'scrolltolower',
  'scrollstatechange',
];

function emptyNativeSignalCounts(): Record<NativeListSignalType, number> {
  return {
    layoutcomplete: 0,
    scroll: 0,
    scrolltoupper: 0,
    scrolltolower: 0,
    scrollstatechange: 0,
  };
}

function emptyNativeSignalDetails(): Record<NativeListSignalType, string> {
  return {
    layoutcomplete: '—',
    scroll: '—',
    scrolltoupper: '—',
    scrolltolower: '—',
    scrollstatechange: '—',
  };
}

function makeItem(ordinal: number, source: LabItem['source']): LabItem {
  return { id: `${source}-${ordinal}`, ordinal, height: HEIGHTS[Math.abs(ordinal) % HEIGHTS.length]!, source };
}

function initialItems(count = 8): LabItem[] {
  return Array.from({ length: count }, (_, index) => makeItem(index + 1, 'initial'));
}

function yesNo(value: boolean | undefined): string {
  return value === undefined ? '—' : value ? 'YES' : 'NO';
}

function edgeSummary(snapshot: EdgeSnapshot): string {
  const geometry = snapshot.geometry;
  return `S=${yesNo(snapshot.start.reached)} E=${yesNo(snapshot.end.reached)} · ${geometry.source} · top=${geometry.scrollTop ?? '—'}/${geometry.maxScroll ?? '—'} · endGap=${geometry.distanceToEnd ?? '—'} · cells=${snapshot.firstVisibleIndex}–${snapshot.lastVisibleIndex}`;
}

function px(value: number | undefined): string {
  return value === undefined ? '—' : `${Math.round(value * 10) / 10}`;
}

export function ListLab() {
  const listRef = useRef<BidirectionalListController<LabItem> | null>(null);
  const nextOlder = useRef(0);
  const nextNewer = useRef(9);
  const clockStartRef = useRef(Date.now());
  const nextLogIdRef = useRef(1);
  const lastNativeScrollTopRef = useRef<number | null>(null);
  const [status, setStatus] = useState('Ready — 8 supplied items');
  const [bounces, setBounces] = useState(true);
  const [startEpisodes, setStartEpisodes] = useState(0);
  const [endEpisodes, setEndEpisodes] = useState(0);
  const [apiSnapshot, setApiSnapshot] = useState<EdgeSnapshot | null>(null);
  const [callbackLog, setCallbackLog] = useState<CallbackLogEntry[]>([]);
  const [nativeSignalCounts, setNativeSignalCounts] = useState(emptyNativeSignalCounts);
  const [nativeSignalDetails, setNativeSignalDetails] = useState(emptyNativeSignalDetails);
  const [lastNativeState, setLastNativeState] = useState('—');
  const [normalizedGeometryCount, setNormalizedGeometryCount] = useState(0);
  const [normalizedStateCount, setNormalizedStateCount] = useState(0);
  const [lastNormalizedDetail, setLastNormalizedDetail] = useState('—');
  const [signalSnapshot, setSignalSnapshot] = useState<ListSignalSnapshot | null>(null);
  const [userStartCount, setUserStartCount] = useState(0);
  const [userEndCount, setUserEndCount] = useState(0);
  const [repeatedStartCount, setRepeatedStartCount] = useState(0);
  const [repeatedEndCount, setRepeatedEndCount] = useState(0);
  const [followSettledCount, setFollowSettledCount] = useState(0);

  const logCallback = useCallback((callback: string, detail: string) => {
    const elapsed = Date.now() - clockStartRef.current;
    const entry: CallbackLogEntry = {
      id: nextLogIdRef.current++,
      time: `+${String(elapsed).padStart(5, '0')}ms`,
      callback,
      detail,
    };
    setCallbackLog((current) => [entry, ...current].slice(0, 3));
  }, []);

  const refreshApiSnapshot = useCallback(() => {
    const snapshot = listRef.current?.getSnapshot();
    const reliable = listRef.current?.getSignalSnapshot();
    if (!snapshot) {
      logCallback('getSnapshot()', 'controller not ready');
      return;
    }
    setApiSnapshot(snapshot);
    if (reliable) setSignalSnapshot(reliable);
    logCallback(
      'getSignalSnapshot()',
      reliable
        ? `rev=${reliable.revision} · at=${yesNo(reliable.start.at)}|${yesNo(reliable.end.at)} · near=${yesNo(reliable.start.near)}|${yesNo(reliable.end.near)}`
        : edgeSummary(snapshot),
    );
  }, [logCallback]);

  const record = useCallback((label: string, result: ListTransactionResult) => {
    const snapshot = listRef.current?.getSnapshot();
    const hint = label === 'prepend preserve'
      ? ' · blue items are directly above; scroll up'
      : label === 'append preserve'
        ? ' · green items are directly below; scroll down'
        : '';
    setStatus(`${label}: ${result.outcome}, items ${snapshot?.totalItems ?? '-'}${hint}`);
  }, []);

  const prepend = useCallback(async (follow: boolean) => {
    const first = nextOlder.current - 1;
    nextOlder.current -= 3;
    const batch = [first - 2, first - 1, first].map((value) => makeItem(value, 'prepend'));
    const result = await listRef.current!.prepend(batch, {
      position: follow
        ? { type: 'follow-insert', target: 'first', align: 'start' }
        : { type: 'preserve' },
    });
    record(follow ? 'prepend follow' : 'prepend preserve', result);
  }, [record]);

  const append = useCallback(async (follow: boolean) => {
    const first = nextNewer.current;
    nextNewer.current += 3;
    const batch = [first, first + 1, first + 2].map((value) => makeItem(value, 'append'));
    const result = await listRef.current!.append(batch, {
      position: follow
        ? { type: 'follow-insert', target: 'last', align: 'end' }
        : { type: 'preserve' },
    });
    record(follow ? 'append follow' : 'append preserve', result);
  }, [record]);

  const edgeHandler = useCallback((event: EdgeReachedEvent) => {
    if (event.edge === 'start') setStartEpisodes((value) => value + 1);
    else setEndEpisodes((value) => value + 1);
    setStatus(`${event.edge} reached #${event.episodeId} · ${event.origin}/${event.reason}`);
    logCallback(
      event.edge === 'start' ? 'onStartReached' : 'onEndReached',
      `episode #${event.episodeId} · ${event.origin}/${event.reason} · items=${event.snapshot.totalItems}`,
    );
  }, [logCallback]);

  const edgeStateHandler = useCallback((snapshot: EdgeSnapshot) => {
    setApiSnapshot(listRef.current?.getSnapshot() ?? snapshot);
    logCallback('onEdgeStateChange', edgeSummary(snapshot));
  }, [logCallback]);

  const windowHandler = useCallback((snapshot: ListSnapshot<LabItem>) => {
    logCallback(
      'onWindowChange',
      `items=${snapshot.totalItems} · visible=${snapshot.visibleRange.start}–${snapshot.visibleRange.end}`,
    );
  }, [logCallback]);

  const transactionHandler = useCallback((result: ListTransactionResult) => {
    logCallback(
      'onTransactionSettled',
      `#${result.id} ${result.operation} · ${result.outcome} · anchorError=${Math.round(result.anchorErrorPx ?? 0)}px${result.reason ? ` · ${result.reason}` : ''}`,
    );
  }, [logCallback]);

  const nativeSignalHandler = useCallback((signal: NativeListSignal) => {
    setNativeSignalCounts((current) => ({
      ...current,
      [signal.type]: current[signal.type] + 1,
    }));
    if (signal.type === 'scroll' && signal.scrollTop !== undefined) {
      const previous = lastNativeScrollTopRef.current;
      const atBoundary = signal.scrollTop <= 1
        || signal.maxScroll !== undefined && Math.abs(signal.maxScroll - signal.scrollTop) <= 1;
      if (!atBoundary && previous !== null && Math.abs(previous - signal.scrollTop) < 64) return;
      lastNativeScrollTopRef.current = signal.scrollTop;
    }
    const source = signal.eventSource === 0
      ? 'DIFF'
      : signal.eventSource === 1
        ? 'LAYOUT'
        : signal.eventSource === 2
          ? 'SCROLL'
          : '—';
    const state = signal.state === 1
      ? 'stationary'
      : signal.state === 2
        ? 'dragging'
        : signal.state === 3
          ? 'inertia'
          : signal.state === 4
            ? 'smooth'
            : '—';
    const detail = `src=${source} · state=${state} · top=${px(signal.scrollTop)}/${px(signal.maxScroll)} · cells=${signal.firstCellIndex ?? '—'}–${signal.lastCellIndex ?? '—'} (${signal.cellCount})`;
    setNativeSignalDetails((current) => ({ ...current, [signal.type]: detail }));
    if (signal.type === 'scrollstatechange') setLastNativeState(state);
    logCallback(
      `native.${signal.type}`,
      detail,
    );
  }, [logCallback]);

  const normalizedNativeSignalHandler = useCallback((signal: NormalizedNativeListSignal) => {
    if (signal.type === 'scrollstatechange') {
      setNormalizedStateCount((value) => value + 1);
      setLastNormalizedDetail(`state=${signal.state}`);
      logCallback('normalized.state', `state=${signal.state}`);
      return;
    }
    const source = signal.eventSource === 1 ? 'LAYOUT' : 'SCROLL';
    const geometry = signal.geometry;
    const detail = `via=${signal.trigger}/${source} · top=${px(geometry.scrollTop)}/${px(geometry.maxScroll)} · at=${geometry.atStart ? 'START' : '-'}|${geometry.atEnd ? 'END' : '-'} · cells=${signal.firstCellIndex ?? '—'}–${signal.lastCellIndex ?? '—'}`;
    setNormalizedGeometryCount((value) => value + 1);
    setLastNormalizedDetail(detail);
    logCallback(
      'normalized.geometry',
      detail,
    );
  }, [logCallback]);

  const listSignalHandler = useCallback((signal: ListSignalEvent) => {
    setSignalSnapshot(signal.snapshot);
    if (signal.type === 'viewport') return;
    if (signal.type === 'user-reached-edge') {
      if (signal.edge === 'start') setUserStartCount((value) => value + 1);
      else setUserEndCount((value) => value + 1);
      logCallback(
        'user-reached-edge',
        `${signal.edge} · gesture #${signal.gestureId} · top=${px(signal.snapshot.geometry?.scrollTop)}/${px(signal.snapshot.geometry?.maxScroll)}`,
      );
      return;
    }
    if (signal.type === 'user-repeated-edge') {
      if (signal.edge === 'start') setRepeatedStartCount((value) => value + 1);
      else setRepeatedEndCount((value) => value + 1);
      logCallback(
        'user-repeated-edge',
        `${signal.edge} · gesture #${signal.gestureId} · already at exact edge`,
      );
      return;
    }
    setFollowSettledCount((value) => value + 1);
    logCallback(
      'append-follow-settled',
      `transaction #${signal.transactionId} · last=${signal.snapshot.lastCellIndex ?? '—'} · gap=${px(signal.snapshot.end.distancePx)}`,
    );
  }, [logCallback]);

  const reset = useCallback(async (count: number) => {
    nextOlder.current = 0;
    nextNewer.current = count + 1;
    const result = await listRef.current!.reset(initialItems(count), { position: 'end' });
    record(`reset ${count}`, result);
  }, [record]);

  return (
    <view className="lab-root">
      <view className="lab-header">
        <text className="lab-title">BidirectionalList UI Lab</text>
        <text className="lab-subtitle">real Lynx list · variable heights · all supplied items mounted</text>
      </view>

      <view className="lab-toolbar">
        <view className="lab-button" bindtap={() => void prepend(false)}><text>↑ prepend preserve</text></view>
        <view className="lab-button" bindtap={() => void prepend(true)}><text>↑ prepend follow</text></view>
        <view className="lab-button" bindtap={() => void append(false)}><text>↓ append preserve</text></view>
        <view className="lab-button" bindtap={() => void append(true)}><text>↓ append follow</text></view>
        <view className="lab-button" bindtap={() => void listRef.current?.scrollToKey('initial-6')}><text>jump #6</text></view>
        <view className="lab-button" bindtap={() => void reset(2)}><text>underfill 2</text></view>
        <view className="lab-button" bindtap={() => void reset(12)}><text>reset 12</text></view>
        <view
          className={`lab-button ${bounces ? 'lab-button--active' : ''}`}
          bindtap={() => setBounces((value) => !value)}
        ><text>bounces {bounces ? 'on' : 'off'}</text></view>
      </view>

      <view className="lab-status-row">
        <text className="lab-status" text-maxline="1">{status}</text>
        <text className="lab-counters">reached S{userStartCount}/E{userEndCount} · repeated S{repeatedStartCount}/E{repeatedEndCount} · follow ✓{followSettledCount}</text>
      </view>

      <view className="lab-debug-panel">
        <view className="lab-api-panel">
          <view className="lab-debug-heading-row">
            <text className="lab-debug-heading">reliable base signal API</text>
            <view className="lab-mini-button" bindtap={refreshApiSnapshot}><text>read API</text></view>
          </view>
          <view className="lab-edge-cards">
            {(['start', 'end'] as const).map((edge) => {
              const state = signalSnapshot?.[edge];
              return (
                <view className="lab-edge-card" key={edge}>
                  <text className="lab-edge-name">{edge.toUpperCase()}</text>
                  <text className={`lab-edge-value ${state?.at ? 'lab-edge-value--yes' : ''}`}>at {yesNo(state?.at)}</text>
                  <text className={`lab-edge-value ${state?.near ? 'lab-edge-value--yes' : ''}`}>near {yesNo(state?.near)}</text>
                  <text className="lab-edge-meta">distance {px(state?.distancePx)}px</text>
                </view>
              );
            })}
          </view>
          <view className="lab-geometry-debug">
            <text className="lab-geometry-line" text-maxline="1">
              rev {signalSnapshot?.revision ?? '—'} · motion {signalSnapshot?.motion ?? '—'} · gesture {signalSnapshot?.userGestureId ?? '—'}
            </text>
            <text className="lab-geometry-line" text-maxline="1">
              scroll {px(signalSnapshot?.geometry?.scrollTop)} / max {px(signalSnapshot?.geometry?.maxScroll)} · cells {signalSnapshot?.firstCellIndex ?? '—'}–{signalSnapshot?.lastCellIndex ?? '—'} · supplied {apiSnapshot?.totalItems ?? '—'}
            </text>
          </view>
        </view>

        <view className="lab-callback-panel">
          <view className="lab-debug-heading-row">
            <text className="lab-debug-heading">callback + native signals · newest first</text>
            <view
              className="lab-mini-button"
              bindtap={() => {
                setCallbackLog([]);
                setNativeSignalCounts(emptyNativeSignalCounts());
                setNativeSignalDetails(emptyNativeSignalDetails());
                setLastNativeState('—');
                setNormalizedGeometryCount(0);
                setNormalizedStateCount(0);
                setLastNormalizedDetail('—');
                setUserStartCount(0);
                setUserEndCount(0);
                setRepeatedStartCount(0);
                setRepeatedEndCount(0);
                setFollowSettledCount(0);
              }}
            ><text>clear</text></view>
          </view>
          <view className="lab-native-summary">
            {NATIVE_SIGNAL_TYPES.map((type) => (
              <text className="lab-native-count" key={type}>{type.replace('scroll', 's.')} {nativeSignalCounts[type]}</text>
            ))}
            <text className="lab-native-state">last {lastNativeState}</text>
          </view>
          <view className="lab-native-last-list">
            {NATIVE_SIGNAL_TYPES.map((type) => (
              <view className="lab-native-last-row" key={type}>
                <text className="lab-native-last-type">{type}</text>
                <text className="lab-native-last-detail" text-maxline="1">{nativeSignalDetails[type]}</text>
              </view>
            ))}
            <view className="lab-native-last-row">
              <text className="lab-native-last-type">normalized g{normalizedGeometryCount}/s{normalizedStateCount}</text>
              <text className="lab-native-last-detail" text-maxline="1">{lastNormalizedDetail}</text>
            </view>
          </view>
          <view className="lab-log-list">
            {callbackLog.length === 0
              ? <text className="lab-log-empty">waiting for callbacks…</text>
              : callbackLog.map((entry) => (
                <view className="lab-log-row" key={entry.id}>
                  <text className="lab-log-time">{entry.time}</text>
                  <text className="lab-log-callback">{entry.callback}</text>
                  <text className="lab-log-detail" text-maxline="1">{entry.detail}</text>
                </view>
              ))}
          </view>
        </view>
      </view>

      <view className="lab-list-frame">
        <BidirectionalList
          ref={listRef}
          id="bidirectional-list-lab"
          initialItems={initialItems()}
          getItemKey={(item) => item.id}
          initialPosition="end"
          bounces={bounces}
          edgeThreshold={2}
          signalNearThresholdPx={120}
          estimateItemSize={(item) => item.height}
          onEdgeStateChange={edgeStateHandler}
          onStartReached={edgeHandler}
          onEndReached={edgeHandler}
          onWindowChange={windowHandler}
          onTransactionSettled={transactionHandler}
          diagnostics={{
            onNativeSignal: nativeSignalHandler,
            onNormalizedNativeSignal: normalizedNativeSignalHandler,
          }}
          onListSignal={listSignalHandler}
          renderItem={(item, index) => (
            <view
              className={`lab-item lab-item--${item.source}`}
              style={{ height: `${item.height}px` }}
            >
              <view className="lab-item-index"><text>{index}</text></view>
              <view className="lab-item-copy">
                <text className="lab-item-title">{item.id}</text>
                <text className="lab-item-meta">height {item.height}px · {item.source}</text>
              </view>
            </view>
          )}
        />
      </view>
    </view>
  );
}
