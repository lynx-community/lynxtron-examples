import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  target: 'electron-main',
  entry: { main: './src/main.ts' },
  output: {
    path: path.resolve(dirname, 'dist/desktop'),
    filename: '[name].js',
  },
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: [/node_modules/],
      loader: 'builtin:swc-loader',
      options: { jsc: { parser: { syntax: 'typescript' } } },
      type: 'javascript/auto',
    }],
  },
  plugins: [new rspack.CopyRspackPlugin({
    patterns: [
      { from: './package.json', to: 'package.json' },
      { from: './output/bundle/lynx', to: '.' },
    ],
  })],
  resolve: { extensions: ['.ts', '.js'] },
});
