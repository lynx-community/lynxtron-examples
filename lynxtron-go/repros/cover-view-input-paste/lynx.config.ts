import { defineConfig } from '@lynx-js/rspeedy';
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { compilerOptionsKeys, configKeys, type CompilerOptions, type Config } from '@lynx-js/type-config';

export default defineConfig({
  output: { filename: '[name].[platform].bundle' },
  environments: {
    lynx: {
      source: { entry: { main: './src/index.tsx' } },
      output: { distPath: { root: './output/bundle/lynx' } },
    },
  },
  plugins: [
    pluginLynxConfig({ alignMouseEventWithW3C: true, enableCSSInheritance: true }, {
      configKeys: [...configKeys, 'alignMouseEventWithW3C'],
      compilerOptionsKeys,
      validate: input => input as Config & CompilerOptions & {
        alignMouseEventWithW3C: boolean;
      },
    }),
    pluginReactLynx({ enableCSSInheritance: true }),
  ],
});
