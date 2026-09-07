---
'lynxtron-go': patch
---

Fix blank gallery thumbnails (and brand marks) in the packaged Windows app. The runtime resource root resolved to `process.resourcesPath` (`…/resources`) for every packaged build, but Windows ships unpacked (`asar: false`) so the assets actually live one level down in `…/resources/app`. `<image>` then requested a non-existent `…/resources/thumbnails/…` path and every card came up blank. Resolve to the unpacked app directory when the main process is not running from inside an `app.asar`, and keep `resourcesPath` for asar builds (macOS) where the app dir is unreadable by `<image>`.
