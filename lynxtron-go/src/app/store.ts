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
  targets: ShowcaseTarget[];
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

// ── Logging ────────────────────────────────────────────────────────────────

export function log(msg: string) {
  try {
    getExposed()?.utils?.log(msg);
  } catch (_) {
    /* ignore */
  }
}
