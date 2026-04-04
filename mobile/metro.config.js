const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf', 'png', 'jpg', 'tflite'];

module.exports = config;