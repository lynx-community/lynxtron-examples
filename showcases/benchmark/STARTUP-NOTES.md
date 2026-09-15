# Startup diagnostic restoration

Restored on 2026-09-15 from commit 88f3c04 and conversation patches after the
temporary worktree disappeared following a reboot. This is a reconstructed build,
not a byte-identical before/after reboot comparison. Runtime: 0.0.22 release,
darwin-arm64, downloaded again through its runtime manager. No diagnostic logging
is flushed before the first-screen event. Main-body marks occur after imports.

First launch of the rebuilt distribution (15:17 local time, PID 11452):

| Interval | ms |
| --- | ---: |
| Process creation to main module body | 2235.28 |
| Main body to app ready | 89.99 |
| Window creation (including viewport nudge) | 106.33 |
| show call | 0.84 |
| loadFile call | 97.45 |
| loadFile return to first-screen event | 39.22 |
| Process creation to first-screen layout | 2570 |

The dominant interval still precedes main module body. This does not distinguish
OS loading, native runtime initialization and imported module initialization.
It does not measure actual display presentation. Build and three ZIP metadata
tests passed. ZIP requests start after receiving the first-screen metric.
