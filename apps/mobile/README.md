# grail for Android

Native Expo app (SDK 58, React Native 0.88), with the same notes format and themes as the desktop app.
Notes live only on the phone, as plain markdown files; there is no account and no sync. A notebook can be saved
as a PDF snapshot and shared, for example to Google Drive (Settings → About explains how). The only network use
is link previews, when the user asks for them (`src/linkpreview.tsx`).

```
src/App.tsx          fonts, tabs (Browse · Read · Tags), screen stack, Android back, + menu
src/data.tsx         the home (notes folder), notes, settings, saved views, Read order (same files as desktop)
src/store.ts         the home on disk: grail's own folder, or a picked one (Android's folder picker)
src/screens/Welcome.tsx  first start: the tour, the folder choice, which folder is in use
src/linkpreview.tsx  link previews: asked for, fetched once, kept on the phone
src/markdown.tsx     a small native markdown renderer
src/ui.tsx           building blocks (spring presses, header, rows, fields)
src/screens/         Browse, Read, Tags, Editor, Draw, TableEditor, Settings
plugins/             Expo config plugins: release signing, short native paths, no dependencies-info block
../../packages/core  shared with desktop: note format, the home, tags, themes, drawings
```

## How it stays smooth

- **Native UI.** Lists are virtualised (`SectionList`/`FlatList`), rows are memoised, and images load from disk by
  file URI rather than as base64 strings in JS.
- **Off the JS thread.** Every press and screen transition runs in Reanimated on the UI thread. In the drawing
  canvas, the stroke in progress is drawn on the UI thread too (react-native-svg + Reanimated), so ink follows
  the finger at display rate.
- **Lean fonts.** Only the font weights in use are bundled.

## Build the APK

Node 22 or newer, JDK 17 (or 21) and the Android SDK, with `JAVA_HOME` and `ANDROID_HOME` set.
Release builds are signed with your key from `~/.gradle/gradle.properties`
(`GRAIL_RELEASE_STORE_FILE`, `GRAIL_RELEASE_STORE_PASSWORD`, `GRAIL_RELEASE_KEY_ALIAS`,
`GRAIL_RELEASE_KEY_PASSWORD`); without them the release APK comes out unsigned. Keep the keystore and its
password out of the repository and backed up somewhere safe.

```
cd apps/mobile
npm ci
npx expo prebuild --platform android --no-install --clean
cd android
gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

`APP_ENV` (`dev`, `qa`, `staging`; prod when unset) picks the app's name and ID, and `VERSION_CODE` overrides the
version code from `app.json`. On Windows, `scripts/build-apk.ps1 [-Install] [-Bundle] [-Arch x86_64]` does the
whole build with a local toolchain.

## Not yet on the phone

- Restoring something "taken out of the read".
