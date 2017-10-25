/* global process:false, __dirname:false */

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const ZopfliPlugin = require("zopfli-webpack-plugin");
const glob = require('glob');
const basename = require('basename');

const thisPackage = require('./package.json');
const devDependencies = Object.keys(thisPackage.devDependencies);

const allKeybindingNames = glob.sync('./node_modules/brace/keybinding/*.js').map(basename);
const allThemeNames = glob.sync('./node_modules/brace/theme/*.js').map(basename);

// There's a builtin/default keybinding that we call `ace`.
const allKeybindings = allKeybindingNames.concat(['ace']).sort();
const allThemes = allThemeNames;

module.exports = {
  entry: {
    app: ['./index.tsx', './index.scss'],
  },

  output: {
    publicPath: 'assets/',
    path: `${__dirname}/build/assets`,
    filename: '[name]-[chunkhash].js',
    chunkFilename: '[chunkhash].js',
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
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ["css-loader", "postcss-loader", "sass-loader"]
        }),
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
    new webpack.EnvironmentPlugin({ NODE_ENV: 'development' }),
    new webpack.DefinePlugin({
      ACE_KEYBINDINGS: JSON.stringify(allKeybindings),
      ACE_THEMES: JSON.stringify(allThemes),
    }),
    new HtmlWebpackPlugin({
      title: "Rust Playground",
      template: 'index.ejs',
      filename: '../index.html',
      chunksSortMode: 'dependency',
    }),
    new CopyWebpackPlugin([
      { from: 'robots.txt', to: '..' },
    ]),
    new ExtractTextPlugin("styles-[chunkhash].css"),
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      minChunks: module => {
        const { context } = module;
        if (!context) { return false; }

        // Ignore files that are not from a third-party package
        if (context.indexOf("node_modules") === -1) { return false; }

        // Ignore development dependencies
        const isDevDependency = depName => context.indexOf(depName) !== -1;
        if (devDependencies.some(isDevDependency)) { return false; }

        return true;
      },
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      minChunks: Infinity
    }),
  ],
};

if (process.env.NODE_ENV === 'production') {
  module.exports.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false,
      },
    }),
    new ZopfliPlugin(),
  );
}
