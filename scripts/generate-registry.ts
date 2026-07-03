import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const showcasesDir = path.resolve(__dirname, '..', 'showcases');
const outputPath = path.resolve(__dirname, '..', 'showcase-registry.json');

interface RegistryEntry {
  name: string;
  description: string;
  path: string;
  thumbnail: string | null;
  tags: string[];
  targets: string[];
}

const THUMBNAIL_CANDIDATES = [
  'thumbnail.png',
  'thumbnail.svg',
  'thumbnail.webp',
  'thumbnail.jpg',
  'thumbnail.jpeg',
];

function resolveThumbnail(showcaseDir: string, explicitThumbnail?: string | null): string | null {
  // Convention: prefer an explicit showcase.thumbnail path, otherwise fall back
  // to a standard root-level thumbnail image.
  const candidates = explicitThumbnail
    ? [explicitThumbnail, ...THUMBNAIL_CANDIDATES]
    : THUMBNAIL_CANDIDATES;

  for (const candidate of candidates) {
    const absPath = path.resolve(showcaseDir, candidate);
    if (!fs.existsSync(absPath)) continue;
    if (!fs.statSync(absPath).isFile()) continue;
    return path.relative(showcaseDir, absPath).replace(/\\/g, '/');
  }

  return null;
}

function buildRegistryThumbnail(showcaseName: string, showcaseDir: string, explicitThumbnail?: string | null): string | null {
  const thumbnail = resolveThumbnail(showcaseDir, explicitThumbnail);
  return thumbnail ? `${showcaseName}/${thumbnail}` : null;
}

function resolveTargets(showcaseDir: string, pkg: any): string[] {
  const explicitTargets = Array.isArray(pkg?.showcase?.targets)
    ? pkg.showcase.targets.filter((target: unknown): target is string => typeof target === 'string' && target.trim().length > 0)
    : null;
  if (explicitTargets && explicitTargets.length) {
    return Array.from(new Set(explicitTargets));
  }

  const targets = ['desktop'];
  const scripts = pkg?.scripts ?? {};
  const hasWebScripts = typeof scripts['build:web'] === 'string'
    && (
      typeof scripts['start:web'] === 'string'
      || typeof scripts['dev:web'] === 'string'
    );
  const hasWebHost = fs.existsSync(path.join(showcaseDir, 'src', 'main', 'web'));
  if (hasWebScripts && hasWebHost) {
    targets.push('web');
  }
  return targets;
}

const showcases: RegistryEntry[] = [];

// Scan showcases/ directory
for (const name of fs.readdirSync(showcasesDir)) {
  const pkgPath = path.join(showcasesDir, name, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const meta = pkg.showcase;
  if (!meta) continue;

  showcases.push({
    name: pkg.name || name,
    description: meta.description ?? pkg.description ?? '',
    path: `showcases/${name}`,
    thumbnail: buildRegistryThumbnail(`showcases/${name}`, path.join(showcasesDir, name), meta.thumbnail),
    tags: meta.tags ?? [],
    targets: resolveTargets(path.join(showcasesDir, name), pkg),
  });
}

// Also scan lynxtron-go/ (self-hosting)
const lynxtronGoPkgPath = path.resolve(__dirname, '..', 'lynxtron-go', 'package.json');
if (fs.existsSync(lynxtronGoPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(lynxtronGoPkgPath, 'utf-8'));
  const meta = pkg.showcase;
  if (meta) {
    const showcaseDir = path.resolve(__dirname, '..', 'lynxtron-go');
    showcases.push({
      name: pkg.name || 'lynxtron-go',
      description: meta.description ?? '',
      path: 'lynxtron-go',
      thumbnail: buildRegistryThumbnail('lynxtron-go', showcaseDir, meta.thumbnail),
      tags: meta.tags ?? [],
      targets: resolveTargets(showcaseDir, pkg),
    });
  }
}

const registry = {
  version: 1,
  showcases: showcases.sort((a, b) => a.name.localeCompare(b.name)),
};

fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Generated showcase-registry.json with ${showcases.length} showcase(s)`);
