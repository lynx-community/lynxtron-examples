import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';
import { FIDDLE_ENTRIES } from './entries.ts';

// Multi-entry: one Lynx bundle per fiddle plus the `main` gallery bundle.
// Uses the shared showcase config so the fiddles get the repo-wide defaults
// (notably `alignMouseEventWithW3C`, which the pointer-driven demos rely on).
export default createShowcaseConfig({
  entries: FIDDLE_ENTRIES,
  lynxDistPath: './output/bundle/lynx',
  server: { port: 5891 },
});
