var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: [
    './index.js',
    './index.scss'
  ],

  output: {
    path: './build',
    filename: 'index-[hash].js'
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
        loader: ExtractTextPlugin.extract("style", ["css", "sass"])
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
  ]
};
