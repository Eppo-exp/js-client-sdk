import path from 'path';

import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';

export default {
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
    fallback: {
      buffer: 'buffer',
    },
  },
  output: {
    filename: 'js-sdk.js',
    library: {
      name: 'jsSdk',
      type: 'var',
    },
    path: path.resolve('dist'),
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
};
