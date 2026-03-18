$script = @'
<#
.SYNOPSIS
  Create dist\eq5e.zip and list its contents.

.DESCRIPTION
  - Uses Compress-Archive to create dist\eq5e.zip
  - Excludes node_modules, .git, dist, tools, scripts, tests
  - Prints the ZIP entries (name + size)
#>

param(
  [switch]$ForceOverwrite
)

# Ensure running from repo root (script location)
$scriptPath = $MyInvocation.MyCommand.Path
if ($scriptPath) {
  $repoRoot = Split-Path -Parent $scriptPath | Split-Path -Parent
} else {
  $repoRoot = (Get-Location).Path
}
Set-Location $repoRoot

$distDir = Join-Path $repoRoot "dist"
$zipPath = Join-Path $distDir "eq5e.zip"

# Ensure dist exists
if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

# Remove existing zip if requested or present
if (Test-Path $zipPath) {
  if ($ForceOverwrite) {
    Remove-Item $zipPath -Force
  } else {
    Write-Host "ZIP already exists at $zipPath. Use -ForceOverwrite to recreate."
    goto ListContents
  }
}

# Build list of files to include (exclude common dev folders)
$allFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Force |
  Where-Object {
    $p = $_.FullName.ToLower()
    -not ($p -like "*\node_modules\*") -and
    -not ($p -like "*\.git\*") -and
    -not ($p -like "*\dist\*") -and
    -not ($p -like "*\tools\*") -and
    -not ($p -like "*\scripts\*") -and
    -not ($p -like "*\tests\*") -and
    -not ($p -like "*.log")
  }

if ($allFiles.Count -eq 0) {
  Write-Error "No files found to package. Ensure you are in the repo root."
  exit 1
}

# Create a temporary staging folder to preserve relative paths
$staging = Join-Path $env:TEMP ("eq5e_pack_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $staging | Out-Null

try {
  foreach ($f in $allFiles) {
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart('\','/')
    $dest = Join-Path $staging $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -Path $f.FullName -Destination $dest -Force
  }

  # Ensure system.json is present at root of zip
  $sysJson = Join-Path $repoRoot "system.json"
  if (Test-Path $sysJson) {
    Copy-Item -Path $sysJson -Destination (Join-Path $staging "system.json") -Force
  } else {
    Write-Warning "system.json not found at repo root; the produced ZIP may be invalid for Foundry."
  }

  # Create zip
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force
  Write-Host "Created ZIP: $zipPath"
} finally {
  # Clean up staging
  Remove-Item -Path $staging -Recurse -Force -ErrorAction SilentlyContinue
}

:ListContents
if (Test-Path $zipPath) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = $zip.Entries | Select-Object @{Name='Name';Expression={$_.FullName}}, @{Name='Size';Expression={$_.Length}}
    Write-Host ""
    Write-Host ("Contents of {0}:" -f $zipPath)
    Write-Host ""
    $entries | Sort-Object Name | Format-Table -AutoSize
    Write-Host ""
    Write-Host ("Total entries: {0}" -f $entries.Count)
  } finally {
    $zip.Dispose()
  }
} else {
  Write-Error ("ZIP not found: {0}" -f $zipPath)
  exit 1
}
'@

# Overwrite the file and save as UTF8
$script | Set-Content -Path .\tools\pack-release.ps1 -Encoding UTF8

# Run it
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\tools\pack-release.ps1 -ForceOverwrite
