# build-apk.ps1 - builds the signed grail release APK with the toolchain in
# %USERPROFILE%\android-build (JDK 17, Android SDK, Node). The pipeline (.github/workflows) builds the same way on GitHub.
#
#   powershell -ExecutionPolicy Bypass -File apps\mobile\scripts\build-apk.ps1 [-Install] [-Bundle]
#
# -Arch x86_64 builds for the Android emulator (phones are arm64-v8a, the default).
# -Bundle builds the .aab Google Play wants (android-build\grail-<version>.aab) instead of an .apk.
#
# Signing: GRAIL_RELEASE_* from ~/.gradle/gradle.properties; without them the APK is unsigned.
# Set APP_ENV (dev, qa, staging) first for a test build; prod when unset.
# Output: android-build\grail-<version>.apk. Log: android-build\build-grail.log
param([switch]$Install, [switch]$Bundle, [string]$Arch = "arm64-v8a")
$ErrorActionPreference = "Continue"
$root = "$env:USERPROFILE\android-build"
$m = Resolve-Path "$PSScriptRoot\.."
$env:JAVA_HOME = "$root\jdk17"
$env:ANDROID_HOME = "$root\sdk"
$env:ANDROID_SDK_ROOT = "$root\sdk"
$env:PATH = "$root\node;$root\jdk17\bin;$root\git\cmd;$root\sdk\platform-tools;$env:PATH"
$env:NODE_ENV = "production"
# Native (C++) builds go under a short folder: Windows' 260-character path limit (see plugins/short-native-paths.js).
$env:GRAIL_CXX_DIR = "$root\x"
$log = "$root\build-grail.log"
function Log($t) {
  $line = "$(Get-Date -Format HH:mm:ss) $t"
  Write-Host $line
  for ($i = 0; $i -lt 5; $i++) { try { Add-Content -Encoding utf8 $log $line -ErrorAction Stop; break } catch { Start-Sleep -Milliseconds 200 } }
}
"" | Set-Content $log

if (-not (Select-String -Path "$env:USERPROFILE\.gradle\gradle.properties" -Pattern '^GRAIL_RELEASE_STORE_FILE=' -Quiet -ErrorAction SilentlyContinue)) {
  Log "WARNING: no GRAIL_RELEASE_* key in ~/.gradle/gradle.properties; the APK will be unsigned"
}

Set-Location $m
Log "1/3 expo prebuild"
cmd /c "npx expo prebuild --platform android --no-install --clean >> `"$log`" 2>&1"
if ($LASTEXITCODE -ne 0) { Log "FAILED: prebuild"; exit 1 }

$task = if ($Bundle) { "bundleRelease" } else { "assembleRelease -PreactNativeArchitectures=$Arch" }
Log "2/3 gradle $task"
cmd /c "cd /d `"$m\android`" && .\gradlew.bat $task --no-daemon --console=plain >> `"$log`" 2>&1"
if ($LASTEXITCODE -ne 0) { Log "FAILED: gradle"; exit 1 }

$ver = (Get-Content "$m\app.json" | ConvertFrom-Json).expo.version
$built = if ($Bundle) { "$m\android\app\build\outputs\bundle\release\*.aab" } else { "$m\android\app\build\outputs\apk\release\*.apk" }
$apk = Get-ChildItem $built | Select-Object -First 1
$out = if ($Bundle) { "$root\grail-$ver.aab" } elseif ($Arch -ne "arm64-v8a") { "$root\grail-$ver-$Arch.apk" } else { "$root\grail-$ver.apk" }
Copy-Item $apk.FullName $out -Force
Log ("3/3 BUILD OK: {0} ({1:N1} MB)" -f $out, ((Get-Item $out).Length / 1MB))

if ($Install -and -not $Bundle) {
  Log "installing on the connected device"
  cmd /c "adb install -r `"$out`" >> `"$log`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Log "FAILED: adb install"; exit 1 }
  cmd /c "adb shell monkey -p com.grailnotebook.app -c android.intent.category.LAUNCHER 1 >> `"$log`" 2>&1"
  Log "INSTALLED and launched"
}
