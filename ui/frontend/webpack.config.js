/* global process:false, __dirname:false */

const webpack = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const glob = require('glob');
const basename = require('basename');

const thisPackage = require('./package.json');
const devDependencies = Object.keys(thisPackage.devDependencies);

const allKeybindingNames =
      glob.sync('./node_modules/ace-builds/src-noconflict/keybinding-*.js')
      .map(basename)
      .map(n => n.replace(/^keybinding-/, ''));
const allThemeNames =
      glob.sync('./node_modules/ace-builds/src-noconflict/theme-*.js')
      .map(basename)
      .map(n => n.replace(/^theme-/, ''));

// There's a builtin/default keybinding that we call `ace`.
const allKeybindings = allKeybindingNames.concat(['ace']).sort();
const allThemes = allThemeNames;

// The name is nicer to debug with, but changing names breaks long-term-caching
const developmentFilenameTemplate = '[name]-[chunkhash]';
const productionFilenameTemplate = '[chunkhash]';

module.exports = function(_, argv) {
  const isProduction = argv.mode === 'production';
  const filenameTemplate =
        isProduction ?
        productionFilenameTemplate :
        developmentFilenameTemplate;

  const devtool =
        isProduction ?
        false :
        'inline-source-map';

  return {
    entry: {
      app: ['./index.tsx', './index.scss'],
    },

    devtool,

    output: {
      publicPath: 'assets/',
      path: `${__dirname}/build/assets`,
      filename: `${filenameTemplate}.js`,
      chunkFilename: `${filenameTemplate}.js`,
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
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
            "postcss-loader",
            "sass-loader",
          ],
        },
        {
          test: /\.svg$/,
          use: {
            loader: 'svg-url-loader',
            options: {
              noquotes: true,
            },
          },
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
        chunksSortMode: 'dependency',
      }),
      new CopyPlugin([
        { from: 'robots.txt', to: '..' },
      ]),
      new MiniCssExtractPlugin({
        filename: `${filenameTemplate}.css`,
        chunkFilename: `${filenameTemplate}.css`,
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
