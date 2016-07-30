/* global process:false */

var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var CompressionPlugin = require("compression-webpack-plugin");
var autoprefixer = require('autoprefixer');
var glob = require('glob');
var basename = require('basename');

const thisPackage = require('./package.json');
const vendorLibraries = Object.keys(thisPackage.dependencies);

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
    chunkFilename: '[chunkhash].js'
  },

  resolve: {
    extensions: ['', '.js', '.jsx']
  },

  module: {
    loaders: [
      {
        test: [/\.js$/, /\.jsx$/],
        exclude: /node_modules/,
        loader: 'babel'
      },
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract("style", ["css", "postcss", "sass"])
      }
    ]
  },

  plugins: [
    new webpack.EnvironmentPlugin(["NODE_ENV"]),
    new webpack.DefinePlugin({
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
  }
};

if (process.env.NODE_ENV === 'production') {
  module.exports.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new CompressionPlugin({algorithm: 'zopfli'})
  );
}
