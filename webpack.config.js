const PATH = require('path');
const webpack = require('webpack');

const config = {
    target: 'web',
    entry: {
        index: './src/index.ts'
    },
    output: {
        path: PATH.resolve(__dirname, './build'),
        filename: '[name].js'
    },
    module: {
        rules: [
            { test: /\.ts$/, use: 'ts-loader' },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
            { test: /\.glsl$/, use: 'raw-loader' },
            { test: /\.html$/, use: 'raw-loader' },
            { test: /\.txt$/, use: 'raw-loader' }
        ]
    },
    resolve: {
        alias: {
            three: PATH.resolve(__dirname, 'node_modules/three')
        },
        extensions: ['.ts', '.js'],
        plugins: [
            new (require('tsconfig-paths-webpack-plugin'))()
        ]
    },
    plugins: []
};

function dev()
{
    config.mode = 'development';
    config.devtool = 'source-map';
    config.plugins.push(
        new (require('browser-sync-webpack-plugin'))({
            port: 8090,
            https: true,
            server: { baseDir: ['.'] },
            codeSync: true
        })
    );
}

function prod()
{
    config.mode = 'production';
    config.optimization = {
        minimize: true
    };
}

module.exports = (env) => {
    const isProd = Boolean(env.production);
    console.log('Production: ', isProd);

    const pkg = require('./package.json');
    const envVars = {
        'process.env.SEM_VERSION': JSON.stringify(pkg.version),
        'process.env.TARGET': JSON.stringify(isProd ? 'production' : 'staging')
    };
    config.plugins.push(new webpack.DefinePlugin(envVars));

    if(isProd) prod();
    else dev();

    return config;
};
