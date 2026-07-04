import type { Language } from './syntax';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  name: string;
  fullPath: string;
  savedContent: string;
  currentText: string;
  isDirty: boolean;
  language: Language;
}

export interface TreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const HIDDEN = new Set([
  '.git', 'node_modules', '.DS_Store', 'dist', 'build', '__pycache__',
  '.yarn', 'out', 'output', '.next', 'coverage',
]);

export const EDITOR_ID = 'main-editor';

// File type icons by extension
const FILE_ICONS: Record<string, string> = {
  ts: '\u{1F4D8}', tsx: '\u269B\uFE0F', js: '\u{1F4D9}', jsx: '\u269B\uFE0F',
  css: '\u{1F3A8}', json: '\u{1F4CB}', md: '\u{1F4DD}', txt: '\u{1F4C4}',
  cc: '\u2699\uFE0F', cpp: '\u2699\uFE0F', c: '\u2699\uFE0F', h: '\u2699\uFE0F', mm: '\u{1F34E}',
  py: '\u{1F40D}', sh: '\u{1F5A5}\uFE0F', yaml: '\u{1F4D0}', yml: '\u{1F4D0}',
  png: '\u{1F5BC}\uFE0F', jpg: '\u{1F5BC}\uFE0F', svg: '\u{1F5BC}\uFE0F', gif: '\u{1F5BC}\uFE0F',
};

export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || '\u{1F4C4}';
}

// ── Native bridge helpers ──────────────────────────────────────────────────

export function getExposed() {
  if (typeof NativeModules === 'undefined') return null;
  // @ts-ignore
  return NativeModules.nodejs?.exposed ?? null;
}

/**
 * The foundation bridge (config/fs/exec). The preload refactor spread it onto
 * the exposed root — `exposed.foundation` no longer exists, which made every
 * `getExposed()?.foundation?.…` call a silent no-op. Accept both shapes.
 */
export function foundationApi() {
  const exposed = getExposed();
  return exposed?.foundation ?? exposed ?? null;
}

export function scintillaApi() {
  // @ts-ignore
  return NativeModules.ScintillaExtensionModule;
}

export function showcaseApi() {
  return getExposed()?.showcase;
}

export function exampleArtifactApi() {
  return getExposed()?.exampleArtifact;
}

// ── Baked-in showcase registry (injected at build time) ──────────────────

export interface ShowcaseEntry {
  name: string;
  description: string;
  tags: string[];
  targets?: ShowcaseTarget[];
  url: string;  // preview: file:///path/to.tgz, remote: https://github.com/.../tree/...
  path?: string;
  thumbnail?: string | null;
}

export type ShowcaseTarget = 'desktop' | 'web';

declare const __SHOWCASE_REGISTRY__: ShowcaseEntry[];
declare const __SHOWCASE_PREVIEW__: boolean;
declare const __SHOWCASE_LOCAL_WORKSPACE__: boolean;

export const SHOWCASE_REGISTRY: ShowcaseEntry[] =
  typeof __SHOWCASE_REGISTRY__ !== 'undefined' ? __SHOWCASE_REGISTRY__ : [];
export const SHOWCASE_PREVIEW: boolean =
  typeof __SHOWCASE_PREVIEW__ !== 'undefined' ? __SHOWCASE_PREVIEW__ : false;
export const SHOWCASE_LOCAL_WORKSPACE: boolean =
  typeof __SHOWCASE_LOCAL_WORKSPACE__ !== 'undefined' ? __SHOWCASE_LOCAL_WORKSPACE__ : false;

// ── Output log ────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'error' | 'warn';

export interface OutputEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const outputLog: OutputEntry[] = [];
let outputVersion = 0;
const OUTPUT_MAX = 500;

export function appendOutput(level: LogLevel, message: string): void {
  outputLog.push({
    timestamp: new Date().toISOString().slice(11, 19),
    level,
    message,
  });
  if (outputLog.length > OUTPUT_MAX) outputLog.splice(0, outputLog.length - OUTPUT_MAX);
  outputVersion++;
}

export function getOutputLog(): OutputEntry[] {
  return outputLog;
}

