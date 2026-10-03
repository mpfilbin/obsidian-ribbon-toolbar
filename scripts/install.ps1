#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$VaultPath
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

# Read the plugin id from manifest.json so the install folder always matches the plugin.
$manifest = Get-Content -LiteralPath (Join-Path $RepoRoot 'manifest.json') -Raw | ConvertFrom-Json
$PluginId = $manifest.id
if (-not ($PluginId -is [string]) -or $PluginId.Length -eq 0) {
  throw 'manifest.json is missing a valid plugin id'
}

if (-not $VaultPath) {
  Write-Host 'Usage: .\scripts\install.ps1 <path-to-obsidian-vault>'
  Write-Host ''
  Write-Host 'Example: .\scripts\install.ps1 C:\Users\me\Documents\MyVault'
  exit 1
}

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  Write-Host "Error: Vault path does not exist: $VaultPath"
  exit 1
}

$PluginDir = Join-Path $VaultPath ".obsidian\plugins\$PluginId"

Push-Location $RepoRoot
try {
  Write-Host '-> Building plugin...'
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE"
  }

  Write-Host "-> Installing to $PluginDir..."
  New-Item -ItemType Directory -Path $PluginDir -Force | Out-Null
  foreach ($file in 'main.js', 'manifest.json', 'styles.css') {
    Copy-Item -LiteralPath (Join-Path $RepoRoot $file) -Destination $PluginDir -Force
  }
} finally {
  Pop-Location
}

Write-Host "Done. In Obsidian: Settings -> Community Plugins -> reload and enable 'Ribbon Bar'."
