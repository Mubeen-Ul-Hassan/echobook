const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for wasm files to resolver asset and source extensions
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts.push('wasm');

// Enhance middleware to add Cross-Origin headers required for SharedArrayBuffer / WASM Web Workers
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

module.exports = config;
