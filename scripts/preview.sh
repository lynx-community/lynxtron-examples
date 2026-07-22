#!/usr/bin/env bash
# Preview mode: pack showcases, start local registry, build & launch Lynxtron GO
#
# Usage:
#   ./scripts/preview.sh          # full flow: pack + registry + build + launch
#   ./scripts/preview.sh --no-launch  # pack + registry + build only
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/tmp/npm-cache-lynxtron-examples}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
log()  { echo -e "${GREEN}[preview]${NC} $*"; }
err()  { echo -e "${RED}[preview]${NC} $*" >&2; }

NO_LAUNCH=false
[[ "${1:-}" == "--no-launch" ]] && NO_LAUNCH=true

mkdir -p "$NPM_CACHE_DIR"

has_web_target() {
  local dir="$1"
  node -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
const scripts = pkg.scripts || {};
const explicitTargets = Array.isArray(pkg.showcase && pkg.showcase.targets)
  ? pkg.showcase.targets
  : [];
const inferredWebTarget =
  typeof scripts["build:web"] === "string" &&
  (typeof scripts["start:web"] === "string" || typeof scripts["dev:web"] === "string") &&
  fs.existsSync(path.join(dir, "src", "main", "web"));
process.exit(explicitTargets.includes("web") || inferredWebTarget ? 0 : 1);
' "$dir"
}

# ── Step 1: Pack all showcases ─────────────────────────────────────────────
log "=== Step 1: Pack showcases ==="
SHOWCASES_DIR="$ROOT_DIR/showcases"
for dir in "$SHOWCASES_DIR"/*/; do
  name=$(basename "$dir")
  if [ ! -f "$dir/package.json" ]; then continue; fi

  # Preview validates packed dist artifacts, so rebuild before packing to avoid stale dist.
  log "Building $name desktop target..."
  (cd "$dir" && pnpm run build 2>&1 | tail -5)

  if has_web_target "$dir"; then
    log "Building $name web target..."
    (cd "$dir" && pnpm run build:web 2>&1 | tail -5)
  fi

  # Remove old tarballs
  rm -f "$dir"/*.tgz

  # Pack
  log "Packing $name..."
  (cd "$dir" && pnpm pack --pack-destination "$dir" 2>/dev/null)
  tgz=$(ls "$dir"/*.tgz 2>/dev/null | head -1)
  if [ -n "$tgz" ]; then
    log "  → $(basename "$tgz")"
  else
    err "  → Failed to pack $name"
  fi
done

# Also pack lynxtron-go itself (self-hosting showcase)
LYNXTRON_GO_DIR="$ROOT_DIR/lynxtron-go"
if grep -q '"showcase"' "$LYNXTRON_GO_DIR/package.json" 2>/dev/null; then
  log "Building lynxtron-go desktop target..."
  (cd "$LYNXTRON_GO_DIR" && pnpm run build 2>&1 | tail -5)
  rm -f "$LYNXTRON_GO_DIR"/*.tgz
  log "Packing lynxtron-go..."
  (cd "$LYNXTRON_GO_DIR" && pnpm pack --pack-destination "$LYNXTRON_GO_DIR" 2>/dev/null)
  tgz=$(ls "$LYNXTRON_GO_DIR"/*.tgz 2>/dev/null | head -1)
  if [ -n "$tgz" ]; then
    log "  → $(basename "$tgz")"
  else
    err "  → Failed to pack lynxtron-go"
  fi
fi

# ── Step 2: Start local registry + publish packages ───────────────────────
log "=== Step 2: Local registry ==="
# Stop any existing registry
bash "$ROOT_DIR/scripts/local-registry.sh" stop 2>/dev/null || true
bash "$ROOT_DIR/scripts/local-registry.sh" start

# ── Step 2b: Configure CLI workspace to use local registry ────────────────
LYNXTRON_WS="$HOME/.lynxtron-go"
mkdir -p "$LYNXTRON_WS"
log "Writing .npmrc to $LYNXTRON_WS (registry=http://localhost:4873)"
cat > "$LYNXTRON_WS/.npmrc" << EOF
registry=http://localhost:4873
EOF

# ── Step 3: Build Lynxtron GO in preview mode ─────────────────────────────
log "=== Step 3: Build Lynxtron GO (preview mode) ==="
cd "$ROOT_DIR/lynxtron-go"
rm -rf output/bundle dist/desktop
LYNXTRON_SHOWCASE_SOURCE=local-registry pnpm run build 2>&1 | tail -5

# ── Step 4: Launch ─────────────────────────────────────────────────────────
if [ "$NO_LAUNCH" = true ]; then
  log "=== Build complete (--no-launch). Launch manually: ==="
  log "  cd lynxtron-go && npx lynxtron ./dist/desktop"
else
  log "=== Step 4: Launching Lynxtron GO ==="
  log "Press Ctrl+C to stop."
  npx lynxtron ./dist/desktop
fi
