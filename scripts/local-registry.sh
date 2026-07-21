#!/usr/bin/env bash
# Local npm registry for testing CLI fetch → build → serve flow.
#
# Usage:
#   ./scripts/local-registry.sh           # start registry + publish + run e2e test
#   ./scripts/local-registry.sh start     # start registry + publish only (for manual testing)
#   ./scripts/local-registry.sh stop      # stop registry + cleanup
#
# Manual testing after "start":
#   LYNXTRON_WORKSPACE=/tmp/lynxtron-e2e \
#   GH_TOKEN=$(gh auth token) \
#   node packages/cli/dist/index.js fetch 'https://github.com/...'
#
# TODO: This script uses a local registry because @lynxtron-showcases/* packages
# are not yet published to npm. Remove this workaround once packages are published.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/tmp/npm-cache-lynxtron-showcases}"
REGISTRY_PORT=4873
REGISTRY_URL="http://localhost:${REGISTRY_PORT}"
REGISTRY_PID_FILE="/tmp/verdaccio-lynxtron.pid"
REGISTRY_DIR="/tmp/verdaccio-lynxtron"
E2E_WORKSPACE="/tmp/lynxtron-e2e"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log()  { echo -e "${GREEN}[registry]${NC} $*"; }
err()  { echo -e "${RED}[registry]${NC} $*" >&2; }

mkdir -p "$NPM_CACHE_DIR"

start_registry() {
  # Always stop existing registry and clean storage to avoid version conflicts
  if [ -f "$REGISTRY_PID_FILE" ] && kill -0 "$(cat "$REGISTRY_PID_FILE")" 2>/dev/null; then
    log "Stopping existing registry (pid $(cat "$REGISTRY_PID_FILE"))..."
    kill "$(cat "$REGISTRY_PID_FILE")" 2>/dev/null || true
    wait "$(cat "$REGISTRY_PID_FILE")" 2>/dev/null || true
  fi

  rm -rf "$REGISTRY_DIR"
  mkdir -p "$REGISTRY_DIR/storage"

  # Minimal verdaccio config — no auth required for publish
  cat > "$REGISTRY_DIR/config.yaml" << EOF
storage: ${REGISTRY_DIR}/storage
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@lynxtron-showcases/*':
    access: \$all
    publish: \$all
    unpublish: \$all
    allow_overwrite: true
  '@lynx-js/*':
    access: \$all
    proxy: bnpm
  '**':
    access: \$all
    proxy: npmjs
server:
  keepAliveTimeout: 60
listen: 0.0.0.0:${REGISTRY_PORT}
log: { type: stdout, format: pretty, level: warn }
EOF

  log "Starting verdaccio on ${REGISTRY_URL}..."
  pnpm exec verdaccio --config "$REGISTRY_DIR/config.yaml" &
  VERDACCIO_PID=$!
  echo "$VERDACCIO_PID" > "$REGISTRY_PID_FILE"

  # Wait for registry to be ready
  for i in $(seq 1 60); do
    if curl -s "${REGISTRY_URL}/-/ping" > /dev/null 2>&1; then
      log "Registry ready (pid ${VERDACCIO_PID})"
      return 0
    fi
    sleep 0.5
  done

  err "Registry failed to start"
  kill "$VERDACCIO_PID" 2>/dev/null || true
  return 1
}

publish_packages() {
  log "Publishing @lynxtron-showcases/config to local registry..."
  cd "$ROOT_DIR/packages/config"
  npm --cache "$NPM_CACHE_DIR" publish --registry "$REGISTRY_URL" --force 2>&1 | grep -v "npm warn" || true

  # CLI is not needed in the remote workspace, but publish for completeness
  log "Publishing @lynxtron-showcases/cli to local registry..."
  cd "$ROOT_DIR/packages/cli"
  # Build first
  pnpm run build 2>&1 | tail -1
  npm --cache "$NPM_CACHE_DIR" publish --registry "$REGISTRY_URL" --force 2>&1 | grep -v "npm warn" || true

  log "Packages published"
  cd "$ROOT_DIR"
}

stop_registry() {
  if [ -f "$REGISTRY_PID_FILE" ]; then
    local pid
    pid=$(cat "$REGISTRY_PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping registry (pid ${pid})..."
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$REGISTRY_PID_FILE"
  fi
  rm -rf "$REGISTRY_DIR"
  log "Registry stopped"
}

run_e2e() {
  # Clear pnpm store cache for @lynxtron-showcases packages to avoid stale artifacts
  log "Clearing pnpm store cache..."
  pnpm store prune 2>/dev/null || true

  local github_url="${1:-}"

  if [ -z "$github_url" ]; then
    # Default: use the repo's own counter showcase
    # Try to detect the remote URL and branch
    local remote_url branch
    remote_url=$(git -C "$ROOT_DIR" remote get-url origin 2>/dev/null | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
    branch=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)
    github_url="${remote_url}/tree/${branch}/showcases/counter"
    log "Using default URL: ${github_url}"
  fi

  # Clean workspace
  rm -rf "$E2E_WORKSPACE"

  # Configure workspace to use local registry
  mkdir -p "$E2E_WORKSPACE"
  cat > "$E2E_WORKSPACE/.npmrc" << EOF
registry=${REGISTRY_URL}
EOF

  log "=== Step 1: fetch ==="
  GH_TOKEN="${GH_TOKEN:-$(gh auth token 2>/dev/null || echo '')}" \
  LYNXTRON_WORKSPACE="$E2E_WORKSPACE" \
    node "$ROOT_DIR/packages/cli/dist/index.js" fetch "$github_url"

  log "=== Step 2: verify fetched files ==="
  local showcase_name
  showcase_name=$(basename "$github_url")
  ls -la "$E2E_WORKSPACE/showcases/$showcase_name/"
  cat "$E2E_WORKSPACE/showcases/$showcase_name/package.json"

  log "=== Step 3: build ==="
  LYNXTRON_WORKSPACE="$E2E_WORKSPACE" \
    node "$ROOT_DIR/packages/cli/dist/index.js" build "$showcase_name"

  log "=== Step 4: list ==="
  LYNXTRON_WORKSPACE="$E2E_WORKSPACE" \
    node "$ROOT_DIR/packages/cli/dist/index.js" list

  log "=== All steps passed! ==="
}

cleanup() {
  stop_registry
  rm -rf "$E2E_WORKSPACE"
}

# Main
case "${1:-auto}" in
  start)
    start_registry
    publish_packages
    log "Registry running at ${REGISTRY_URL}"
    log "To test manually:"
    log "  LYNXTRON_WORKSPACE=/tmp/lynxtron-e2e GH_TOKEN=\$(gh auth token) \\"
    log "    node packages/cli/dist/index.js fetch '<github-url>'"
    log ""
    log "Stop with: $0 stop"
    ;;
  stop)
    cleanup
    ;;
  auto)
    trap cleanup EXIT
    start_registry
    publish_packages
    run_e2e "${2:-}"
    ;;
  *)
    echo "Usage: $0 [start|stop|auto] [github-url]"
    exit 1
    ;;
esac
