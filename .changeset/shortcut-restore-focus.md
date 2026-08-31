---
"lynxtron-go": patch
---

Fix keyboard shortcuts (e.g. Ctrl+C) being stuck in the Scintilla editor on Windows. Clicking the native Scintilla child HWND takes the Win32 keyboard focus, and a later click on the Lynx renderer surface did not reliably reclaim it, so shortcuts kept firing in the editor while the user was selecting text in a Lynx log/output. The parent window now restores focus on Lynx-surface pointer-down before Lynx handles the event, so the ensuing interaction owns the keyboard event stream too.
