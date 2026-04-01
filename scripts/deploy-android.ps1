#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectDir

$jdk21 = "C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"
if (Test-Path $jdk21) {
  $env:JAVA_HOME = $jdk21
  if (-not (($env:Path -split ';') -contains (Join-Path $jdk21 "bin"))) {
    $env:Path = (Join-Path $jdk21 "bin") + ";" + $env:Path
  }
}

Write-Host ""
Write-Host "=== [1/3] Syncing Capacitor Android project ===" -ForegroundColor Cyan
npm install --include=dev --no-package-lock
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
npm run build:android
if ($LASTEXITCODE -ne 0) { throw "Android sync failed" }

Write-Host ""
Write-Host "=== [2/3] Building debug APK ===" -ForegroundColor Cyan
Push-Location (Join-Path $ProjectDir "android")
try {
  .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { throw "Gradle assembleDebug failed" }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "=== [3/3] Copying APK to Dropbox/TailDrive ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "android-copy-debug-apk.ps1")
if ($LASTEXITCODE -ne 0) { throw "APK copy failed" }
