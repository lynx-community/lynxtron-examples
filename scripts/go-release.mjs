import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function versionBumped(previous, current) {
  if (previous === current) return false;
  if (!stableVersion.test(current) || !stableVersion.test(previous)) {
    throw new Error('Go releases require stable numeric package versions');
  }
  const a = previous.split('.').map(Number);
  const b = current.split('.').map(Number);
  const index = a.findIndex((part, i) => part !== b[i]);
  if (b[index] < a[index]) throw new Error('Go version must increase');
  return true;
}

export function releaseMetadata({ version, ref, sha, tag = '', expectedVersion = '' }) {
  if (!stableVersion.test(version)) throw new Error('Invalid Go package version');
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Release source must be a full commit SHA');
  if (expectedVersion && version !== expectedVersion) throw new Error('Caller/package version mismatch');
  const stableTag = `lynxtron-go-v${version}`;
  const prerelease = ref !== 'refs/heads/main' && ref !== `refs/tags/${stableTag}`;
  if (expectedVersion && prerelease) throw new Error('Automatic releases must run on main');
  const canonicalTag = prerelease ? `${stableTag}-dev.${sha.slice(0, 6)}` : stableTag;
  if (tag && tag !== canonicalTag) throw new Error(`Tag must match package version and source: ${canonicalTag}`);
  return { version, tag: canonicalTag, prerelease, sha };
}

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version } = JSON.parse(readFileSync('lynxtron-go/package.json', 'utf8'));
  if (process.argv[2] === 'detect') {
    const before = process.env.BEFORE_SHA;
    if (!/^[a-f0-9]{40}$/.test(before ?? '') || /^0+$/.test(before)) {
      throw new Error('Missing push base SHA; refusing to guess a release');
    }
    const previous = JSON.parse(execFileSync('git', ['show', `${before}:lynxtron-go/package.json`], { encoding: 'utf8' })).version;
    const changedFiles = execFileSync('git', ['diff', '--name-only', before, 'HEAD', '--', 'showcases'], { encoding: 'utf8' })
      .trim().split('\n').filter(file => /^showcases\/[^/]+\/package\.json$/.test(file));
    const showcaseChanged = changedFiles.some(file => {
      let current;
      try { current = JSON.parse(readFileSync(file, 'utf8')); } catch { return true; }
      if (!current.showcase || current.showcase.distribution === 'builtin') return false;
      try {
        const old = JSON.parse(execFileSync('git', ['show', `${before}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
        return current.version !== old.version;
      } catch { return true; }
    });
    output({ version, changed: versionBumped(previous, version), 'showcases-changed': showcaseChanged });
  } else if (process.argv[2] === 'resolve') {
    output(releaseMetadata({
      version, ref: process.env.GITHUB_REF,
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      tag: process.env.REQUESTED_TAG, expectedVersion: process.env.EXPECTED_VERSION,
    }));
  } else {
    throw new Error('Expected detect or resolve');
  }
}
