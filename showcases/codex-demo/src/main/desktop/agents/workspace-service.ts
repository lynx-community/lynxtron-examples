import {
  lstatSync,
  closeSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { WorkspaceFilePreview, WorkspaceSnapshot } from '../../../shared/agent';

const MAX_FILES = 5_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function languageFor(path: string): string {
  const extension = extname(path).toLowerCase();
  return ({
    '.c': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
    '.css': 'css', '.go': 'go', '.html': 'html', '.java': 'java', '.js': 'javascript',
    '.json': 'json', '.jsx': 'jsx', '.md': 'markdown', '.mjs': 'javascript',
    '.py': 'python', '.rs': 'rust', '.sh': 'shell', '.swift': 'swift', '.toml': 'toml',
    '.ts': 'typescript', '.tsx': 'tsx', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
  } as Record<string, string>)[extension] ?? 'text';
}

export class WorkspaceService {
  constructor(private readonly gitCommand = process.env.GIT_BIN ?? 'git') {}

  snapshot(cwd: string): WorkspaceSnapshot {
    const root = this.root(cwd);
    const result = spawnSync(this.gitCommand, ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    if ((result.status ?? -1) !== 0) {
      throw new Error(result.stderr.trim() || `git exited with ${result.status}`);
    }
    const allFiles = (result.stdout ?? '').split('\0').filter(Boolean).sort((a, b) => a.localeCompare(b));
    return { root, files: allFiles.slice(0, MAX_FILES), truncated: allFiles.length > MAX_FILES };
  }

  readFile(cwd: string, requestedPath: string): WorkspaceFilePreview {
    const root = this.root(cwd);
    const path = this.safeRelativePath(root, requestedPath);
    const target = resolve(root, path);
    const stat = statSync(target);
    if (!stat.isFile()) throw new Error('The requested preview is not a file.');
    const size = stat.size;
    const length = Math.min(size, MAX_FILE_BYTES);
    const buffer = Buffer.alloc(length);
    const descriptor = openSync(target, 'r');
    let bytesRead = 0;
    try {
      bytesRead = readSync(descriptor, buffer, 0, length, 0);
    } finally {
      closeSync(descriptor);
    }
    const content = buffer.subarray(0, bytesRead);
    const binary = content.includes(0);
    return {
      root,
      path,
      content: binary ? '' : content.toString('utf8'),
      language: languageFor(path),
      size,
      binary,
      truncated: size > bytesRead,
    };
  }

  filePath(cwd: string, requestedPath: string): string {
    const root = this.root(cwd);
    const path = this.safeRelativePath(root, requestedPath);
    const target = resolve(root, path);
    if (!statSync(target).isFile()) throw new Error('The requested preview is not a file.');
    return target;
  }

  private root(cwd: string): string {
    const result = spawnSync(this.gitCommand, ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
    });
    if ((result.status ?? -1) !== 0 || !result.stdout.trim()) {
      throw new Error('The selected workspace is not inside a Git repository.');
    }
    return realpathSync(result.stdout.trim());
  }

  private safeRelativePath(root: string, requestedPath: string): string {
    if (!requestedPath || isAbsolute(requestedPath)) throw new Error('The requested preview must be repository-relative.');
    const target = resolve(root, requestedPath);
    const path = relative(root, target);
    if (!path || path === '..' || path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(path)) {
      throw new Error('The requested preview is outside the task repository.');
    }
    if (lstatSync(target).isSymbolicLink()) {
      const resolvedTarget = realpathSync(target);
      const resolvedPath = relative(root, resolvedTarget);
      if (resolvedPath === '..' || resolvedPath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(resolvedPath)) {
        throw new Error('The requested preview resolves outside the task repository.');
      }
    }
    return path;
  }
}
