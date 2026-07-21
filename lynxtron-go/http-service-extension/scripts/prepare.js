#!/usr/bin/env node
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

const requiredPaths = [
  'CMakeLists.txt',
  'index.cjs',
  'bindings',
  'module',
];

const missingPaths = requiredPaths.filter((relativePath) => !existsSync(join(rootDir, relativePath)));

if (missingPaths.length > 0) {
  console.log('[lynxtron-http-service] Warning: package is missing expected extension sources.');
  for (const relativePath of missingPaths) {
    console.log(`  - ${relativePath}`);
  }
  process.exitCode = 1;
} else {
  console.log('[lynxtron-http-service] Extension sources available in-package; no scaffold files copied.');
}
