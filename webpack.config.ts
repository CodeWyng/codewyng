import path from 'path'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import CopyPlugin from 'copy-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
const WebpackMessages = require('webpack-messages')
import { DefinePlugin } from 'webpack'
import { execSync } from 'child_process'
import { padStart } from 'lodash'
import _ from 'lodash'
const ExtensionReloader = require('webpack-extension-reloader')

module.exports = (env: any, argv: any) => {
  const dev = argv.mode === 'development'
  const commit = execSync('git rev-parse HEAD').toString().trim()

  if (dev && !process.env['CODEWING_URL']) throw new Error('🚨 must set CODEWING_URL in development')
  const CODEWING_URL = dev ? process.env['CODEWING_URL'] : 'https://api.codewing.dev'

  return {
    entry: {
      content: './src/content.tsx',
      background: './src/background.ts',
      popup: './src/popup.tsx',
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, dev ? 'dist-dev' : 'dist-prod'),
    },
    // The default source map uses eval, which violates some browser CSP
    ...(dev ? { devtool: 'inline-source-map' } : {}),
    plugins: _.compact([
      new CleanWebpackPlugin({
        // Otherwise it deletes CopyPlugin's files on each build
        cleanStaleWebpackAssets: false,
      }),
      dev ? new ExtensionReloader({ entries: { contentScript: 'content' } }) : undefined,
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest.json',
            transform: buffer => {
              const manifest = JSON.parse(buffer.toString())
              const now = new Date()

              const n2 = (n: number) => padStart(n.toString(), 2, '0')
              const y = now.getUTCFullYear()
              const mo = now.getUTCMonth() + 1
              const d = now.getUTCDate()
              const h = now.getUTCHours()
              const min = now.getUTCMinutes()
              const s = now.getUTCSeconds()
              const minuteOftsay = h * 60 + min

              manifest['version'] = `${y}.${mo}.${d}.${minuteOftsay}`
              manifest['version_name'] = `${y}-${n2(mo)}-${n2(d)}T${n2(h)}:${n2(min)}:${n2(s)}Z ${commit.slice(0, 7)}`

              return JSON.stringify(manifest, null, 2)
            },
          },
          { from: 'icon-128.png' },
          { from: 'src/custom.css' },
        ],
      }),
      new HtmlWebpackPlugin({
        title: 'CodeWing',
        template: 'src/popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new ForkTsCheckerWebpackPlugin({ async: false }),
      new WebpackMessages(),
      new DefinePlugin({
        SERVER_URL: JSON.stringify(CODEWING_URL),
        DEV: JSON.stringify(dev),
      }),
    ]),
    devServer: {
      contentBase: './dist-dev',
      writeToDisk: true,
      // hot and inline cause a crash loop in the browser extension
      hot: false,
      inline: false,
    },
    // less noise
    stats: 'errors-only',
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { chrome: '83' } }],
              '@babel/preset-typescript',
              '@babel/preset-react',
            ],
            plugins: ['@babel/plugin-proposal-nullish-coalescing-operator', '@babel/plugin-proposal-optional-chaining'],
          },
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          use: [
            {
              loader: 'file-loader',
            },
          ],
        },
        {
          test: /\.svg$/,
          use: [
            {
              loader: '@svgr/webpack',
            },
          ],
        },
      ],
    },
    watchOptions: {
      ignored: /node_modules/,
    },
  }
}
