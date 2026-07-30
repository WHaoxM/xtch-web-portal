# Complete Phase 3 admin + desktop shell migration
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') 'src')).Path

function Ensure-Dir($path) {
  if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

function Move-WithShim {
  param([string]$From, [string]$To, [string]$ShimExport)
  Ensure-Dir (Split-Path $To -Parent)
  if (Test-Path $From) {
    Move-Item -Path $From -Destination $To -Force
    Write-Host "Moved $(Split-Path $From -Leaf)"
  } elseif (-not (Test-Path $To)) {
    Write-Warning "Skip: $From"
    return
  }
  Set-Content -Path $From -Value $ShimExport -Encoding UTF8
}

# Admin shell
$adminShell = Join-Path $src 'shells\admin'
Ensure-Dir $adminShell
Ensure-Dir (Join-Path $adminShell 'components')

$adminPageFrom = Join-Path $src 'pages\Admin.tsx'
$adminPageTo = Join-Path $adminShell 'Admin.tsx'
if (Test-Path $adminPageFrom) {
  $firstLine = Get-Content $adminPageFrom -TotalCount 1
  if ($firstLine -notmatch "export \{ default \}") {
    $content = Get-Content $adminPageFrom -Raw
    $content = $content -replace "from '\.\./lib/", "from '@/lib/"
    Set-Content -Path $adminPageTo -Value $content -Encoding UTF8 -NoNewline
    Set-Content -Path $adminPageFrom -Value "export { default } from '@/shells/admin/Admin';" -Encoding UTF8
    Write-Host 'Moved Admin.tsx'
  }
}

$adminFrom = Join-Path $src 'components\admin'
$adminTo = Join-Path $adminShell 'components'
if (Test-Path $adminFrom) {
  Get-ChildItem -Path $adminFrom -File | ForEach-Object {
    $from = $_.FullName
    $to = Join-Path $adminTo $_.Name
    $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
    $shimPath = Join-Path $adminFrom $_.Name
    if ((Get-Content $shimPath -TotalCount 1) -match "export \* from '@/shells/admin") {
      Write-Host "Already shim: $($_.Name)"
    } else {
      Move-WithShim -From $from -To $to -ShimExport "export * from '@/shells/admin/components/$base';"
    }
  }
}

# Desktop shell
$desktopShell = Join-Path $src 'shells\desktop'
Ensure-Dir $desktopShell
Ensure-Dir (Join-Path $desktopShell 'components')

foreach ($file in @('Navbar.tsx', 'Footer.tsx', 'Seo.tsx', 'ScrollToTop.tsx')) {
  $from = Join-Path $src "components\$file"
  $to = Join-Path $desktopShell "components\$file"
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
  if (Test-Path $to) {
    if (Test-Path $from) {
      $line = Get-Content $from -TotalCount 1
      if ($line -match "export \{ default \}") { continue }
    }
  }
  Move-WithShim -From $from -To $to -ShimExport "export { default } from '@/shells/desktop/components/$base';"
}

Write-Host 'Admin + desktop shell migration complete.'
