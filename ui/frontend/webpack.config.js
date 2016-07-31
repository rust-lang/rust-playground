/* global process:false */

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const autoprefixer = require('autoprefixer');
const glob = require('glob');
const basename = require('basename');

const thisPackage = require('./package.json');
const vendorLibraries = Object.keys(thisPackage.dependencies);

// There's a builtin/default keybinding that we call `ace`.
const allKeybindingFiles = glob.sync('./node_modules/brace/keybinding/*.js');
const allKeybindings = allKeybindingFiles.map(basename).concat(['ace']).sort();

const allThemeFiles = glob.sync('./node_modules/brace/theme/*.js');
const allThemes = allThemeFiles.map(basename);

module.exports = {
  entry: {
    app: ['./index.js', './index.scss'],
    vendor: vendorLibraries,
  },

  output: {
    path: './build',
    filename: '[name]-[chunkhash].js',
    chunkFilename: '[chunkhash].js',
  },

  resolve: {
    extensions: ['', '.js', '.jsx'],
  },

  module: {
    loaders: [
      {
        test: [/\.js$/, /\.jsx$/],
        exclude: /node_modules/,
        loader: 'babel',
      },
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract("style", ["css", "postcss", "sass"]),
      },
    ],
  },

  plugins: [
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new webpack.DefinePlugin({
      ACE_KEYBINDINGS: JSON.stringify(allKeybindings),
      ACE_THEMES: JSON.stringify(allThemes),
    }),
    new HtmlWebpackPlugin({
      title: "Rust Playground",
      template: 'index.ejs',
      chunksSortMode: 'dependency',
    }),
    new ExtractTextPlugin("styles-[chunkhash].css"),
    new webpack.optimize.CommonsChunkPlugin({
      names: ['vendor', 'manifest'],
    }),
  ],

  postcss: function () {
    return [autoprefixer];
  },
};

if (process.env.NODE_ENV === 'production') {
  module.exports.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
      },
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new CompressionPlugin({ algorithm: 'zopfli' })
  );
}
