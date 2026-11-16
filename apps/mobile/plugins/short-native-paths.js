// Windows can't handle paths over 260 characters, and the object files of the C++ build get there easily (generated
// sources outside the build directory end up with their whole path in the object's). For Android, CMake leaves them
// as long as they come unless told otherwise; with a maximum it replaces the long part with a hash.
//
// grail also caps every native library module (Reanimated, Skia, Worklets…), not just the app: their object paths
// embed node_modules/<lib>/… and are the ones that overflow.
const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const ARG = '-DCMAKE_OBJECT_PATH_MAX=240';

const withApp = config => withAppBuildGradle(config, c => {
  const g = c.modResults.contents;
  if (g.includes('CMAKE_OBJECT_PATH_MAX')) return c;
  const marker = 'defaultConfig {';
  if (!g.includes(marker)) throw new Error('short-native-paths: build.gradle layout changed');
  const withCap = g.replace(marker, `${marker}
        externalNativeBuild {
            cmake {
                arguments "${ARG}"
            }
        }`);
  // The app module is evaluated before the root project's hooks run: set its short build folder here.
  const android = /^android \{$/m;
  if (!android.test(withCap)) throw new Error('short-native-paths: build.gradle layout changed (android block)');
  c.modResults.contents = withCap.replace(android, `android {
    if (System.getenv('GRAIL_CXX_DIR')) {
        externalNativeBuild { cmake { buildStagingDirectory = new File(System.getenv('GRAIL_CXX_DIR'), 'app') } }
    }`);
  return c;
});

const withLibraries = config => withProjectBuildGradle(config, c => {
  const g = c.modResults.contents;
  if (g.includes('CMAKE_OBJECT_PATH_MAX')) return c;
  // The cap alone isn't enough when the build folder's own path is long (CMake needs room to fit the hashed name),
  // so with GRAIL_CXX_DIR set (scripts/build-apk.ps1 does) every module builds its C++ under a short folder.
  c.modResults.contents = `${g}
// Keep C++ object paths of native modules under Windows' 260-character limit.
def grailCxx = System.getenv('GRAIL_CXX_DIR')
subprojects { p ->
  p.plugins.withId('com.android.library') {
    p.android.defaultConfig.externalNativeBuild.cmake.arguments.add('${ARG}')
    if (grailCxx) {
      try { p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(grailCxx, p.name) }
      catch (e) { logger.warn("short-native-paths: \${p.name} was configured too early for a short build folder") }
    }
  }
}
`;
  return c;
});

module.exports = config => withLibraries(withApp(config));
