import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface RepoShowcase {
  type: 'repo';
  owner: string;
  repo: string;
  ref: string;
  path: string;
  name: string;
}

interface LocalShowcase {
  type: 'local';
  filePath: string;
  name: string;
}

interface RemoteTarballShowcase {
  type: 'remote-tarball';
  url: string;
  name: string;
}

interface ExternalShowcase {
  type: 'external';
  url: string;
  name: string;
}

type ResolvedShowcase = RepoShowcase | LocalShowcase | RemoteTarballShowcase | ExternalShowcase;

// GitHub: https://github.com/{owner}/{repo}/tree/{ref}/showcases/{name}
const GITHUB_TREE_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)\/showcases\/([^/]+)\/?$/;

function fileUrlToPath(url: string): string {
  try {
    return fileURLToPath(url);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
    return decodeURIComponent(new URL(url).pathname);
  }
}

function tarballName(fileName: string): string {
  return fileName
    .replace(/\.tgz$/i, '')
    .replace(/-\d+\.\d+\.\d+(?:[-+].*)?$/, '')
    // Release assets use pnpm's scoped-package filename without the version.
    .replace(/^lynxtron-examples-/, '');
}

export function resolveShowcaseUrl(url: string): ResolvedShowcase {
  // file:// protocol → local tarball
  if (url.startsWith('file://')) {
    const filePath = fileUrlToPath(url);
    // Extract name from tarball filename: counter-0.0.1.tgz → counter
    const basename = path.basename(filePath) || 'unknown';
    const name = tarballName(basename);
    return { type: 'local', filePath, name };
  }

  const parsedUrl = new URL(url);
  if (/\.tgz$/i.test(parsedUrl.pathname)) {
    return {
      type: 'remote-tarball',
      url,
      name: tarballName(path.basename(parsedUrl.pathname)),
    };
  }

  const githubMatch = url.match(GITHUB_TREE_RE);
  if (githubMatch) {
    const [, owner, repo, ref, name] = githubMatch;
    return {
      type: 'repo',
      owner,
      repo,
      ref,
      path: `showcases/${name}`,
      name,
    };
  }

  // External: extract name from URL
  const urlObj = parsedUrl;
  const segments = urlObj.pathname.split('/').filter(Boolean);
  let name = segments[segments.length - 1] || 'unknown';
  name = name.replace(/\.git$/, '');

  return { type: 'external', url, name };
}
