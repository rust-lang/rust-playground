/* global process:false, __dirname:false */

const webpack = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const { globSync } = require('glob');
const basename = require('basename');

const thisPackage = require('./package.json');
const devDependencies = Object.keys(thisPackage.devDependencies);

const allKeybindingNames =
      globSync('./node_modules/ace-builds/src-noconflict/keybinding-*.js')
      .map(basename)
      .map(n => n.replace(/^keybinding-/, ''));
const allThemeNames =
      globSync('./node_modules/ace-builds/src-noconflict/theme-*.js')
      .map(basename)
      .filter(n => !n.endsWith('-css'))
      .map(n => n.replace(/^theme-/, ''));

// There's a builtin/default keybinding that we call `ace`.
const allKeybindings = allKeybindingNames.concat(['ace']).sort();
const allThemes = allThemeNames;

// The name is nicer to debug with, but changing names breaks long-term-caching
const developmentFilenameTemplate = '[name]-[contenthash]';
const developmentChunkFilenameTemplate = '[name]-[chunkhash]';

const productionFilenameTemplate = '[contenthash]';
const productionChunkFilenameTemplate = '[chunkhash]';

module.exports = function(_, argv) {
  const isProduction = argv.mode === 'production';
  const filenameTemplate =
        isProduction ?
        productionFilenameTemplate :
        developmentFilenameTemplate;
  const chunkFilenameTemplate =
        isProduction ?
        productionChunkFilenameTemplate :
        developmentChunkFilenameTemplate;

  const devtool =
        isProduction ?
        false :
        'inline-source-map';

  const localIdentName = isProduction ?
         "[hash:base64]" :
         "[path][name]__[local]--[hash:base64]";

  return {
    entry: './index.tsx',

    devtool,

    cache: {
      type: 'filesystem',

      buildDependencies: {
        config: [__filename],
      },
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
          test: [/\.js$/, /\.jsx$/],
          exclude: /node_modules/,
          use: 'babel-loader',
        },
        {
          test: [/\.ts$/, /\.tsx$/],
          exclude: /node_modules/,
          use: ['babel-loader', 'ts-loader'],
        },
        {
          test: /\.css$/,
          oneOf: [
            {
              test: /prismjs\/themes/,
              type: 'asset/resource',
            },
            {
              test: /\.module.css$/,
              exclude: /node_modules/,
              use: [
                MiniCssExtractPlugin.loader,
                {
                  loader: "css-loader",
                  options: {
                    modules: {
                      localIdentName,
                    },
                  },
                },
                "postcss-loader",
              ],
            },
            {
              include: /node_modules/,
              use: [
                MiniCssExtractPlugin.loader,
                "css-loader",
                "postcss-loader",
              ],
            },
          ]
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
      new webpack.DefinePlugin({
        ACE_KEYBINDINGS: JSON.stringify(allKeybindings),
        ACE_THEMES: JSON.stringify(allThemes),
      }),
      new HtmlPlugin({
        title: "Rust Playground",
        template: 'index.ejs',
        filename: '../index.html',
      }),
      new CopyPlugin({
        patterns: [
          { from: 'robots.txt', to: '..' },
        ],
      }),
      new MiniCssExtractPlugin({
        filename: `${filenameTemplate}.css`,
        chunkFilename: `${chunkFilenameTemplate}.css`,
      }),
      new MonacoWebpackPlugin({
        filename: `${filenameTemplate}.worker.js`,
        languages: [],
      }),
      ...(isProduction ? [new CompressionPlugin()] : []),
    ],

    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
  };
};
