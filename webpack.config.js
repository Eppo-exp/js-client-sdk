/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  devtool: 'inline-source-map',
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
  plugins: [
    // Replace process.env.LOG_LEVEL with null (`process` is not defined in the browser env)
    new webpack.DefinePlugin({
      'process.env.LOG_LEVEL': null,
    }),
  ],
};
