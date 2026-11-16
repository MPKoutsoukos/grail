// The four environments, one per branch (see the README): dev, qa, staging and prod (main).
// Each installs as its own app, with its own name and app ID, so all four can sit side by side on one phone.
// APP_ENV picks the environment (prod when unset, as for local builds); VERSION_CODE is the build number the
// pipeline gives every APK, so a newer build always installs over an older one.

const ENVS = {
  dev: { name: 'grail dev', suffix: '.dev' },
  qa: { name: 'grail qa', suffix: '.qa' },
  staging: { name: 'grail staging', suffix: '.staging' },
  prod: { name: 'grail', suffix: '' },
}

module.exports = ({ config }) => {
  const env = process.env.APP_ENV || 'prod'
  const e = ENVS[env]
  if (!e) throw new Error(`APP_ENV must be one of: ${Object.keys(ENVS).join(', ')} (got "${env}")`)
  const build = Number(process.env.VERSION_CODE) || config.android.versionCode || 1
  return {
    ...config,
    name: e.name,
    android: { ...config.android, package: config.android.package + e.suffix, versionCode: build },
    ios: { ...config.ios, bundleIdentifier: config.ios.bundleIdentifier + e.suffix, buildNumber: String(build) },
    extra: { ...config.extra, env, build },
  }
}
