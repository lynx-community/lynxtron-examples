# Workflow: Benchmark Dashboard Showcase

**Date**: 2026-03-25
**Branch**: feat/monorepo-architecture
**Goal**: Build the Benchmark Dashboard showcase showing Lynxtron runtime metrics
**Status**: completed
**Runtime Baseline**: `@lynx-js/lynxtron@0.0.1-alpha.14`

## Steps

### Step 1: Workflow MD [DONE]
- Create this file at `docs/workflows/2026-03-25-feat-benchmark-dashboard.md`

### Step 2: Scaffold [DONE]
- Create `showcases/benchmark/` directory structure
- `package.json` with showcase metadata
- `lynx.config.ts` using `createShowcaseConfig`
- `rspack.config.ts` for desktop-only build
- Stub files for src/app/ and src/main/desktop/

### Step 3: Preload API [DONE]
- Implement `benchmark.getAppSize()` — runtime binary size + business code + extensions
- Implement `benchmark.getStartupTime()` — `Date.now() - preloadStartTime`
- Implement `benchmark.getMemoryUsage()` — `process.memoryUsage()`
- Wire up `contextBridge.exposeInLynxBTS`

### Step 4: UI Components [DONE]
- `MetricCard.tsx` — reusable card with large number + label + subtitle
- `MetricCard.css` — dark theme card styles
- `SizeBreakdown.tsx` — horizontal stacked bar chart for app size
- `SizeBreakdown.css` — bar chart styles

### Step 5: App Layout [DONE]
- `App.tsx` — three MetricCard components + SizeBreakdown
- `App.css` — deep dark theme (#0a0a0a), typography
- Memory polling every 2 seconds
- Footer with version + platform info

### Step 6: Build & Verify [DONE]
- `pnpm run build` in `showcases/benchmark/`
- Verify `dist/desktop/` contains expected files
- Check all acceptance criteria

### Step 7: Register & Commit [DONE]
- `pnpm run generate-registry` at repo root
- Verify showcase appears in registry
- Commit with `feat(benchmark): [step X/N] <title>` format

## Verification Criteria

- [x] Build succeeds without errors
- [x] Three MetricCard components render (App Size, Startup Time, Memory)
- [x] App Size shows real value (~58MB), not 0 or NaN
- [x] Startup Time in expected range for current demo build
- [x] Memory usage renders and refreshes
- [x] Size Breakdown bar chart has 3 colored sections
- [x] Dark background (#0a0a0a), large white numbers (32px+)
- [x] Footer shows Lynxtron version + platform
- [x] showcase field in package.json
- [x] Appears in showcase-registry.json after generate-registry

## Status Update

- 2026-03-25: Initial metrics dashboard completed and registered
- 2026-04-01: Interactive performance demo landed, including long-list and stress-demo modules
- 2026-04-02: Desktop runtime verified on `0.0.1-alpha.14`; Lynx DevTool confirmed benchmark UI and runtime metrics rendering
