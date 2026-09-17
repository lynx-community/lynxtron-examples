/** Select the architecture of the running Go process, including under Rosetta.
 * Only rewrite our release assets; arbitrary URLs and source tarballs are untouched.
 */
export function resolveShowcaseArtifactUrl(url: string, platform = process.platform, arch = process.arch): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return url; }
  if (parsed.origin !== 'https://github.com') return url;
  const match = /^(\/lynx-community\/lynxtron-examples\/releases\/download\/[^/]+\/)(lynxtron-(?:examples-.+|go))-(mac|win)(?:-(arm64|x64))?\.tgz$/.exec(parsed.pathname);
  if (!match) return url;
  const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : '';
  if (!os || (os === 'mac' ? arch !== 'x64' && arch !== 'arm64' : arch !== 'x64')) {
    throw new Error(`Unsupported showcase target: ${platform}-${arch}`);
  }
  // Releases through Go 0.1.12 only shipped mac=arm64 and win=x64.
  // Do not invent an x64 asset for those immutable older releases.
  if (!match[4]) {
    if (match[3] !== os || (os === 'mac' && arch !== 'arm64')) {
      throw new Error('This legacy showcase has no matching architecture. Upgrade Lynxtron Go and use its current showcase gallery.');
    }
    return url;
  }
  parsed.pathname = `${match[1]}${match[2]}-${os}-${arch}.tgz`;
  return parsed.href;
}
