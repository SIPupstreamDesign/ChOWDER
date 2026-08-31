const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

class WatchHtmlTemplatesPlugin {
  constructor(files) {
    this.files = files;
  }
  apply(compiler) {
    compiler.hooks.afterCompile.tap('WatchHtmlTemplatesPlugin', (compilation) => {
      this.files.forEach(file => compilation.fileDependencies.add(file));
    });
  }
}

class CopyITownsAssetsPlugin {
  constructor(options = {}) {
    this.sourceRoot = options.sourceRoot;
    this.targetRoot = options.targetRoot;
  }

  apply(compiler) {
    compiler.hooks.afterCompile.tap('CopyITownsAssetsPlugin', (compilation) => {
      const sourceDirs = this.getSourceDirs();
      sourceDirs.forEach((dir) => {
        compilation.contextDependencies.add(dir);
      });
    });

    compiler.hooks.afterEmit.tap('CopyITownsAssetsPlugin', () => {
      const sourceDirs = this.getSourceDirs();
      fs.mkdirSync(this.targetRoot, { recursive: true });
      sourceDirs.forEach((sourceDir) => {
        const destDir = path.join(this.targetRoot, path.basename(sourceDir));
        fs.cpSync(sourceDir, destDir, { recursive: true, force: true });
      });
    });
  }

  getSourceDirs() {
    const entries = fs.readdirSync(this.sourceRoot, { withFileTypes: true });
    return entries
      .filter((entry) => {
        return entry.isDirectory();
      })
      .map((entry) => {
        return path.join(this.sourceRoot, entry.name);
      });
  }
}

module.exports = (_env, argv) => {
  const mode = argv.mode || 'development';
  const isProduction = mode === 'production';
  const distClientPath = path.resolve(__dirname, 'dist/client');
  const sourceITownsPath = path.resolve(__dirname, 'src/client/itowns');
  const targetITownsPath = path.resolve(distClientPath, 'itowns');

  return {
    mode,
    name: 'client',
    entry: {
      index: './src/client/index.ts',
      controller: './src/client/controller/controller.ts',
      display: './src/client/display/display.ts',
      itowns: './src/client/itowns/index.ts',
      chowder_injection: [
        './src/client/itowns/src/polyfill.js',
        './src/client/itowns/src/chowder_itowns_injection.ts'
      ],
    },
    target: 'web',
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webpack.json'
            }
          },
          include: [
            path.resolve(__dirname, 'src/client'),
            path.resolve(__dirname, 'src/common')
          ],
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-transform-runtime'],
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                sourceMap: !isProduction,
              },
            },
          ],
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024,
            },
          },
          generator: {
            filename: 'images/[name].[hash:8][ext]',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        "stream": false,
        "buffer": false,
        "util": false
      }
    },
    output: {
      filename: '[name].bundle.js',
      path: distClientPath,
      publicPath: '/',
      clean: true,
    },
    plugins: [
      new webpack.ProvidePlugin({
        THREE: 'three/build/three'
      }),
      new WatchHtmlTemplatesPlugin([
        path.resolve(__dirname, 'src/client/index.html'),
        path.resolve(__dirname, 'src/client/controller/controller.html'),
        path.resolve(__dirname, 'src/client/display/display.html'),
        path.resolve(__dirname, 'src/client/itowns/index.html'),
      ]),
      new CopyITownsAssetsPlugin({
        sourceRoot: sourceITownsPath,
        targetRoot: targetITownsPath,
      }),
      new HtmlWebpackPlugin({
        template: './src/client/index.html',
        filename: 'index.html',
        chunks: ['index'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        template: './src/client/controller/controller.html',
        filename: 'controller.html',
        chunks: ['controller'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        template: './src/client/display/display.html',
        filename: 'display.html',
        chunks: ['display'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        template: './src/client/itowns/index.html',
        filename: 'itowns/index.html',
        chunks: ['itowns'],
        inject: 'body',
      }),
    ],
    performance: { hints: false },
  };
};
