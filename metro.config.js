const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
  stream: require.resolve('stream-browserify'),
  process: require.resolve('./process-shim.js'),
  events: require.resolve('events'),
  util: require.resolve('util'),
  url: require.resolve('url'),
  path: require.resolve('path-browserify'),
  assert: require.resolve('assert'),
};

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
