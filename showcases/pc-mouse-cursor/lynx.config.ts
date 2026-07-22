import { createShowcaseConfig } from '@lynxtron-examples/config/lynx';

const targetEnv = process.env.TARGET_ENV ?? 'desktop';
const config = targetEnv === 'web'
  ? createShowcaseConfig({
      web: true,
      lynxDistPath: './output/bundle/lynx',
    })
  : createShowcaseConfig({
      lynxDistPath: './output/bundle/lynx',
    });

if (targetEnv === 'web') {
  config.server = {
    ...(config.server ?? {}),
    port: 5969,
  };
}

export default config;
