#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$VaultPath
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

if (-not $VaultPath) {
  Write-Host 'Usage: .\scripts\uninstall.ps1 <path-to-obsidian-vault>'
  Write-Host ''
  Write-Host 'Example: .\scripts\uninstall.ps1 C:\Users\me\Documents\MyVault'
  exit 1
}

if (-not (Test-Path -LiteralPath $VaultPath -PathType Container)) {
  Write-Host "Error: Vault path does not exist: $VaultPath"
  exit 1
}

# Read the plugin id from manifest.json so it stays in sync with the plugin.
$manifest = Get-Content -LiteralPath (Join-Path $RepoRoot 'manifest.json') -Raw | ConvertFrom-Json
$PluginId = $manifest.id
if (-not ($PluginId -is [string]) -or $PluginId.Length -eq 0) {
  throw 'manifest.json is missing a valid plugin id'
}

$ObsidianDir = Join-Path $VaultPath '.obsidian'
$PluginDir = Join-Path $ObsidianDir "plugins\$PluginId"
$CommunityPluginsFile = Join-Path $ObsidianDir 'community-plugins.json'

if (Test-Path -LiteralPath $PluginDir) {
  Write-Host "-> Removing plugin directory $PluginDir..."
  Remove-Item -LiteralPath $PluginDir -Recurse -Force
} else {
  Write-Host "-> Plugin directory not found at $PluginDir; nothing to delete."
}

if (-not (Test-Path -LiteralPath $ObsidianDir -PathType Container)) {
  Write-Host "-> Obsidian config directory not found at $ObsidianDir; skipping community plugin cleanup."
  Write-Host 'Done.'
  exit 0
}

if (-not (Test-Path -LiteralPath $CommunityPluginsFile -PathType Leaf)) {
  Write-Host "-> community-plugins.json not found at $CommunityPluginsFile; skipping plugin list cleanup."
  Write-Host 'Done.'
  exit 0
}

Write-Host "-> Removing '$PluginId' from $CommunityPluginsFile..."
try {
  $raw = Get-Content -LiteralPath $CommunityPluginsFile -Raw -Encoding UTF8
  # ConvertFrom-Json unwraps single-element arrays inconsistently across
  # PowerShell versions, so check the raw JSON shape and re-wrap with @().
  if ($raw.TrimStart() -notmatch '^\[') {
    throw "Expected $CommunityPluginsFile to contain a JSON array."
  }
  $entries = @($raw | ConvertFrom-Json)
  $filtered = @($entries | Where-Object { $_ -ne $PluginId })

  if ($filtered.Count -ne $entries.Count) {
    if ($filtered.Count -eq 0) {
      $json = '[]'
    } else {
      $json = ConvertTo-Json -InputObject $filtered
    }
    # Write UTF-8 without a BOM; Windows PowerShell 5.1's Set-Content adds one.
    [System.IO.File]::WriteAllText($CommunityPluginsFile, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
    Write-Host 'Done. Plugin files and community plugin entry removed.'
  } else {
    Write-Host "Done. Plugin files removed; '$PluginId' was not listed in community-plugins.json."
  }
} catch {
  Write-Host "Error: Failed to update $CommunityPluginsFile. The plugin directory has been removed, but the community plugin list may still reference '$PluginId'."
  Write-Host $_.Exception.Message
  exit 1
}
