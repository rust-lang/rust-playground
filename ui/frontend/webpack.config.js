var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var CompressionPlugin = require("compression-webpack-plugin");
var autoprefixer = require('autoprefixer');

module.exports = {
  entry: [
    './index.js',
    './index.scss'
  ],

  output: {
    path: './build',
    filename: 'index-[hash].js'
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
    new HtmlWebpackPlugin({
      title: "Rust Playground",
      template: 'index.ejs'
    }),
    new ExtractTextPlugin("styles-[hash].css"),
    new webpack.EnvironmentPlugin(["NODE_ENV"])
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
