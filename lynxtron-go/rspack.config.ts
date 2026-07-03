/// <reference path="./tsconfig.tools.json" />

import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pluginLynxtron } from '@lynx-js/lynxtron-dev-plugins/rspack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === 'development';
const scintillaNativeModulePath = path.resolve(__dirname, './scintilla-extension/build/Release/lynx_scintilla_module.node');
const scintillaRuntimePatterns: Array<{ from: string; to: string }> = [
  { from: './scintilla-extension/package.json', to: 'node_modules/lynxtron-scintilla-editor/package.json' },
  { from: './scintilla-extension/index.cjs', to: 'node_modules/lynxtron-scintilla-editor/index.cjs' },
  ...(fs.existsSync(scintillaNativeModulePath)
    ? [{
        from: scintillaNativeModulePath,
        to: 'node_modules/lynxtron-scintilla-editor/build/Release/lynx_scintilla_module.node',
      }]
    : []),
];


const desktopConfig = defineConfig({
  target: 'electron-main',
  entry: {
    main: './src/main/desktop/main.ts',
    preload: './src/main/desktop/preload.ts',
    'showcase-web-server': './src/main/desktop/showcase-web-server.ts',
    'extension-host': './src/extension-host/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist/desktop/'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.svg$/,
        type: 'asset',
      },
    ],
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './src/main/desktop/package.runtime.json', to: 'package.json' },
        { from: './output/bundle/lynx/', to: '.' },
        // Keep only the Scintilla extension runtime closure in dist/desktop.
        ...scintillaRuntimePatterns,
        // Keep appPackage dependencies physically present under dist/desktop/node_modules
        // so lynxtron-builder/electron-builder dependency collection can resolve paths.
        { from: './node_modules/prismjs/', to: 'node_modules/prismjs/' },
        { from: './node_modules/vscode-css-languageservice/', to: 'node_modules/vscode-css-languageservice/' },
        { from: './node_modules/vscode-languageserver-types/', to: 'node_modules/vscode-languageserver-types/' },
        { from: './node_modules/vscode-languageserver-textdocument/', to: 'node_modules/vscode-languageserver-textdocument/' },
      ],
    }),
    ...(isDev ? [pluginLynxtron({
      isDev,
      entry: path.resolve(__dirname, './dist/desktop'),
      args: isDev ? ['--inspect=9222'] : [],
    })] : []),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  optimization: {
    minimize: !isDev,
    nodeEnv: false,
  },
  externals: {
    'lynxtron-scintilla-editor': 'commonjs lynxtron-scintilla-editor',
    'lynxtron': 'commonjs lynxtron',
    '@lynx-js/lynxtron': 'commonjs @lynx-js/lynxtron',
    '@lynx-js/lynxtron/context-bridge': 'commonjs @lynx-js/lynxtron/context-bridge',
    '@lynxtron-showcases/cli/dist/index.js': 'commonjs @lynxtron-showcases/cli/dist/index.js',
    'typescript': 'commonjs typescript',
    'vscode-css-languageservice': 'commonjs vscode-css-languageservice',
    'vscode-languageserver-types': 'commonjs vscode-languageserver-types',
    'vscode-languageserver-textdocument': 'commonjs vscode-languageserver-textdocument',
  },
});

const targets = (process.env.TARGET_ENV || 'desktop,web').split(',');

const configs = [];
if (targets.includes('desktop')) {
  configs.push(desktopConfig);
}
if (targets.includes('web')) {
}

export default configs;
