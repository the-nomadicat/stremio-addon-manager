#!/usr/bin/env pwsh

param(
  [string]$ProjectDir = (Split-Path $PSScriptRoot -Parent),
  [string]$SourceApk,
  [string]$AppName = 'StremioAddonManager',
  [string]$Version,
  [switch]$UseDropbox
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SourceApk)) {
  $SourceApk = Join-Path $ProjectDir 'android\app\build\outputs\apk\debug\app-debug.apk'
}

if (-not (Test-Path -LiteralPath $SourceApk)) {
  throw "APK not found: $SourceApk"
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $packageJsonPath = Join-Path $ProjectDir 'package.json'
  if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    throw "package.json not found: $packageJsonPath"
  }

  $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
  $Version = [string]$packageJson.version
}

$dropboxBase = @(
  'D:\Dropbox\Apps',
  'C:\Users\conta\Dropbox\Apps',
  'C:\Users\m_ack\Dropbox\Apps'
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($dropboxBase)) {
  throw 'No Dropbox Apps directory is available on this machine.'
}

$destDir = Join-Path $dropboxBase $AppName
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
$targetPath = Join-Path $destDir "$AppName $Version.apk"
Copy-Item -LiteralPath $SourceApk -Destination $targetPath -Force

$apk = Get-Item -LiteralPath $targetPath
Write-Host "Copied APK to $targetPath" -ForegroundColor Green
Write-Host ("Size MB : " + [math]::Round($apk.Length / 1MB, 2))
