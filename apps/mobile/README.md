# grail for Android (and iOS)

Native Expo app (SDK 58), with the same vault format and themes as the desktop app.
Notes live only on the phone, as plain markdown files: this `prod` build has no sync. A notebook
can be saved as a PDF snapshot and shared to Google Drive (Settings → About explains how).
The only network use is link previews, when the user asks for them (`src/linkpreview.tsx`).

```
src/App.tsx        fonts, tabs (Browse · Read · Tags), screen stack, Android back, + menu
src/data.tsx       the vault, notes, settings, saved views, Read order (same files as desktop)
src/store.ts       the vault on disk: files in the app's documents folder, atomic writes, native SHA-256
src/linkpreview.tsx link previews: asked for, fetched once, kept on the phone
src/markdown.tsx   a small native markdown renderer
src/ui.tsx         building blocks (spring presses, header, rows, fields)
src/screens/       Browse, Read, Tags, Editor, Settings + Sync
../../packages/core  shared with desktop and the server: note format, vault, sync client
```

## How it stays smooth

- **Native UI.** Lists are virtualised (`SectionList`/`FlatList`), rows are memoised, and
  images load from disk by file URI rather than as base64 strings in JS.
- **Off the JS thread.** Every press and screen transition runs in Reanimated on the UI thread.
- **Native hashing.** Sync checks files with the file system's SHA-256, so the bytes never
  pass through JS. Unchanged files aren't even read, because size and mtime are cached.
- **Live sync.** A streaming connection (`expo/fetch`) delivers edits from your other
  devices in about a second. When the app comes back to the foreground it catches up
  straight away, since Android pauses JS timers in the background.
- **Lean fonts.** Only the seven font weights in use are bundled.

## Build the APK

As for Anarchfy: Node, JDK 17 and the Android SDK, with `JAVA_HOME` and `ANDROID_HOME` set.
Release builds are signed with your key from `~/.gradle/gradle.properties`
(`GRAIL_RELEASE_STORE_FILE`, `GRAIL_RELEASE_STORE_PASSWORD`, `GRAIL_RELEASE_KEY_ALIAS`,
`GRAIL_RELEASE_KEY_PASSWORD`). You can point these at the same keystore as Anarchfy.

```
cd apps/mobile
npm ci
npx expo prebuild --platform android --no-install --clean
cd android
gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

For a build against the local playground (`npm run playground` at the repo root), set
`EXPO_PUBLIC_GRAIL_SYNC=http://<pc-ip>:8095` and `EXPO_PUBLIC_GRAIL_ID=http://<pc-ip>:8092`.
Cleartext HTTP is blocked in release builds, so use a debug build for that.

## Not yet on the phone


- Restoring something "taken out of the read".