export function getOutputVersion(): number {
  return outputVersion;
}

// ── Shared process-output stream ─────────────────────────────────────────
// Showcase spawns (run / build / web serve) write into ONE preload buffer
// (readProcessOutput DRAINS it), so exactly one poller may exist. Both the
// Fiddle console and the gallery console render from this shared log — the
// gallery used to run things while the hidden Fiddle silently ate the output.

export interface ProcessLogEntry {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'command';
  message: string;
  /** Monotonic id assigned at push — a stable render key that survives the
      front-trim (array indices shift; seq never does). */
  seq?: number;
}

const processLog: ProcessLogEntry[] = [];
let processLogSeq = 0;
let processPollStarted = false;
const PROCESS_LOG_MAX = 500;
// Entries trimmed off the front so far — lets cursor-based readers compute
// absolute positions across trims.
let processLogDropped = 0;

// In-memory consumers (consoles, mirrors) subscribe instead of re-polling
// the array they already share a JS context with — two 250ms consumer polls
// used to sit on top of the one legitimate drain poll below.
type ProcessLogListener = () => void;
const processLogListeners = new Set<ProcessLogListener>();

function notifyProcessLog(): void {
  for (const l of processLogListeners) {
    try { l(); } catch (_) { /* a broken consumer must not stop the rest */ }
  }
}

/** Synchronous notification on every append/clear. Returns unsubscribe. */
export function subscribeProcessLog(listener: ProcessLogListener): () => void {
  processLogListeners.add(listener);
  return () => { processLogListeners.delete(listener); };
}

function pushProcessEntries(entries: ProcessLogEntry[]): void {
  for (const e of entries) {
    e.seq = processLogSeq++;
    processLog.push(e);
  }
  if (processLog.length > PROCESS_LOG_MAX) {
    const excess = processLog.length - PROCESS_LOG_MAX;
    processLog.splice(0, excess);
    processLogDropped += excess;
  }
  notifyProcessLog();
}

export function ensureProcessLogPolling(): void {
  if (processPollStarted) return;
  processPollStarted = true;
  setInterval(() => {
    try {
      const raw: ProcessLogEntry[] = showcaseApi()?.readProcessOutput?.() ?? [];
      if (raw.length > 0) pushProcessEntries(raw);
    } catch (_) { /* preload not attached during boot */ }
  }, 250);
}

/** App-level flow steps (preparing / launching / pid) mirrored into the same
    stream so a run reads as one continuous story in either console. */
export function appendProcessLine(stream: ProcessLogEntry['stream'], message: string): void {
  pushProcessEntries([{
    timestamp: new Date().toISOString().slice(11, 19),
    stream,
    message,
  }]);
}

/** Fiddle status lines ([Fiddle] …, [DevCmd] …) belong in the SHARED console.
    appendOutput writes only the legacy IDE's outputLog, which the Fiddle
    console never renders — status lines sent there are invisible in the
    Fiddle UI. Deliberately does NOT also write outputLog: the mirror effect
    in App.tsx copies every processLog line into outputLog already (writing
    both would duplicate there; appendOutput→processLog would loop). */
export function appendFiddleOutput(level: LogLevel, message: string): void {
  appendProcessLine(level === 'error' ? 'stderr' : 'command', message);
}

export function getProcessLog(): ProcessLogEntry[] {
  return processLog;
}

export function clearProcessLog(): void {
  processLogDropped += processLog.length;
  processLog.length = 0;
  notifyProcessLog();
}

/** Cursor read for secondary consumers (legacy IDE output mirror): returns
    entries appended since `cursor` and the new cursor. Never drains. */
export function readProcessLogSince(cursor: number): { entries: ProcessLogEntry[]; cursor: number } {
  const start = Math.max(0, cursor - processLogDropped);
  return {
    entries: processLog.slice(start),
    cursor: processLogDropped + processLog.length,
  };
}

// ── Logging ────────────────────────────────────────────────────────────────

export function log(msg: string) {
  try {
    getExposed()?.utils?.log(msg);
  } catch (_) {
    /* ignore */
  }
}
