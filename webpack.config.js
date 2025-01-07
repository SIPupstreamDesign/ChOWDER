require('babel-polyfill');
const path = require('path');
const webpack = require('webpack');
var NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')
var ExternalsPlugin = webpack.ExternalsPlugin

const DEBUG = process.argv.includes('--mode=development');
console.log("DEBUG=", DEBUG);

module.exports = {
    // モードの設定、v4系以降はmodeを指定しないと、webpack実行時に警告が出る
    mode: 'development',
    // エントリーポイントの設定
    entry: {
        "controller": './public/src/controller_app.js',
        "display": './public/src/display_app.js',
        "vrdisplay": ['@babel/polyfill', './public/src/vrdisplay_app.js'],
        "itowns": './public/src/itowns_app.js',
        "chowder_injection": ['@babel/polyfill', './public/src/chowder_itowns_injection.js'],
        "chowder_tileviewer_injection": ['@babel/polyfill', './public/src/chowder_tileviewer_injection.js'],
        "qgis": ['@babel/polyfill', './public/src/qgis_app.js'],
        "tileviewer": ['@babel/polyfill', './public/src/tileviewer_app.js'],
    },
    // 出力の設定
    output: {
        // 出力するファイル名
        filename: '[name].bundle.js',
        // 出力先のパス（v2系以降は絶対パスを指定する必要がある）
        path: path.join(__dirname, 'public')
    },
    module: {
        rules: [
            // CSSを読み込むローダー
            {
                test: /\.css$/,
                use: [
                    'style-loader', // スタイルをDOMに挿入
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: DEBUG, // ソースマップを有効化
                        },
                    },
                ],
            },
            // ファイルを読み込むローダー
            {
                test: /\.(jpg|png|gif)$/,
                use: ['url-loader'],
            },
            // jsを読み込むローダー
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: ['@babel/plugin-transform-runtime'],
                    }
                }
            }
        ],
    },
    devtool: DEBUG ? 'source-map' : false, // ソースマップを生成する
    // webpack-dev-serverの設定
    devServer: {
        contentBase: path.join(__dirname, 'public'),
        compress: true,
        port: 8080,
        open: true,
    },
    // 容量大きすぎるときの警告を出さないようにする
    performance: { hints: false },
    plugins: [
        new webpack.ProvidePlugin({
            THREE: 'three/build/three'
        }),
        new webpack.NoEmitOnErrorsPlugin(),
        new ExternalsPlugin('commonjs', [
            'app',
            'auto-updater',
            'browser-window',
            'content-tracing',
            'dialog',
            'global-shortcut',
            'ipc',
            'menu',
            'menu-item',
            'power-monitor',
            'protocol',
            'tray',
            'remote',
            'web-frame',
            'clipboard',
            'crash-reporter',
            'screen',
            'shell'
        ]),
        new NodeTargetPlugin()
    ],
};