# grail

**Quiet, local-first notes that gather into one continuous read.**

grail is for long-running creative work that lives in fragments: ideas, characters, places, half-formed lore,
things overheard. Every note is a plain markdown file on your own device. There's no account, no ads and no
tracking.

**Download:** the latest Android app is on the [Releases page](https://github.com/MPKoutsoukos/grail/releases/latest).
The desktop app for Windows and Linux is in [grail-desktop](https://github.com/MPKoutsoukos/grail-desktop/releases/latest).

## Why

Ideas rarely arrive when there is time for them. They turn up on a bus, half asleep, in the middle of something
else, and land wherever is nearest. grail starts from a simple idea: creativity isn't a gift, it's a system. You
don't wait for the one big idea; you build a place where small ones are kept, found again and set next to each
other until they turn into something. grail is that place.

Inspired by [“Creativity isn’t a gift, it’s a system”](https://www.youtube.com/watch?v=_QVYfPnNOg4) by Perry Daniels.
The full story is in the app, under Settings → About grail.

## What it does

- **Browse**: every fragment, grouped by when you touched it, with search. An **Echo** at the top brings back an
  older fragment, anniversaries first.
- **Read**: your fragments stitched into one continuous text, titles hidden, set in a serif reading face, in four
  layouts (Manuscript, Timeline, Codex, Cards). Reorder, set aside, or save the whole read as a Markdown or PDF
  snapshot.
- **Tags**: every `#tag` with a count, queries (`#a #b`, `#a OR #b`, `#a -#b`), saved views, and a read of its own.
- **Drawings, pictures and tables** in notes, five themes, and serif, sans or mono reading text.
- **Link previews**, like in chat apps: a card with the page's title and picture under a link, fetched only
  when you ask (or always, if you choose so in Settings).

## Privacy

Your notes, pictures and drawings stay in grail's own storage on your phone. grail goes online only for the
link previews you ask for, and then fetches just that page. Nothing about your notes is ever sent anywhere.
The full policy: [store/privacy.html](store/privacy.html) (published at grailnotebook.com/privacy).

To keep a copy in Google Drive or open it on a computer, save a PDF snapshot (Read → Save a snapshot → Save as
PDF), open it and share it to Drive. Settings → About grail walks through it.

## Branches, environments and pipelines

Four long-lived branches, each built into its own app by [the Android pipeline](.github/workflows/android.yml) on
every push. The four apps have their own names and IDs, so they can be installed side by side.

| Branch | Environment | App on the phone | App ID | Where the APK goes |
|---|---|---|---|---|
| `dev` | dev | grail dev | `com.grailnotebook.app.dev` | the run's artifacts |
| `qa` | qa | grail qa | `com.grailnotebook.app.qa` | the run's artifacts |
| `staging` | staging | grail staging | `com.grailnotebook.app.staging` | the run's artifacts |
| `main` | prod | grail | `com.grailnotebook.app` | the run's artifacts **and the [Releases page](https://github.com/MPKoutsoukos/grail/releases)** |

Changes move up the chain: `dev` → `qa` → `staging` → `main`.

Each run type-checks the app, runs the core's tests, and builds a signed APK named
`grail[-env]-<version>-<build>.apk`. The build number is the pipeline's run number, so a newer build always
installs over an older one. Non-prod builds show their environment beside the name in the app.

**The desktop app follows along.** After each APK, the pipeline moves
[grail-desktop](https://github.com/MPKoutsoukos/grail-desktop) to this commit on the same branch (its `grail`
submodule) and writes the version and build number into its `mirror.json`. That push starts the desktop
pipeline, so every APK has a matching Windows and Linux build with the same version and environment, and prod's
lands on grail-desktop's Releases page too.

### Secrets the pipeline needs

| Secret | What |
|---|---|
| `GRAIL_KEYSTORE_B64` | the release keystore, base64 |
| `GRAIL_KEYSTORE_PASSWORD` | its password (the same for the key) |
| `DESKTOP_DEPLOY_KEY` | private half of a deploy key with write access to grail-desktop |

## In this repo

```
apps/mobile/       the Android app: Expo (React Native), native lists, gestures and animation
packages/core/     shared with grail-desktop: note format, vault, tags, themes, drawings (no dependencies)
store/             Google Play texts, privacy page, feature graphic and screenshots
PUBLISHING.md      how to publish on Google Play
```

### Files on disk

```
1718267361000.md            a note (frontmatter + markdown)
1718267361000.png           a drawing's preview
1718267361000.scene.json    the drawing's editable vector scene
1718267361000-media.jpg     an image note's picture
grail-review.json           Read arrangements (global + per tag)
grail-views.json            saved queries
grail-settings.json         theme, cover, reading preferences
```

The same layout on the phone and in the desktop app's home folder.

## Build it yourself

Node 24, JDK 17 and the Android SDK.

```sh
cd apps/mobile
npm ci
npx tsc --noEmit                      # type-check
APP_ENV=dev npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

Release builds are signed with the `GRAIL_RELEASE_*` settings in `~/.gradle/gradle.properties`; without them the
APK is unsigned. `npm test` at the top runs the core's tests. On Windows, `apps/mobile/scripts/build-apk.ps1`
does all of it with a local toolchain.

## Built with

Expo and React Native, Reanimated, Gesture Handler, React Native Skia, Lucide icons, and the Newsreader, Inter
and JetBrains Mono fonts. Every licence is listed in the app under Settings → About grail → Licences.

## Licence

grail is free software: you can use, study, share and change it under the terms of the
[GNU General Public License, version 3](LICENSE) (GPL-3.0-only). If you share a changed version, it must stay
under the same licence, with its source available. It comes with no warranty.

© 2026 MPKoutsoukos. The copyright stays with its author, who may also offer grail under other terms.

- **The name and look:** "grail", its wordmark and icons are not covered by the GPL; see [TRADEMARKS.md](TRADEMARKS.md).
  Forks are welcome under their own name.
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Libraries and fonts** keep their own licences (MIT, ISC, SIL OFL); every one is listed in the app.
