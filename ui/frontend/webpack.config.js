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
  }
};
