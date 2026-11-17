// Signs release builds with our own key instead of the public debug key every Expo project shares (anyone
// holding that one could ship an "update" over this app). The key and its password live outside the project,
// in the user's ~/.gradle/gradle.properties (GRAIL_RELEASE_*) or the pipeline's environment.
// Without them the release APK comes out unsigned (app-release-unsigned.apk): that's what F-Droid builds,
// since it signs every app with its own key.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = config => withAppBuildGradle(config, c => {
  let g = c.modResults.contents;
  if (g.includes('GRAIL_RELEASE_STORE_FILE')) return c;
  g = g.replace('signingConfigs {', `signingConfigs {
        release {
            if (project.hasProperty('GRAIL_RELEASE_STORE_FILE')) {
                storeFile file(GRAIL_RELEASE_STORE_FILE)
                storePassword GRAIL_RELEASE_STORE_PASSWORD
                keyAlias GRAIL_RELEASE_KEY_ALIAS
                keyPassword GRAIL_RELEASE_KEY_PASSWORD
            }
        }`);
  // In buildTypes { release { ... } }: our key when it's there, otherwise no signature at all (never the debug key).
  const types = g.indexOf('buildTypes {');
  const release = g.indexOf('release {', types);
  const debugKey = g.indexOf('signingConfig signingConfigs.debug', release);
  if (types < 0 || release < 0 || debugKey < 0) throw new Error('release-signing: build.gradle layout changed');
  g = g.slice(0, debugKey)
    + "signingConfig project.hasProperty('GRAIL_RELEASE_STORE_FILE') ? signingConfigs.release : null"
    + g.slice(debugKey + 'signingConfig signingConfigs.debug'.length);
  c.modResults.contents = g;
  return c;
});
