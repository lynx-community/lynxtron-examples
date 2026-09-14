import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

export default createShowcaseConfig({
  /* WEB_SUPPORT_START */
  web: true,
  /* WEB_SUPPORT_END */
  lynxDistPath: './output/bundle/lynx',
  reactPluginOptions: { enableCSSInheritance: false },
});
