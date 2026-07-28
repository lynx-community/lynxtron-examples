import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

const targetEnv = process.env.TARGET_ENV ?? 'desktop';

export default targetEnv === 'web'
  ? createShowcaseConfig({
      web: true,
      lynxDistPath: './output/bundle/lynx',
    })
  : createShowcaseConfig({
      lynxDistPath: './output/bundle/lynx',
    });
