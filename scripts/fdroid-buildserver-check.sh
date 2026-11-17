#!/usr/bin/env bash
# Builds grail the way F-Droid's build server does, from the recipe in fdroid/com.grailnotebook.app.yml.
# Runs as root inside F-Droid's own image, registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie
# (see .github/workflows/fdroid.yml). Adapted from the Lifts project's check (github.com/Benflex1/lifts, MIT).
#
# Usage: scripts/fdroid-buildserver-check.sh <commit-sha> <versionCode>
# Every `commit:` in the recipe becomes <commit-sha>, then the build with <versionCode> (one per ABI) is built
# with the same commands F-Droid uses: fdroid lint, fdroid rewritemeta, then fdroid build --on-server, which
# also runs F-Droid's source scanner. Output and logs go to fdroid-check-output/.
set -euo pipefail

APP_ID="com.grailnotebook.app"
RECIPE="fdroid/$APP_ID.yml"
SOURCE_REF="${1:?usage: $0 <commit-sha> <versionCode>}"
VERSION_CODE="${2:?usage: $0 <commit-sha> <versionCode>}"
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
WORK="$ROOT/.fdroid-check"
OUT="$ROOT/fdroid-check-output"

rm -rf "$WORK" "$OUT"
mkdir -p "$WORK" "$OUT"

BUILD_SPEC="$APP_ID:$VERSION_CODE"
grep -q "^    versionCode: $VERSION_CODE\$" "$RECIPE" || { echo "::error::$RECIPE has no build with versionCode $VERSION_CODE"; exit 2; }
echo "Checking $BUILD_SPEC at $SOURCE_REF"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  ca-certificates git sudo openjdk-21-jdk-headless python3

if [[ -f /etc/profile.d/bsenv.sh ]]; then
  # shellcheck disable=SC1091
  source /etc/profile.d/bsenv.sh
fi
home_vagrant="${home_vagrant:-/home/vagrant}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

sdkmanager="$(command -v sdkmanager || echo "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager")"
"$sdkmanager" "platform-tools" "build-tools;35.0.0" >/dev/null

git clone --quiet --depth 1 https://gitlab.com/fdroid/fdroidserver.git "$WORK/fdroidserver"
git clone --quiet --depth 1 https://gitlab.com/fdroid/fdroiddata.git "$WORK/fdroiddata"

# The recipe as it will be submitted, pinned to the commit under test.
sed -E "s/^    commit: .*/    commit: $SOURCE_REF/" "$RECIPE" > "$WORK/$APP_ID.yml"
cp "$WORK/$APP_ID.yml" "$OUT/metadata-used.yml"

mkdir -p "$home_vagrant"/{build,logs,tmp,unsigned,metadata,.android,.gradle}
cp "$WORK/$APP_ID.yml" "$WORK/fdroiddata/metadata/$APP_ID.yml"
cp "$WORK/$APP_ID.yml" "$home_vagrant/metadata/$APP_ID.yml"
ln -sfn "$WORK/fdroiddata" "$home_vagrant/fdroiddata"
chown -R vagrant "$home_vagrant" "$WORK"

fdroid_as_vagrant() {
  sudo --preserve-env --user vagrant env \
    PATH="$WORK/fdroidserver:$PATH" \
    PYTHONPATH="$WORK/fdroidserver:$WORK/fdroidserver/examples" \
    PYTHONUNBUFFERED=true \
    HOME="$home_vagrant" \
    ANDROID_HOME="$ANDROID_HOME" \
    ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
    GRADLE_USER_HOME="$home_vagrant/.gradle" \
    fdroid "$@"
}

# The same metadata checks as fdroiddata's merge request pipeline.
pushd "$WORK/fdroiddata" >/dev/null
fdroid_as_vagrant lint "$APP_ID" 2>&1 | tee "$OUT/fdroid-lint.log"
fdroid_as_vagrant rewritemeta "$APP_ID"
if ! diff -u "$WORK/$APP_ID.yml" "metadata/$APP_ID.yml" | tee "$OUT/rewritemeta.diff"; then
  echo "::error::The recipe is not in fdroid rewritemeta's canonical form; apply the diff above."
  exit 1
fi
popd >/dev/null

pushd "$home_vagrant" >/dev/null
# In --on-server mode, `fdroid build` expects the app source to be checked out already.
fdroid_as_vagrant fetchsrclibs "$BUILD_SPEC" --verbose
set +e
(unset CI; fdroid_as_vagrant build --verbose --test --refresh-scanner --on-server --no-tarball "$BUILD_SPEC") \
  2>&1 | tee "$OUT/fdroid-build.log"
status=${PIPESTATUS[0]}
set -e
popd >/dev/null

for apk in "$home_vagrant/unsigned/${APP_ID}_${VERSION_CODE}.apk" \
           "$home_vagrant/tmp/${APP_ID}_${VERSION_CODE}.apk" \
           "$home_vagrant/build/$APP_ID/apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk"; do
  if [[ -f "$apk" ]]; then
    cp "$apk" "$OUT/grail-fdroid-unsigned-$VERSION_CODE.apk"
    break
  fi
done

if [[ "$status" -ne 0 ]]; then
  echo "::error::fdroid build failed for $BUILD_SPEC (see fdroid-build.log in the uploaded artifact)"
  exit "$status"
fi
echo "fdroid build succeeded for $BUILD_SPEC"