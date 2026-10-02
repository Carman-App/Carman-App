// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Error monitoring is off without a DSN, so don't bundle Sentry at all then:
// resolve it to a no-op stand-in (src/lib/sentry-off.ts). Saves ~470 modules
// on every bundle. Set EXPO_PUBLIC_SENTRY_DSN to bundle the real SDK.
if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
  const stub = path.resolve(__dirname, 'src/lib/sentry-off.ts');
  const resolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@sentry/react-native') return { type: 'sourceFile', filePath: stub };
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
