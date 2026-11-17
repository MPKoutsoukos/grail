// The Android build tools add a "dependencies info" block to every APK: a list of the app's libraries,
// encrypted with a key only Google can read. Nobody else can check what it says, so F-Droid rejects it,
// and grail has no use for it either. Off for both APKs and bundles.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = config => withAppBuildGradle(config, c => {
  let g = c.modResults.contents;
  if (g.includes('dependenciesInfo')) return c;
  const android = g.indexOf('android {');
  if (android < 0) throw new Error('no-dependencies-info: build.gradle has no android { } block');
  const at = android + 'android {'.length;
  g = g.slice(0, at) + `
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }` + g.slice(at);
  c.modResults.contents = g;
  return c;
});
