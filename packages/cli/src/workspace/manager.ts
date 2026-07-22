import * as fs from 'fs';
import * as path from 'path';

// Toolchain versions handed to fetched showcases at install time. Kept in sync
// with the source monorepo's pnpm-workspace.yaml catalog so showcases pinned to
// `catalog:` resolve to the versions they were built against. `latest` is used
// where the showcase does not care about pinning (config is unversioned surface).
const CATALOG_VERSIONS: Record<string, string> = {
  '@lynx-js/lynxtron': '0.0.5',
  '@lynx-js/lynxtron-builder': '0.0.5',
  '@lynx-js/lynxtron-dev-plugins': '0.0.5',
  '@lynx-js/lynx-library-headers': '0.0.5',
  '@lynx-js/config-rsbuild-plugin': '0.0.2',
  '@lynx-js/react': '0.120.0',
  '@lynx-js/react-rsbuild-plugin': '^0.16.1',
  '@lynx-js/rspeedy': '^0.14.3',
  '@lynx-js/type-config': '3.6.0',
  '@lynx-js/types': '3.8.0',
  '@rspack/cli': '^1.7.5',
  '@rspack/core': '^1.7.5',
  'concurrently': '^8.2.2',
  'cross-env': '^10.1.0',
  'typescript': '~5.9.3',
};

// Root workspace dependencies. `@lynxtron-examples/config` is pinned to `latest`
// so users always pick up the newest published shared config regardless of the
// installed lynxtron-go version.
const ROOT_DEPENDENCIES: Record<string, string> = {
  ...CATALOG_VERSIONS,
  '@lynxtron-examples/config': 'latest',
};

function stringifyWorkspaceYaml(): string {
  const lines: string[] = [];
  lines.push('packages:');
  lines.push('  - "showcases/*"');
  lines.push('');
  lines.push('catalog:');
  for (const [name, version] of Object.entries(CATALOG_VERSIONS)) {
    // pnpm-workspace.yaml keys with `@` and `/` must be quoted.
    lines.push(`  "${name}": ${version}`);
  }
  return lines.join('\n') + '\n';
}

export class WorkspaceManager {
  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    fs.mkdirSync(path.join(this.root, 'showcases'), { recursive: true });
    fs.mkdirSync(path.join(this.root, 'external'), { recursive: true });

    // Rewrite root package.json every init so DEFAULT_TOOLCHAIN upgrades take
    // effect. Previous versions only wrote it on first launch, which stranded
    // users on stale toolchains after a lynxtron-go upgrade.
    const pkgPath = path.join(this.root, 'package.json');
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: 'lynxtron-go-workspace',
          private: true,
          dependencies: { ...ROOT_DEPENDENCIES },
        },
        null,
        2
      )
    );

    // Rewrite pnpm-workspace.yaml every init so the `catalog:` block matches
    // the current CATALOG_VERSIONS. Showcases in the fetched monorepo pin
    // toolchain deps to `catalog:` and pnpm errors if the catalog entry is
    // missing.
    fs.writeFileSync(path.join(this.root, 'pnpm-workspace.yaml'), stringifyWorkspaceYaml());

    // Remove any stale .npmrc left behind by preview mode (which points at
    // http://localhost:4873). Users hitting fetch in production must use the
    // default registry.
    const npmrcPath = path.join(this.root, '.npmrc');
    if (fs.existsSync(npmrcPath)) {
      const content = fs.readFileSync(npmrcPath, 'utf-8');
      if (/registry\s*=\s*http:\/\/localhost/.test(content)) {
        fs.unlinkSync(npmrcPath);
      }
    }
  }

  async rewriteWorkspaceRefs(showcaseName: string): Promise<void> {
    const pkgPath = path.join(this.root, 'showcases', showcaseName, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(this.root, 'package.json'), 'utf-8')
    );

    const rewrite = (deps: Record<string, string> | undefined) => {
      if (!deps) return;
      for (const [name, version] of Object.entries(deps)) {
        if (version.startsWith('workspace:')) {
          // Point workspace refs at whatever the root package.json pins them
          // to (usually the published npm version).
          deps[name] = rootPkg.dependencies?.[name] ?? 'latest';
        } else if (version.startsWith('catalog:')) {
          // Resolve catalog refs against the catalog we just wrote. This
          // avoids relying on pnpm to look up catalog entries when a showcase
          // is installed outside its original monorepo context.
          deps[name] = CATALOG_VERSIONS[name] ?? rootPkg.dependencies?.[name] ?? 'latest';
        }
      }
    };

    rewrite(pkg.dependencies);
    rewrite(pkg.devDependencies);

    const tmpPath = pkgPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(pkg, null, 2));
    fs.renameSync(tmpPath, pkgPath);
  }

  getShowcasePath(name: string): string {
    return path.join(this.root, 'showcases', name);
  }

  getExternalPath(name: string): string {
    return path.join(this.root, 'external', name);
  }

  getRootPath(): string {
    return this.root;
  }

  listLocal(): Array<{ name: string; type: 'repo' | 'external'; path: string }> {
    const results: Array<{ name: string; type: 'repo' | 'external'; path: string }> = [];

    const showcasesDir = path.join(this.root, 'showcases');
    if (fs.existsSync(showcasesDir)) {
      for (const name of fs.readdirSync(showcasesDir)) {
        const dir = path.join(showcasesDir, name);
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          results.push({ name, type: 'repo', path: dir });
        }
      }
    }

    const externalDir = path.join(this.root, 'external');
    if (fs.existsSync(externalDir)) {
      for (const name of fs.readdirSync(externalDir)) {
        const dir = path.join(externalDir, name);
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          results.push({ name, type: 'external', path: dir });
        }
      }
    }

    return results;
  }
}
