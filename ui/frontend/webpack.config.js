var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './index.js',

  output: {
    path: './build',
    filename: 'index.js'
  },

  module: {
    loaders: [
      {
        test: [/\.js$/, /\.jsx$/],
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      title: "Rust Playground",
      template: 'index.ejs'
    })
  ]
};
