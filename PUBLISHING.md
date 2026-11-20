# Publishing grail on Google Play

grail keeps notes **only on the phone**: no account, no sync, and the internet only for the link previews the
user asks for. That keeps the store paperwork small. Store texts, the privacy page and graphics are in
[`store/`](store/).

Steps marked **(you)** need your accounts, money or decisions.

## 0. Settled (hard to change later)

| Decision | Now | Notes |
|---|---|---|
| App ID | `com.grailnotebook.app` | **Permanent after the first upload.** The dev, qa and staging builds add `.dev`, `.qa`, `.staging`. |
| Store name | `grail: fragments & journal` | Check Play for similar names. |
| Privacy URL | `https://grailnotebook.com/privacy/` | `PRIVACY_URL` in `apps/mobile/src/screens/Settings.tsx`. |
| Contact | `hello@grailnotebook.com` | `CONTACT` in the same file. It's public in the store, so the mailbox must exist. |
| Price | Free, no ads | Google Play doesn't allow a free app to become paid later. |

## 1. Once, before the first upload

1. **Developer account (you).** Sign up at play.google.com/console: a one-time fee plus identity verification.
   A **personal** account must run a **closed test with at least 12 testers for 14 days in a row** before it
   can apply for production. An organisation account (it needs a D-U-N-S number) skips that.
2. **Privacy page (you).** Host the policy at the URL above (grailnotebook.com) and keep it online for as long
   as the app is listed. The text is in [`store/privacy.html`](store/privacy.html).
3. **Signing key.** grail has its own release key. The pipeline gets it from the repository secrets
   `GRAIL_KEYSTORE_B64` (the keystore, base64) and `GRAIL_KEYSTORE_PASSWORD`; local builds read the
   `GRAIL_RELEASE_*` lines in `~/.gradle/gradle.properties`. Keep a backup of the keystore and its password away
   from this computer. With Play App Signing (on by default) it's only the *upload* key, and Google support can
   reset a lost one.

## 2. Every release

1. In `apps/mobile/app.json`, raise `expo.version` (shown to users, e.g. `1.0.1`). The build number
   (`versionCode`) needs no editing: the pipeline uses its run number, so it always goes up.
2. Merge into `main`. The pipeline builds the APK, puts it on the Releases page, and builds the matching desktop
   app in [grail-desktop](https://github.com/MPKoutsoukos/grail-desktop).
3. For Google Play, take the bundle (`.aab`) that build made: on GitHub, **Actions → Android → the run for that
   commit on main → Artifacts → `grail-<version>-<build>.aab`** (a zip; the `.aab` is inside). It's signed with
   the same key and kept for 90 days. To build one on this PC instead:
   ```powershell
   powershell -ExecutionPolicy Bypass -File apps\mobile\scripts\build-apk.ps1 -Bundle
   ```
4. Play Console → Test and release:
   - **Internal testing** first: available within minutes, up to 100 testers.
   - **Closed testing**: for a personal account, at least 12 testers for 14 days, needed once before production.
   - **Production**: use a staged rollout (e.g. 20%, then 100%). Review takes about 1–7 days, longer the first time.

## 3. Play Console forms (once)

Everything to paste is in [`store/listing.md`](store/listing.md).

- **Main store listing:** name, short and full description, icon
  (`apps/mobile/assets/icon-source/play-store-512.png`), feature graphic (`store/feature-graphic.png`), 2–8 phone
  screenshots (`store/screenshots/`), category Productivity, contact email.
- **Privacy policy:** the URL above.
- **Data safety:** "Does your app collect or share any of the required user data types?" → **No**.
  (The only network use is link previews: asked for by the user, straight to the linked site, nothing to the
  developer. Re-read Google's guidance on user-initiated transfers before submitting.)
- **Content rating:** IARC questionnaire, all "no"; expect Everyone / PEGI 3.
- **Target audience:** 13+. **Ads:** none. **App access:** no special access needed.
- **Permissions:** pictures come through Android's photo picker, so there's nothing to declare.

## 4. Checks before the first production release

- [ ] Fresh install on a real phone from the **internal testing** track (the Play-signed build).
- [ ] Write, tag, draw, add a picture, make a table, take MD and PDF snapshots, and open the PDF.
- [ ] A link in a note: Preview asks first, then shows the card; Settings → Link previews shows them all.
- [ ] Rotate themes and fonts; TalkBack pass on the main screens.
- [ ] Large-home check: 1,000+ notes with pictures; watch scrolling and startup.
- [ ] `aapt dump permissions` on the APK shows `INTERNET` (link previews only) and no camera, microphone or location.

## Not planned yet

- **iOS:** it would need an Apple Developer membership and a Mac (or a cloud build service).
- **Sync between phone and computer:** grail keeps them separate today (About explains the PDF route to Google
  Drive). Adding sync would mean new privacy and Data safety answers.
