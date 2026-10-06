const path = require('node:path');

const dependencyRoot = path.resolve(__dirname, '../../vendor/itowns/node_modules');

module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, 'itownsEntry.mjs'),
    output: {
        path: path.resolve(__dirname, '../client/itowns/itowns'),
        filename: 'itowns.js',
        library: { name: 'itowns', type: 'umd' },
        globalObject: 'globalThis',
        clean: { keep: /^(debug\.|itowns\.zip$)/ },
    },
    devtool: 'source-map',
    resolve: {
        alias: { three: path.join(dependencyRoot, 'three') },
        fallback: { fs: false, path: false },
    },
    module: {
        rules: [
            {
                test: /itowns\/lib\/Core\/View\.js$/,
                use: path.resolve(__dirname, 'itownsRenderingAreaLoader.cjs'),
            },
            { test: /\.glsl$/, type: 'asset/source' },
        ],
    },
    performance: { hints: false },
};