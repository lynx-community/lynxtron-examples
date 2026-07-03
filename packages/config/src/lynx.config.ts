import { defineConfig } from '@lynx-js/rspeedy';
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { compilerOptionsKeys, configKeys, type CompilerOptions, type Config } from '@lynx-js/type-config';

export function createShowcaseConfig(options?: {
  entry?: string;
  web?: boolean;
  lynxDistPath?: string;
  reactPluginOptions?: Record<string, any>;
}) {
  const entry = options?.entry ?? './src/app/index.tsx';
  const lynxOutput: Record<string, any> = {};
  if (options?.lynxDistPath) {
    lynxOutput.distPath = { root: options.lynxDistPath };
  }
  const environments: Record<string, any> = {
    lynx: {
      source: { entry: { main: entry } },
      ...(Object.keys(lynxOutput).length ? { output: lynxOutput } : {}),
    },
  };
  if (options?.web) {
    environments.web = {
      source: { entry: { main: entry } },
      output: { target: 'web', distPath: { root: './output/bundle/web' } },
    };
  }
  const reactPluginOptions = { ...(options?.reactPluginOptions ?? {}) };
  delete reactPluginOptions.alignMouseEventWithW3C;
  const enableCSSInheritance = reactPluginOptions.enableCSSInheritance ?? true;
  const defaultReactPluginOptions = {
    enableCSSInheritance,
  };
  const defaultLynxConfig = {
    alignMouseEventWithW3C: true,
    enableCSSInheritance,
  };
  return defineConfig({
    output: { filename: '[name].[platform].bundle' },
    environments,
    plugins: [
      pluginLynxConfig(defaultLynxConfig, {
        configKeys: [...configKeys, 'alignMouseEventWithW3C'],
        compilerOptionsKeys,
        validate: (input) => input as Config & CompilerOptions & {
          alignMouseEventWithW3C: boolean;
        },
      }),
      pluginReactLynx({
        ...defaultReactPluginOptions,
        ...reactPluginOptions,
      } as any),
    ],
  });
}

export default createShowcaseConfig();
