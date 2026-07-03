import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_TOOLCHAIN = {
  '@lynx-js/react': '0.115.4',
  '@lynx-js/rspeedy': '^0.13.0',
  '@lynx-js/types': '3.6.0',
  '@lynx-js/react-rsbuild-plugin': '^0.12.5',
  '@lynxtron-showcases/config': '0.0.1',
  '@rspack/cli': '^1.7.5',
  '@rspack/core': '^1.7.5',
  '@lynx-js/lynxtron': '0.0.3',
  '@lynx-js/lynxtron-dev-plugins': '0.0.3',
  'typescript': '~5.9.3',
  'concurrently': '^8.2.2',
  'cross-env': '^10.1.0',
};

export class WorkspaceManager {
  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    fs.mkdirSync(path.join(this.root, 'showcases'), { recursive: true });
    fs.mkdirSync(path.join(this.root, 'external'), { recursive: true });

    const pkgPath = path.join(this.root, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      fs.writeFileSync(
        pkgPath,
        JSON.stringify(
          {
            name: 'lynxtron-go-workspace',
            private: true,
            dependencies: { ...DEFAULT_TOOLCHAIN },
          },
          null,
          2
        )
      );
    }

    const wsPath = path.join(this.root, 'pnpm-workspace.yaml');
    if (!fs.existsSync(wsPath)) {
      fs.writeFileSync(wsPath, 'packages:\n  - "showcases/*"\n');
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
          deps[name] = rootPkg.dependencies?.[name] ?? '*';
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
