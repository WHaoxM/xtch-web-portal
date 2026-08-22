param(
    [string]$VersionName = '1.0.0',
    [int]$VersionCode = 1
)

$ErrorActionPreference = 'Stop'

$androidRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $androidRoot
$sdkRoot = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'D:\Android\Sdk' }
$buildTools = Join-Path $sdkRoot 'build-tools\35.0.0'
$platformJar = Join-Path $sdkRoot 'platforms\android-35\android.jar'
$srcRoot = Join-Path $androidRoot 'app\src\main'
$workRoot = Join-Path $androidRoot 'build\release'
$outputDir = Join-Path $repoRoot 'dist\android'
$keystore = Join-Path $androidRoot 'keystore\syncing-travel-release.jks'
$storePassword = $env:SYNCING_TRAVEL_KEYSTORE_PASSWORD
$keyPassword = if ($env:SYNCING_TRAVEL_KEY_PASSWORD) { $env:SYNCING_TRAVEL_KEY_PASSWORD } else { $storePassword }

foreach ($required in @($buildTools, $platformJar, $keystore)) {
    if (-not (Test-Path $required)) { throw "Missing required build input: $required" }
}
if (-not $storePassword) { throw 'Set SYNCING_TRAVEL_KEYSTORE_PASSWORD before building.' }

Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $workRoot, $outputDir | Out-Null
$compiled = Join-Path $workRoot 'resources.zip'
$unsigned = Join-Path $workRoot 'unsigned.apk'
$aligned = Join-Path $workRoot 'aligned.apk'
$classes = Join-Path $workRoot 'classes'
$dex = Join-Path $workRoot 'dex'
$generated = Join-Path $workRoot 'generated'
New-Item -ItemType Directory -Force -Path $classes, $dex, $generated | Out-Null

& (Join-Path $buildTools 'aapt2.exe') compile --dir (Join-Path $srcRoot 'res') -o $compiled
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed.' }

& (Join-Path $buildTools 'aapt2.exe') link `
    -o $unsigned `
    -I $platformJar `
    --manifest (Join-Path $srcRoot 'AndroidManifest.xml') `
    --auto-add-overlay `
    --min-sdk-version 23 `
    --target-sdk-version 35 `
    --version-code $VersionCode `
    --version-name $VersionName `
    --java $generated `
    $compiled
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed.' }

$javaFile = Join-Path $srcRoot 'java\com\xuntingtravel\app\MainActivity.java'
& javac.exe -encoding UTF-8 -source 8 -target 8 -classpath $platformJar -d $classes $javaFile
if ($LASTEXITCODE -ne 0) { throw 'javac failed.' }

$classFiles = Get-ChildItem -LiteralPath $classes -Recurse -Filter '*.class' | ForEach-Object { $_.FullName }
& (Join-Path $buildTools 'd8.bat') --lib $platformJar --output $dex $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed.' }

& jar.exe uf $unsigned -C $dex classes.dex
if ($LASTEXITCODE -ne 0) { throw 'Adding classes.dex failed.' }

& (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed.' }

$env:SYNCING_TRAVEL_KEYSTORE_PASSWORD = $storePassword
& (Join-Path $buildTools 'apksigner.bat') sign `
    --ks $keystore `
    --ks-pass "pass:$storePassword" `
    --key-pass "pass:$keyPassword" `
    --ks-key-alias syncing-travel `
    --out (Join-Path $outputDir 'syncing-travel-release.apk') `
    $aligned
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed.' }

& (Join-Path $buildTools 'apksigner.bat') verify --verbose (Join-Path $outputDir 'syncing-travel-release.apk')
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }

Write-Output "APK: $(Join-Path $outputDir 'syncing-travel-release.apk')"
