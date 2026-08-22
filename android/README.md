# Syncing Travel Android wrapper

This is a small production WebView wrapper for the official mobile China Trips experience. It opens:

`https://www.xuntingtravel.com/china-trips`

The wrapper intentionally keeps the website as the source of truth for content, authentication, bookings, and payments. It only adds Android lifecycle handling, safe external-scheme handling, WebView storage, and the branded launcher icon.

## Release build

The build uses the Android SDK command-line tools already installed on the workstation; no Gradle dependency is required.

```powershell
$env:SYNCING_TRAVEL_KEYSTORE_PASSWORD = '<release-keystore-password>'
$env:SYNCING_TRAVEL_KEY_PASSWORD = '<key-password>'
powershell -ExecutionPolicy Bypass -File .\android\build-release.ps1
```

The release keystore is deliberately kept outside Git. Never lose or rotate it after publishing: Android updates must use the same signing key.
