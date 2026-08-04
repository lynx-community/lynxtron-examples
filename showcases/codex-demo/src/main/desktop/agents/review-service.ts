import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
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

  snapshot(cwd: string, requestedPaths?: string[]): ReviewSnapshot {
    const root = this.gitRoot(cwd);
    const result = this.run(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
    const entries = result.stdout.split('\0').filter(Boolean);
    const counts = this.numstat(root);
    const allowedPaths = requestedPaths
      ? new Set(requestedPaths.flatMap((path) => {
        try {
          return [this.safeRelativePath(root, path)];
        } catch {
          return [];
        }
      }))
      : null;
    const files = entries.map((entry): ChangedFile => {
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
      };
    }).filter((file) => !allowedPaths || allowedPaths.has(file.path))
      .sort((left, right) => left.path.localeCompare(right.path));

    return {
      root,
      files,
      additions: files.reduce((total, file) => total + file.additions, 0),
      deletions: files.reduce((total, file) => total + file.deletions, 0),
    };
  }

  fileDiff(cwd: string, requestedPath: string): FileDiff {
    const root = this.gitRoot(cwd);
    const path = this.safeRelativePath(root, requestedPath);
    const snapshot = this.snapshot(root);
    const file = snapshot.files.find((candidate) => candidate.path === path);
    if (!file) throw new Error(`File is not changed: ${path}`);

    if (file.status === 'added' && !file.staged) {
      return this.untrackedDiff(root, file);
    }

    const hasHead = this.run(root, ['rev-parse', '--verify', 'HEAD'], [0, 128]).status === 0;
    const args = hasHead
      ? ['diff', '--no-ext-diff', '--no-color', '--unified=6', 'HEAD', '--', path]
      : ['diff', '--no-ext-diff', '--no-color', '--unified=6', '--cached', '--', path];
    const parsed = parsePatch(this.run(root, args, [0, 1]).stdout);
    return {
      root,
      path,
      status: file.status,
      additions: parsed.additions || file.additions,
      deletions: parsed.deletions || file.deletions,
      binary: parsed.binary,
      truncated: parsed.truncated,
      lines: parsed.lines,
    };
  }

  private gitRoot(cwd: string): string {
    const result = this.run(cwd, ['rev-parse', '--show-toplevel']);
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

  private numstat(root: string): Map<string, { additions: number; deletions: number }> {
    const hasHead = this.run(root, ['rev-parse', '--verify', 'HEAD'], [0, 128]).status === 0;
    const args = hasHead
      ? ['diff', '--numstat', '--no-renames', 'HEAD', '--']
      : ['diff', '--numstat', '--no-renames', '--cached', '--'];
    const result = this.run(root, args, [0, 1]);
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
      return { additions: content.toString('utf8').split('\n').length };
    } catch {
      return { additions: 0 };
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
    const sourceLines = content.toString('utf8').split('\n');
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

  private run(cwd: string, args: string[], acceptedStatuses: number[] = [0]): GitResult {
    const result = spawnSync(this.gitCommand, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const status = result.status ?? (result.error ? -1 : 0);
    if (!acceptedStatuses.includes(status)) {
      const detail = result.error?.message ?? (result.stderr.trim() || `git exited with ${status}`);
      throw new Error(detail);
    }
    return { stdout: result.stdout ?? '', status };
  }
}
