import { defineConfig } from '@lynx-js/rspeedy';
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { compilerOptionsKeys, configKeys, type CompilerOptions, type Config } from '@lynx-js/type-config';

export function createShowcaseConfig(options?: {
  entry?: string;
  /**
   * Multi-entry showcases (one Lynx bundle per screen) pass the whole entry map
   * here instead of `entry`. The map must contain a chunk literally named
   * `main` — the Lynx template toolchain asserts on its existence.
   */
  entries?: Record<string, string>;
  web?: boolean;
  lynxDistPath?: string;
  server?: Record<string, any>;
  reactPluginOptions?: Record<string, any>;
  /** Compile-time constants injected into the Lynx bundle. */
  sourceDefine?: Record<string, string>;
}) {
  const entryMap = options?.entries ?? { main: options?.entry ?? './src/app/index.tsx' };
  const lynxOutput: Record<string, any> = {};
  if (options?.lynxDistPath) {
    lynxOutput.distPath = { root: options.lynxDistPath };
  }
  const environments: Record<string, any> = {
    lynx: {
      source: {
        entry: entryMap,
        ...(options?.sourceDefine ? { define: options.sourceDefine } : {}),
      },
      ...(Object.keys(lynxOutput).length ? { output: lynxOutput } : {}),
    },
  };
  if (options?.web) {
    environments.web = {
      source: { entry: entryMap },
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
    enableCSSInlineVariables: true,
  };
  return defineConfig({
    output: { filename: '[name].[platform].bundle' },
    environments,
    ...(options?.server ? { server: options.server } : {}),
    plugins: [
      pluginLynxConfig(defaultLynxConfig, {
        configKeys: [...configKeys, 'alignMouseEventWithW3C', 'enableCSSInlineVariables'],
        compilerOptionsKeys,
        validate: (input) => input as Config & CompilerOptions & {
          alignMouseEventWithW3C: boolean;
          enableCSSInlineVariables: boolean;
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
