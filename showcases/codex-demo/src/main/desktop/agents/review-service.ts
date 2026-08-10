import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type {
  ChangedFile,
  ChangedFileStatus,
  DiffLine,
  FileDiff,
  ReviewSnapshot,
} from '../../../shared/agent';

const MAX_DIFF_LINES = 4_000;
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

interface GitResult {
  stdout: string;
  status: number;
}

function textLines(content: string): string[] {
  if (!content) return [];
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function changedFileStatus(code: string): ChangedFileStatus {
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted';
  if (code.includes('R')) return 'renamed';
  if (code === '??' || code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  return 'modified';
}

function parseRangeStart(header: string, marker: '-' | '+'): number {
  const match = header.match(marker === '-' ? /-(\d+)/ : /\+(\d+)/);
  return match ? Number(match[1]) : 0;
}

function parsePatch(patch: string): { lines: DiffLine[]; additions: number; deletions: number; binary: boolean; truncated: boolean } {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let additions = 0;
  let deletions = 0;
  let binary = false;
  let truncated = false;
  let sawHunk = false;

  for (const rawLine of patch.split('\n')) {
    if (rawLine.startsWith('Binary files ') || rawLine.startsWith('GIT binary patch')) {
      binary = true;
      continue;
    }
    if (rawLine.startsWith('@@')) {
      const nextOldLine = parseRangeStart(rawLine, '-');
      const nextNewLine = parseRangeStart(rawLine, '+');
      const hiddenLines = sawHunk ? nextOldLine - oldLine : nextOldLine - 1;
      if (hiddenLines > 0) {
        lines.push({ kind: 'meta', text: `${hiddenLines} unmodified ${hiddenLines === 1 ? 'line' : 'lines'}` });
      }
      oldLine = nextOldLine;
      newLine = nextNewLine;
      sawHunk = true;
      lines.push({ kind: 'hunk', text: rawLine });
    } else if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lines.push({ kind: 'addition', text: rawLine.slice(1), newLine });
      newLine += 1;
      additions += 1;
    } else if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      lines.push({ kind: 'deletion', text: rawLine.slice(1), oldLine });
      oldLine += 1;
      deletions += 1;
    } else if (rawLine.startsWith(' ')) {
      lines.push({ kind: 'context', text: rawLine.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (rawLine.startsWith('\\ No newline')) {
      lines.push({ kind: 'meta', text: rawLine });
    }

    if (lines.length >= MAX_DIFF_LINES) {
      truncated = true;
      break;
    }
  }

  return { lines, additions, deletions, binary, truncated };
}

export class ReviewService {
  constructor(private readonly gitCommand = process.env.GIT_BIN ?? 'git') {}

  async snapshot(cwd: string, requestedPaths?: string[], traceId?: string): Promise<ReviewSnapshot> {
    const totalStartedAt = performance.now();
    const rootStartedAt = performance.now();
    const root = await this.gitRoot(cwd);
    const rootMs = performance.now() - rootStartedAt;
    const statusStartedAt = performance.now();
    const result = await this.run(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
    const statusMs = performance.now() - statusStartedAt;
    const entries = result.stdout.split('\0').filter(Boolean);
    const numstatStartedAt = performance.now();
    const counts = await this.numstat(root);
    const numstatMs = performance.now() - numstatStartedAt;
    const allowedPaths = requestedPaths
      ? new Set(requestedPaths.flatMap((path) => {
        try {
          return [this.safeRelativePath(root, path)];
        } catch {
          return [];
        }
      }))
      : null;
    const mapStartedAt = performance.now();
    const gitFiles = entries.map((entry): ChangedFile => {
      const code = entry.slice(0, 2);
      const path = entry.slice(3);
      const count = counts.get(path);
      let additions = count?.additions ?? 0;
      let deletions = count?.deletions ?? 0;
      if (code === '??') {
        const untracked = this.untrackedCounts(root, path);
        additions = untracked.additions;
        deletions = 0;
      }
      return {
        path,
        status: changedFileStatus(code),
        additions,
        deletions,
        staged: code[0] !== ' ' && code[0] !== '?',
        unstaged: code[1] !== ' ',
        source: 'git',
      };
    }).filter((file) => !allowedPaths || [...allowedPaths].some((allowedPath) => (
      file.path === allowedPath || file.path.startsWith(`${allowedPath.replace(/\/$/, '')}/`)
    )));
    const filesByPath = new Map(gitFiles.map((file) => [file.path, file]));
    if (allowedPaths) {
      for (const path of allowedPaths) {
        if (filesByPath.has(path)) continue;
        const synthetic = this.agentOnlyFile(root, path);
        if (synthetic) filesByPath.set(path, synthetic);
      }
    }
    const files = [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));

    const snapshot = {
      root,
      files,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    };
    this.logPerformance(traceId, 'snapshot', {
      totalMs: performance.now() - totalStartedAt,
      rootMs,
      statusMs,
      numstatMs,
      mapAndUntrackedReadMs: performance.now() - mapStartedAt,
      statusFileCount: entries.length,
      returnedFileCount: files.length,
      requestedPathCount: requestedPaths?.length ?? 0,
    });
    return snapshot;
  }

  async fileDiff(cwd: string, requestedPath: string, knownFile?: ChangedFile, traceId?: string): Promise<FileDiff> {
    const totalStartedAt = performance.now();
    const rootStartedAt = performance.now();
    const root = await this.gitRoot(cwd);
    const rootMs = performance.now() - rootStartedAt;
    const path = this.safeRelativePath(root, requestedPath);
    const metadataStartedAt = performance.now();
    const file = knownFile ?? (await this.snapshot(root, [path], traceId)).files.find((candidate) => candidate.path === path);
    const metadataMs = performance.now() - metadataStartedAt;
    if (!file) throw new Error(`File is not changed: ${path}`);

    if (file.source === 'agent' || (file.status === 'added' && !file.staged)) {
      if (file.status === 'deleted') {
        return { root, path, status: 'deleted', additions: 0, deletions: file.deletions, binary: false, truncated: false, lines: [] };
      }
      const readStartedAt = performance.now();
      const diff = this.untrackedDiff(root, file);
      this.logPerformance(traceId, 'file-diff', {
        path,
        source: 'untracked-file',
        totalMs: performance.now() - totalStartedAt,
        rootMs,
        metadataMs,
        readAndParseMs: performance.now() - readStartedAt,
        lineCount: diff.lines.length,
      });
      return diff;
    }

    const headStartedAt = performance.now();
    const hasHead = (await this.run(root, ['rev-parse', '--verify', 'HEAD'], [0, 128])).status === 0;
    const headMs = performance.now() - headStartedAt;
    const args = hasHead
      ? ['diff', '--no-ext-diff', '--no-color', '--unified=6', 'HEAD', '--', path]
      : ['diff', '--no-ext-diff', '--no-color', '--unified=6', '--cached', '--', path];
    const gitDiffStartedAt = performance.now();
    const patch = (await this.run(root, args, [0, 1])).stdout;
    const gitDiffMs = performance.now() - gitDiffStartedAt;
    const parseStartedAt = performance.now();
    const parsed = parsePatch(patch);
    const parseMs = performance.now() - parseStartedAt;
    const diff = {
      root,
      path,
      status: file.status,
      additions: parsed.additions || file.additions,
      deletions: parsed.deletions || file.deletions,
      binary: parsed.binary,
      truncated: parsed.truncated,
      lines: parsed.lines,
    };
    this.logPerformance(traceId, 'file-diff', {
      path,
      source: 'git-diff',
      totalMs: performance.now() - totalStartedAt,
      rootMs,
      metadataMs,
      headMs,
      gitDiffMs,
      parseMs,
      patchBytes: Buffer.byteLength(patch),
      lineCount: parsed.lines.length,
    });
    return diff;
  }

  private logPerformance(traceId: string | undefined, operation: string, metrics: Record<string, unknown>): void {
    if (!traceId) return;
    const rounded = Object.fromEntries(Object.entries(metrics).map(([key, value]) => [
      key,
      typeof value === 'number' && key.endsWith('Ms') ? Math.round(value * 10) / 10 : value,
    ]));
    console.info('[Codex Demo][diff-perf]', JSON.stringify({ traceId, layer: 'service', operation, ...rounded }));
  }

  private async gitRoot(cwd: string): Promise<string> {
    const result = await this.run(cwd, ['rev-parse', '--show-toplevel']);
    const root = result.stdout.trim();
    if (!root) throw new Error('The selected workspace is not inside a Git repository.');
    return root;
  }

  private safeRelativePath(root: string, requestedPath: string): string {
    const target = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(root, requestedPath);
    const path = relative(root, target);
    if (!path || path === '..' || path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(path)) {
      throw new Error('The requested preview is outside the task repository.');
    }
    return path;
  }

  private async numstat(root: string): Promise<Map<string, { additions: number; deletions: number }>> {
    const hasHead = (await this.run(root, ['rev-parse', '--verify', 'HEAD'], [0, 128])).status === 0;
    const args = hasHead
      ? ['diff', '--numstat', '--no-renames', 'HEAD', '--']
      : ['diff', '--numstat', '--no-renames', '--cached', '--'];
    const result = await this.run(root, args, [0, 1]);
    const counts = new Map<string, { additions: number; deletions: number }>();
    for (const line of result.stdout.split('\n')) {
      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!match) continue;
      counts.set(match[3], {
        additions: match[1] === '-' ? 0 : Number(match[1]),
        deletions: match[2] === '-' ? 0 : Number(match[2]),
      });
    }
    return counts;
  }

  private untrackedCounts(root: string, path: string): { additions: number } {
    const target = resolve(root, path);
    try {
      const stat = statSync(target);
      if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) return { additions: 0 };
      const content = readFileSync(target);
      if (content.includes(0)) return { additions: 0 };
      return { additions: textLines(content.toString('utf8')).length };
    } catch {
      return { additions: 0 };
    }
  }

  private agentOnlyFile(root: string, path: string): ChangedFile | null {
    const target = resolve(root, path);
    try {
      const stat = statSync(target);
      if (!stat.isFile()) return null;
      return {
        path,
        status: 'added',
        additions: this.untrackedCounts(root, path).additions,
        deletions: 0,
        staged: false,
        unstaged: false,
        source: 'agent',
      };
    } catch {
      return {
        path,
        status: 'deleted',
        additions: 0,
        deletions: 0,
        staged: false,
        unstaged: false,
        source: 'agent',
      };
    }
  }

  private untrackedDiff(root: string, file: ChangedFile): FileDiff {
    const target = resolve(root, file.path);
    const stat = statSync(target);
    if (!stat.isFile() || stat.size > MAX_TEXT_FILE_BYTES) {
      return { root, path: file.path, status: file.status, additions: 0, deletions: 0, binary: true, truncated: false, lines: [] };
    }
    const content = readFileSync(target);
    if (content.includes(0)) {
      return { root, path: file.path, status: file.status, additions: 0, deletions: 0, binary: true, truncated: false, lines: [] };
    }
    const sourceLines = textLines(content.toString('utf8'));
    const visible = sourceLines.slice(0, MAX_DIFF_LINES);
    return {
      root,
      path: file.path,
      status: file.status,
      additions: sourceLines.length,
      deletions: 0,
      binary: false,
      truncated: sourceLines.length > visible.length,
      lines: [
        { kind: 'hunk', text: `@@ -0,0 +1,${sourceLines.length} @@` },
        ...visible.map((text, index): DiffLine => ({ kind: 'addition', text, newLine: index + 1 })),
      ],
    };
  }

  private run(cwd: string, args: string[], acceptedStatuses: number[] = [0]): Promise<GitResult> {
    return new Promise((resolveResult, rejectResult) => {
      const child = spawn(this.gitCommand, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', (error) => {
        settled = true;
        rejectResult(error);
      });
      child.once('close', (code) => {
        if (settled) return;
        const status = code ?? -1;
        if (!acceptedStatuses.includes(status)) {
          rejectResult(new Error(stderr.trim() || `git exited with ${status}`));
          return;
        }
        resolveResult({ stdout, status });
      });
    });
  }
}
