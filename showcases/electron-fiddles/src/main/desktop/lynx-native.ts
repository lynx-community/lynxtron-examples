// Runtime access to native `lynxtron` classes that the package's ESM shim
// (@lynx-js/lynxtron/lynxtron.js) does not re-export.
//
// `Notification` exists on the native `require('lynxtron')` object at runtime
// (verified) but is missing from the shim's named exports, so importing it from
// the package yields `undefined`. We pull it straight from the native module.
import { createRequire } from 'module';
import type { Notification as NotificationClass } from '@lynx-js/lynxtron';

const req = createRequire(import.meta.url);
const lt: Record<string, any> = req('lynxtron');

export const Notification = lt.Notification as typeof NotificationClass;
