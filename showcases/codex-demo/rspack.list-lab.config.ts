import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  target: 'electron-main',
  entry: { main: './labs/bidirectional-list/main.ts' },
  output: {
    path: path.resolve(__dirname, 'dist/list-lab'),
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
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './output/list-lab/main.lynx.bundle', to: 'main.lynx.bundle' },
        {
          from: './labs/bidirectional-list/package.json',
          to: 'package.json',
        },
      ],
    }),
  ],
  resolve: { extensions: ['.ts', '.js'] },
});
