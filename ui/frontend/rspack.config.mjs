/* global process:false, __dirname:false */

const rspack = require('@rspack/core');
const { CompressionRspackPlugin } = require('compression-rspack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
const fs = require('node:fs');
const path = require('node:path');

const allKeybindingNames = fs
  .globSync('./node_modules/ace-builds/src-noconflict/keybinding-*.js')
  .map((n) => path.basename(n))
  .map((n) => n.replace(/^keybinding-/, ''))
  .map((n) => n.replace(/.js$/, ''));
const allThemeNames = fs
  .globSync('./node_modules/ace-builds/src-noconflict/theme-*.js')
  .map((n) => path.basename(n))
  .map((n) => n.replace(/^theme-/, ''))
  .map((n) => n.replace(/.js$/, ''));
// There's a builtin/default keybinding that we call `ace`.
const allKeybindings = allKeybindingNames.concat(['ace']).sort();
const allThemes = allThemeNames;

// The name is nicer to debug with, but changing names breaks long-term-caching
const developmentFilenameTemplate = '[name]-[contenthash]';
const developmentChunkFilenameTemplate = '[name]-[chunkhash]';

const productionFilenameTemplate = '[contenthash]';
const productionChunkFilenameTemplate = '[chunkhash]';

module.exports = function (_, argv) {
  const isProduction = argv.mode === 'production';
  const filenameTemplate = isProduction ? productionFilenameTemplate : developmentFilenameTemplate;
  const chunkFilenameTemplate = isProduction
    ? productionChunkFilenameTemplate
    : developmentChunkFilenameTemplate;

  const devtool = isProduction ? false : 'inline-source-map';

  return {
    entry: './index.tsx',

    devtool,

    cache: {
      type: 'persistent',

      buildDependencies: [__filename],
    },

    output: {
      publicPath: 'assets/',
      path: `${__dirname}/build/assets`,
      filename: `${filenameTemplate}.js`,
      chunkFilename: `${chunkFilenameTemplate}.js`,
    },

    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },

    module: {
      rules: [
        {
          test: /\.(?:js|mjs|jsx|ts|tsx)$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  transform: {
                    react: {
                      runtime: 'automatic',
                      development: !isProduction,
                    },
                    reactCompiler: {
                      compilationMode: 'annotation',
                    },
                  },
                },
                detectSyntax: 'auto',
              },
            },
          ],
        },
        {
          test: /\.css$/,
          oneOf: [
            // Prism styles as separate files for the shadow DOM
            {
              test: [/prismjs\/themes/, /prismjs-overrides.css$/],
              type: 'asset/resource',
            },

            // Any other CSS
            {
              use: ['postcss-loader'],
              type: 'css/auto',
            },
          ],
        },
        // This inlines the codicon.ttf file from Monaco. Using a
        // regular file fails because it looks for
        // `/assets/assets/...`. Inlining saves a file, and it's
        // pretty small compared to the rest of Monaco.
        {
          test: /\.ttf$/,
          include: /node_modules\/monaco-editor/,
          type: 'asset/inline',
        },
        {
          test: /\.svg$/,
          type: 'asset/inline',
        },
      ],
    },

    plugins: [
      new TsCheckerRspackPlugin(),
      new rspack.DefinePlugin({
        ACE_KEYBINDINGS: JSON.stringify(allKeybindings),
        ACE_THEMES: JSON.stringify(allThemes),
      }),
      new rspack.HtmlRspackPlugin({
        title: 'Rust Playground',
        template: 'index.ejs',
        filename: '../index.html',
      }),
      new rspack.CopyRspackPlugin({
        patterns: [{ from: 'robots.txt', to: '..' }],
      }),
      new MonacoWebpackPlugin({
        filename: `${filenameTemplate}.worker.js`,
        languages: ['rust'],
      }),
      ...(isProduction ? [new CompressionRspackPlugin()] : []),
    ],

    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
  };
};
