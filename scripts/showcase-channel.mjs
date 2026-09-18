import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const slugs = ['mac-arm64', 'mac-x64', 'win-x64'];
export function releaseExists(repo, tag, run = execFileSync) {
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  let result;
  try {
    // Query one tag and project inside gh: release history (and asset metadata)
    // must not grow the subprocess output past execFileSync's buffer limit.
    result = run('gh', ['api', `repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
      '--jq', '.tag_name'], options).trim();
  } catch (error) {
    // Only a confirmed HTTP 404 means absence. Auth, rate-limit, network and
    // buffer errors must stop publication, not enter the release-create path.
    if (error.status !== 1 || !/^gh: Not Found \(HTTP 404\)\r?$/m.test(String(error.stderr ?? ''))) throw error;
    // GitHub also masks inaccessible repositories as 404; verify access first.
    run('gh', ['api', `repos/${repo}`, '--silent'], options);
    return false;
  }
  if (result !== tag) throw Error(`Unexpected release tag response for ${tag}`);
  return true;
}
export function runtimeVersionFromWorkspace(yaml) {
  // The same key also occurs under allowBuilds with the value `true`.
  // Read only the top-level catalog, and fail closed unless it is pinned.
  const catalog = /^catalog:[ \t]*\r?\n((?:[ \t]+[^\r\n]*\r?\n?|\r?\n)*)/m.exec(yaml)?.[1] ?? '';
  const version = /^[ \t]+['"]@lynx-js\/lynxtron['"]:[ \t]*['"]?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)['"]?[ \t]*\r?$/m.exec(catalog)?.[1];
  if (!version) throw Error('Expected pinned Lynxtron runtime in workspace catalog');
  return version;
}
export function identity(version, sha) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
    || !/^[a-f0-9]{40}$/.test(sha)) throw Error('Invalid showcase release identity');
  const channel = `lynxtron-showcases-go-v${version}`;
  return { channel, tag: `${channel}-${sha}`, version, sha };
}
export function buildIndex({ version, sha, runtimeVersion, packages, assets, artifactRelease = 'showcases' }) {
  identity(version, sha);
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(runtimeVersion ?? '')) throw Error('Invalid runtime version');
  if (!['go', 'showcases'].includes(artifactRelease)) throw Error('Invalid artifact release');
  const showcases = packages.filter(pkg => pkg.showcase && pkg.showcase.distribution !== 'builtin').map(pkg => {
    if (!/^@lynxtron-examples\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name)) throw Error('Invalid showcase name');
    identity(pkg.version, sha);
    const name = pkg.name.replace('@', '').replace('/', '-');
    for (const slug of slugs) {
      if (!assets.includes(`${name}-${slug}.tgz`)) throw Error(`Missing ${name}-${slug}.tgz`);
    }
    return { name: pkg.name, version: pkg.version, description: pkg.showcase.description ?? '',
      tags: pkg.showcase.tags ?? [], targets: pkg.showcase.targets ?? ['desktop'] };
  });
  if (!showcases.length) throw Error('No release showcases');
  return { schemaVersion: 1, goVersion: version, runtimeVersion, revision: sha, artifactRelease, showcases };
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const output = values => fs.appendFileSync(process.env.GITHUB_OUTPUT,
  Object.entries(values).map(([k,v]) => `${k}=${v}\n`).join(''));
const runtimeAt = ref => {
  const yaml = git('show', `${ref}:pnpm-workspace.yaml`);
  return runtimeVersionFromWorkspace(yaml);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = read('lynxtron-go/package.json').version;
  const sha = git('rev-parse', 'HEAD');
  const meta = identity(version, sha);
  const repo = process.env.GITHUB_REPOSITORY;
  if (process.argv[2] === 'prepare') {
    if (process.env.VALIDATION_ONLY === 'true') {
      output({ ...meta, runtime: runtimeAt('HEAD') });
      process.exit(0); // Build artifacts only; never enters the publishing job.
    }
    if (process.env.GITHUB_REF !== 'refs/heads/main') throw Error('Standalone showcase releases are stable main-only');
    if (process.env.EXPECTED_VERSION && process.env.EXPECTED_VERSION !== version) throw Error('Go version mismatch');
    // Require an existing stable Go distribution. A showcase cannot silently
    // upgrade the runtime shipped in that already-installed application.
    const baseTag = `lynxtron-go-v${version}`;
    const release = JSON.parse(gh('release', 'view', baseTag, '--repo', repo, '--json', 'isDraft,isPrerelease'));
    if (release.isDraft || release.isPrerelease) throw Error('Stable Go release required');
    const runtime = runtimeAt(baseTag);
    if (!runtime || runtime !== runtimeAt('HEAD')) throw Error('Runtime changed: bump and release Go first');
    git('merge-base', '--is-ancestor', baseTag, 'HEAD');
    output({ ...meta, runtime });
  } else if (['publish', 'seed', 'index'].includes(process.argv[2])) {
    const initial = process.argv[2] === 'seed' || process.env.INITIAL_RELEASE === 'true';
    const assetsDir = path.resolve(process.env.SHOWCASE_ASSETS_DIR || 'release-assets');
    const packages = fs.readdirSync('showcases').flatMap(name => {
      const p = `showcases/${name}/package.json`;
      if (!fs.existsSync(p)) return [];
      const pkg = read(p);
      if (pkg.showcase && !pkg.showcase.targets) {
        const web = typeof pkg.scripts?.['build:web'] === 'string'
          && (typeof pkg.scripts?.['start:web'] === 'string' || typeof pkg.scripts?.['dev:web'] === 'string')
          && fs.existsSync(`showcases/${name}/src/main/web`);
        pkg.showcase.targets = web ? ['desktop', 'web'] : ['desktop'];
      }
      return [pkg];
    });
    const assets = fs.readdirSync(assetsDir).filter(name => name.endsWith('.tgz'));
    const index = buildIndex({ version, sha, runtimeVersion: runtimeAt('HEAD'), packages, assets,
      artifactRelease: initial ? 'go' : 'showcases' });
    const indexFile = path.join(assetsDir, 'showcase-index.json');
    fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
    if (process.argv[2] === 'index') process.exit(0);
    const exists = tag => releaseExists(repo, tag);
    if (initial) {
      const release = JSON.parse(gh('api', `repos/${repo}/releases/tags/lynxtron-go-v${version}`));
      if (release.draft || release.prerelease || !assets.every(name => release.assets.some(a => a.name === name))) {
        throw Error('Complete stable Go release required before channel initialization');
      }
      // Rerunning the original Go build must never reset a later showcase update.
      if (exists(meta.channel)) { console.log('Channel already initialized; leaving it unchanged.'); process.exit(0); }
    } else if (!exists(meta.tag)) {
      gh('release', 'create', meta.tag, '--repo', repo, '--target', sha, '--draft', '--latest=false',
        '--title', `Showcases for Go ${version} (${sha.slice(0, 7)})`, '--notes', `Compatible with Lynxtron Go ${version}; runtime ${index.runtimeVersion}.`,
        ...assets.map(name => path.join(assetsDir, name)), indexFile);
      gh('release', 'edit', meta.tag, '--repo', repo, '--draft=false', '--latest=false');
    } else {
      // Immutable revisions are reused on retries, never overwritten by rebuilt bytes.
      const previous = JSON.parse(gh('api', `repos/${repo}/releases/tags/${meta.tag}`));
      if (previous.draft || !assets.every(name => previous.assets.some(a => a.name === name))
        || !previous.assets.some(a => a.name === 'showcase-index.json')) throw Error('Incomplete existing revision; inspect before retrying');
    }
    git('fetch', 'origin', 'main');
    const currentVersion = JSON.parse(git('show', 'origin/main:lynxtron-go/package.json')).version;
    if (currentVersion !== version) {
      console.log('Next Go version has begun; previous showcase channel stays frozen.');
      process.exit(0);
    }
    // Serialised with installer publication. Do not let an older manual rerun
    // move the channel back after a newer main commit has been published.
    if (exists(meta.channel)) {
      const temp = fs.mkdtempSync(path.join(assetsDir, 'old-index-'));
      gh('release', 'download', meta.channel, '--repo', repo, '--pattern', 'showcase-index.json', '--dir', temp);
      const old = read(path.join(temp, 'showcase-index.json'));
      if (old.goVersion !== version || old.runtimeVersion !== index.runtimeVersion) throw Error('Existing channel identity mismatch');
      if (!/^[a-f0-9]{40}$/.test(old.revision ?? '')) throw Error('Invalid existing channel revision');
      git('merge-base', '--is-ancestor', old.revision, sha);
      gh('release', 'upload', meta.channel, indexFile, '--repo', repo, '--clobber');
    } else {
      gh('release', 'create', meta.channel, indexFile, '--repo', repo, '--target', sha, '--latest=false',
        '--title', `Showcase index for Go ${version}`, '--notes', 'Mutable index; all referenced showcase archives are immutable.');
    }
  } else { throw Error('Expected prepare or publish'); }
}
