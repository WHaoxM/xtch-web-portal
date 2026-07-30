# ADR 0005 Phase 3 frontend migration — move files + create shims
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') 'src')).Path

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function Move-WithShim {
  param(
    [string]$From,
    [string]$To,
    [string]$ShimExport
  )
  Ensure-Dir (Split-Path $To -Parent)
  if (Test-Path $From) {
    Move-Item -Path $From -Destination $To -Force
    Write-Host "Moved $(Split-Path $From -Leaf) -> $To"
  } elseif (-not (Test-Path $To)) {
    Write-Warning "Skip missing: $From (no destination either)"
    return
  } else {
    Write-Host "Shim only (already moved): $(Split-Path $From -Leaf)"
  }
  Set-Content -Path $From -Value $ShimExport -Encoding UTF8
}

$domains = @{
  booking = @(
    'checkoutClient.ts', 'orderClient.ts', 'paymentProviderCopy.ts', 'orderOpsCopy.ts',
    'travelerNames.ts', 'departurePolicy.ts'
  )
  catalog = @(
    'contentStore.ts', 'routesClient.ts', 'destinationsClient.ts', 'departuresClient.ts',
    'categoriesClient.ts', 'customTripFormClient.ts', 'routeDraft.ts', 'destinationDraft.ts',
    'departureDraft.ts', 'departureOpsCopy.ts', 'searchIndex.ts', 'destinationGuides.ts',
    'placeDetailCopy.ts', 'itineraryText.ts', 'routePdfDetails.ts', 'featuredServicesData.ts',
    'siteData.ts'
  )
  inquiry = @(
    'inquiryClient.ts', 'inquiry.ts', 'inquiryOpsCopy.ts', 'inquiryPreferencesDisplay.ts',
    'inquiriesAdminClient.ts'
  )
  identity = @(
    'authClient.ts', 'supabaseClient.ts', 'adminSessionClient.ts'
  )
  media = @(
    'mediaClient.ts', 'mediaBrowseHints.ts', 'videoPoster.ts'
  )
}

foreach ($domain in $domains.Keys) {
  $domainDir = Join-Path $src "domains\$domain"
  Ensure-Dir $domainDir
  foreach ($file in $domains[$domain]) {
    $from = Join-Path $src "lib\$file"
    $to = Join-Path $domainDir $file
    $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
    Move-WithShim -From $from -To $to -ShimExport "export * from '@/domains/$domain/$base';"
  }
}

$sharedLib = @(
  'utils.ts', 'formErrors.ts', 'dateOnly.ts', 'slugify.ts', 'phoneCountries.ts',
  'formFieldDraft.ts', 'hashLegacyRedirect.ts', 'dashboardOpsCopy.ts'
)
$sharedLibDir = Join-Path $src 'shared\lib'
Ensure-Dir $sharedLibDir
foreach ($file in $sharedLib) {
  $from = Join-Path $src "lib\$file"
  $to = Join-Path $sharedLibDir $file
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
  Move-WithShim -From $from -To $to -ShimExport "export * from '@/shared/lib/$base';"
}

# SEO -> shared/seo with lib/seo shims
$seoDir = Join-Path $src 'shared\seo'
Ensure-Dir $seoDir
$seoShimDir = Join-Path $src 'lib\seo'
Ensure-Dir $seoShimDir
Get-ChildItem -Path $seoShimDir -File -ErrorAction SilentlyContinue | ForEach-Object {
  $from = $_.FullName
  $to = Join-Path $seoDir $_.Name
  $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  Move-WithShim -From $from -To $to -ShimExport "export * from '@/shared/seo/$base';"
}

# UI -> shared/ui with components/ui shims
$uiFrom = Join-Path $src 'components\ui'
$uiTo = Join-Path $src 'shared\ui'
if (Test-Path $uiFrom) {
  Ensure-Dir (Split-Path $uiTo -Parent)
  Move-Item -Path $uiFrom -Destination $uiTo -Force
  Ensure-Dir $uiFrom
  Get-ChildItem -Path $uiTo -File | ForEach-Object {
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $ext = $_.Extension
    $shimPath = Join-Path $uiFrom "$base$ext"
    if ($ext -eq '.tsx') {
      Set-Content -Path $shimPath -Value "export * from '@/shared/ui/$base';" -Encoding UTF8
    } else {
      Set-Content -Path $shimPath -Value "export * from '@/shared/ui/$base';" -Encoding UTF8
    }
  }
  Write-Host "Moved ui/ -> shared/ui/ with shims"
}

