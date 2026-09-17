export interface ReleaseSize { bytes: number; tag: string; assetName: string }

export function selectReleaseSize(release: any, platform: string, arch: string): ReleaseSize {
  if (!release || release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error('Invalid stable release metadata');
  }
  // No suffix: exclude devtool, symbols and CEF archives.
  const assetName = `lynxtron-${release.tag_name}-${platform}-${arch}.zip`;
  const asset = release.assets?.find((item: any) => item.name === assetName);
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0) {
    throw new Error(`Release ZIP unavailable for ${platform} ${arch}`);
  }
  return { bytes: asset.size, tag: release.tag_name, assetName };
}

export async function fetchReleaseSize(platform = process.platform, arch = process.arch, request: typeof fetch = fetch): Promise<ReleaseSize> {
  const response = await request('https://api.github.com/repos/lynx-family/lynxtron/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'lynxtron-benchmark' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`GitHub metadata request failed (${response.status})`);
  return selectReleaseSize(await response.json(), platform, arch);
}
