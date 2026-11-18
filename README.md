# grail

**Quiet, local-first notes that gather into one continuous read.**

grail is for long-running creative work that lives in fragments: ideas, characters, places, half-formed lore,
things overheard. Every note is a plain markdown file on your own device. There's no account, no ads and no
tracking.

Website: **https://grailnotebook.com**

## Get it

| | Where |
|---|---|
| Android | the [Releases page](https://github.com/MPKoutsoukos/grail/releases/latest) (APK); F-Droid submission in progress |
| Windows & Linux | [grail-desktop](https://github.com/MPKoutsoukos/grail-desktop/releases/latest) |

The APK on the Releases page and the F-Droid build are signed with different keys, so one can't update the other:
pick one source and stay with it.

## What it does

- **Browse**: every fragment, grouped by when you touched it, with search. An **Echo** at the top brings back an
  older fragment, anniversaries first.
- **First start**: a five-step illustrated tour (write, read, shaping the read, tags, files), then the choice of
  home folder, and a screen saying which folder is in use. Settings shows the tour again.
- **Writing**: a new note opens with the keyboard up; it saves as you type, and **Save** saves and closes.
- **Read**: your fragments stitched into one continuous text, titles hidden, set in a serif reading face, in four
  layouts (Manuscript, Timeline, Codex, Cards). Swipe a fragment left to delete it, right to pick it up and place
  it elsewhere; long-press to edit, move or take it out of the read. Save the whole read as a Markdown or PDF
  snapshot.
- **Nothing is lost**: deleting moves a note to `#deleted` (the tag is written into its text). It's hidden
  everywhere until a search asks for `#deleted`; take the tag out to bring it back, or delete it again there to
  remove the file for good.
- **Tags**: every `#tag` with a count, queries (`#a #b`, `#a OR #b`, `#a -#b`), saved views, and a read of its own.
- **Drawings, pictures and tables** in notes, five themes, and serif, sans or mono reading text.
- **Link previews**, like in chat apps: a card with the page's title and picture under a link, fetched only
  when you ask (or always, if you choose so in Settings).

grail grew out of the "grail method": one notebook for every idea, kept messy, and read back often. It was
inspired by [a video by Perry Daniels](https://www.youtube.com/watch?v=_QVYfPnNOg4).

## Privacy

Your notes, pictures and drawings stay on your phone, in your home folder: grail's own, or one you chose. grail goes online only for the
link previews you ask for, and then fetches just that page. Nothing about your notes is ever sent anywhere, and
the app has no analytics, crash reporting or Google services. The full policy is at
https://grailnotebook.com/privacy/ (a copy is in [store/privacy.html](store/privacy.html)).

## In this repo

```
apps/mobile/       the Android app: Expo (React Native), native lists, gestures and animation
packages/core/     shared with grail-desktop: note format, the home (the notes folder), tags, themes, drawings (no dependencies)
fdroid/            the F-Droid build recipe (metadata/com.grailnotebook.app.yml in fdroiddata)
fastlane/          store texts, icon and screenshots, as F-Droid reads them
store/             Google Play texts, privacy page, feature graphic and screenshots
scripts/           the F-Droid build check (run by the F-Droid workflow)
PUBLISHING.md      how to publish: GitHub Releases, F-Droid, Google Play
SECURITY.md        how to report a security problem
```

### Files on disk

```
1718267361000.md                 a note (frontmatter + markdown)
1718267361000-<stamp>.png        a drawing's preview (a new name each time it changes)
1718267361000.scene.json         the drawing's editable vector scene
1718267361000-media.jpg          an image note's picture
grail-review.json                Read arrangements (global + per tag)
grail-views.json                 saved queries
grail-settings.json              theme, cover, reading preferences
```

The same layout on the phone and in the desktop app's home folder.

### The home folder and what Read gathers

On first start, grail shows a four-step tour, then asks where the notes live: **grail's own folder** (the
default, inside the app; uninstalling deletes it) or **a folder you pick** with Android's folder picker, new or
one that already has notes. Android then lets grail into that folder only, with no storage permission. A last
screen says which folder is in use, and Settings → Home folder always shows it and can change it (optionally
copying the notes across).

Each note keeps a small header (frontmatter): `id`, `type`, `title`, `tags`, `created`, `updated`,
and for pictures `drawingPath` / `mediaPath`. **Read gathers the notes whose title is a date and time**
(`2026-06-13 14:02`, which every new note gets); a tag's read gathers everything with that #tag. Plain markdown
from another app (no header) shows in Browse and under the #tags in its text, dated by the file's modification
time; it joins Read only if given a dated title. Saving such a note in grail adds the header to the file.
Only files directly in the folder are read, not subfolders.

## Versions

`apps/mobile/app.json` holds the version (`expo.version`, e.g. `1.0.1`) and its version code
(`android.versionCode` = major × 10000 + minor × 100 + patch, e.g. `10001`). Releases are tagged `v1.0.1`.
F-Droid builds one APK per phone type with version code × 10 + 1, 2 or 4. The pipeline's own APKs use its run
number as the build number. Details in [PUBLISHING.md](PUBLISHING.md).

## Branches, environments and pipelines

Four long-lived branches, each built into its own app by [the Android pipeline](.github/workflows/android.yml) on
every push. The four apps have their own names and IDs, so they can be installed side by side.

| Branch | Environment | App on the phone | App ID | Where the APK goes |
|---|---|---|---|---|
| `dev` | dev | grail dev | `com.grailnotebook.app.dev` | the run's artifacts |
| `qa` | qa | grail qa | `com.grailnotebook.app.qa` | the run's artifacts |
| `staging` | staging | grail staging | `com.grailnotebook.app.staging` | the run's artifacts |
| `main` | prod | grail | `com.grailnotebook.app` | the run's artifacts, **the [Releases page](https://github.com/MPKoutsoukos/grail/releases)**, and the Google Play bundle (`.aab`) as an artifact |

Changes move up the chain: `dev` → `qa` → `staging` → `main`.

Each run type-checks the app, runs the core's tests, and builds a signed APK named
`grail[-env]-<version>-<build>.apk`. Non-prod builds show their environment beside the name in the app.

**The desktop app follows along.** After each APK, the pipeline moves
[grail-desktop](https://github.com/MPKoutsoukos/grail-desktop) to this commit on the same branch (its `grail`
submodule) and writes the version and build number into its `mirror.json`, so every APK has a matching Windows
and Linux build.

**F-Droid check.** [The F-Droid workflow](.github/workflows/fdroid.yml) builds the recipe in `fdroid/` inside
F-Droid's own build-server image, with `fdroid lint`, `rewritemeta`, the source scanner and
`fdroid build --on-server`, on every push to `dev` that touches the app.

### Secrets the pipeline needs

| Secret | What |
|---|---|
| `GRAIL_KEYSTORE_B64` | the release keystore, base64 |
| `GRAIL_KEYSTORE_PASSWORD` | its password (the same for the key) |
| `DESKTOP_DEPLOY_KEY` | private half of a deploy key with write access to grail-desktop |

They live in the repository's Actions secrets, never in the code. The workflows run on pushes and by hand only,
never on pull requests from forks, so the secrets can't be reached from outside.

## Build it yourself

Node 22 or newer, JDK 17 (or 21) and the Android SDK.

```sh
cd apps/mobile
npm ci
npx tsc --noEmit                      # type-check
APP_ENV=dev npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

Release builds are signed with the `GRAIL_RELEASE_*` settings in `~/.gradle/gradle.properties`; without them the
APK comes out unsigned. `npm test` at the top runs the core's tests. On Windows,
`apps/mobile/scripts/build-apk.ps1` does all of it with a local toolchain.

## Built with

Expo and React Native, Reanimated, Gesture Handler, react-native-svg, Lucide icons, and the Newsreader, Inter
and JetBrains Mono fonts. Everything is built from source; there are no prebuilt graphics libraries and no
Google Play Services. Every licence is listed in the app under Settings → About grail → Licences.

## Licence

grail is free software: you can use, study, share and change it under the terms of the
[GNU General Public License, version 3](LICENSE) (GPL-3.0-only). If you share a changed version, it must stay
under the same licence, with its source available. It comes with no warranty.

© 2026 MPKoutsoukos. The copyright stays with its author, who may also offer grail under other terms.

- **The name and look:** "grail", its wordmark and icons are not covered by the GPL; see [TRADEMARKS.md](TRADEMARKS.md).
  Forks are welcome under their own name.
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Security:** see [SECURITY.md](SECURITY.md).
- **Libraries and fonts** keep their own licences (MIT, ISC, SIL OFL); every one is listed in the app.
