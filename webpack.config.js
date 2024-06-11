/* eslint-disable @typescript-eslint/no-var-requires, no-undef */
const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const sourceMaps = new webpack.SourceMapDevToolPlugin({
  filename: '[file].map[query]',
});

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  devtool: false,
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'eppo-sdk.js',
    library: {
      name: 'eppo',
      type: 'var',
    },
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins: [sourceMaps],
};