# Fix cross-domain relative import in orderClient
$orderClient = Join-Path $src 'domains\booking\orderClient.ts'
if (Test-Path $orderClient) {
  $content = Get-Content $orderClient -Raw
  $content = $content -replace "from '\./authClient'", "from '@/lib/authClient'"
  $content = $content -replace "from '\./dateOnly'", "from '@/lib/dateOnly'"
  Set-Content -Path $orderClient -Value $content -Encoding UTF8 -NoNewline
}

# China Trips mobile shell
$ctmShell = Join-Path $src 'shells\china-trips-mobile'
Ensure-Dir $ctmShell
Ensure-Dir (Join-Path $ctmShell 'components')

$ctmMoves = @(
  @{ From = 'components\ChinaTripsMobile.tsx'; To = 'shells\china-trips-mobile\ChinaTripsMobile.tsx'; Shim = "export { default } from '@/shells/china-trips-mobile/ChinaTripsMobile';" }
  @{ From = 'components\chinaTripsMobile.css'; To = 'shells\china-trips-mobile\chinaTripsMobile.css'; Shim = $null }
  @{ From = 'components\chinaTripsMobileMotion.ts'; To = 'shells\china-trips-mobile\chinaTripsMobileMotion.ts'; Shim = "export * from '@/shells/china-trips-mobile/chinaTripsMobileMotion';" }
)

foreach ($m in $ctmMoves) {
  $from = Join-Path $src $m.From
  $to = Join-Path $src $m.To
  if (-not (Test-Path $from)) { continue }
  Ensure-Dir (Split-Path $to -Parent)
  Move-Item -Path $from -Destination $to -Force
  if ($m.Shim) {
    Set-Content -Path $from -Value $m.Shim -Encoding UTF8
  }
  Write-Host "Shell move: $($m.From)"
}

# Mobile components -> shell with shims
$mobileFrom = Join-Path $src 'components\mobile'
$mobileTo = Join-Path $ctmShell 'components'
if (Test-Path $mobileFrom) {
  Get-ChildItem -Path $mobileFrom -File | ForEach-Object {
    $from = $_.FullName
    $to = Join-Path $mobileTo $_.Name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    Move-WithShim -From $from -To $to -ShimExport "export * from '@/shells/china-trips-mobile/components/$base';"
  }
  Remove-Item -Path $mobileFrom -Force -ErrorAction SilentlyContinue
}

# Update ChinaTripsMobile internal imports for motion (css is relative ./)
$ctmFile = Join-Path $ctmShell 'ChinaTripsMobile.tsx'
if (Test-Path $ctmFile) {
  $content = Get-Content $ctmFile -Raw
  $content = $content -replace "@/components/chinaTripsMobileMotion", "@/shells/china-trips-mobile/chinaTripsMobileMotion"
  $content = $content -replace "@/components/mobile/", "@/shells/china-trips-mobile/components/"
  Set-Content -Path $ctmFile -Value $content -Encoding UTF8 -NoNewline
}

# Admin shell
$adminShell = Join-Path $src 'shells\admin'
Ensure-Dir $adminShell
Ensure-Dir (Join-Path $adminShell 'components')

$adminPageFrom = Join-Path $src 'pages\Admin.tsx'
$adminPageTo = Join-Path $adminShell 'Admin.tsx'
if (Test-Path $adminPageFrom) {
  $content = Get-Content $adminPageFrom -Raw
  $content = $content -replace "from '\.\./lib/", "from '@/lib/"
  Set-Content -Path $adminPageTo -Value $content -Encoding UTF8 -NoNewline
  Set-Content -Path $adminPageFrom -Value "export { default } from '@/shells/admin/Admin';" -Encoding UTF8
  Write-Host "Moved Admin.tsx -> shells/admin/"
}

$adminFrom = Join-Path $src 'components\admin'
$adminTo = Join-Path $adminShell 'components'
if (Test-Path $adminFrom) {
  Get-ChildItem -Path $adminFrom -File | ForEach-Object {
    $from = $_.FullName
    $to = Join-Path $adminTo $_.Name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    Move-WithShim -From $from -To $to -ShimExport "export * from '@/shells/admin/components/$base';"
  }
  Remove-Item -Path $adminFrom -Force -ErrorAction SilentlyContinue
}

# Desktop shell components
$desktopShell = Join-Path $src 'shells\desktop'
Ensure-Dir $desktopShell
Ensure-Dir (Join-Path $desktopShell 'components')

$desktopComponents = @('Navbar.tsx', 'Footer.tsx', 'Seo.tsx', 'ScrollToTop.tsx')
foreach ($file in $desktopComponents) {
  $from = Join-Path $src "components\$file"
  $to = Join-Path $desktopShell "components\$file"
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
  Move-WithShim -From $from -To $to -ShimExport "export { default } from '@/shells/desktop/components/$base';"
}

Write-Host 'Phase 3 file migration complete.'
