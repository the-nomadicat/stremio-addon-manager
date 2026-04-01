param(
  [string]$SourceApk = "",
  [string]$DestDir = "",
  [string]$AppName = "StremioAddonManager"
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path $PSScriptRoot -Parent

if ([string]::IsNullOrWhiteSpace($SourceApk)) {
  $SourceApk = Join-Path $ProjectDir "android\app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path -LiteralPath $SourceApk)) {
  throw "APK source not found: $SourceApk"
}

if ([string]::IsNullOrWhiteSpace($DestDir)) {
  $wc = Get-Service WebClient -ErrorAction SilentlyContinue
  if ($wc -and $wc.Status -ne "Running") {
    Start-Service WebClient
  }

  $preferredTailDrive = "Z:\atkins.email@gmail.com\zephyrusg16\dropboxapps\$AppName"
  $fallbackTailDrive = "T:\atkins.email@gmail.com\zephyrusg16\dropboxapps\$AppName"

  if (Test-Path "Z:\") {
    $DestDir = $preferredTailDrive
  } else {
    if (-not (Test-Path "T:\")) {
      net use T: http://100.100.100.100:8080 /persistent:no | Out-Null
    }
    $DestDir = $fallbackTailDrive
  }
}

if (-not (Test-Path -LiteralPath $DestDir)) {
  New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
}

$packageJson = Get-Content -LiteralPath (Join-Path $ProjectDir "package.json") -Raw | ConvertFrom-Json
$version = [string]$packageJson.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "Could not determine app version from package.json"
}

$destinationPath = Join-Path $DestDir "$AppName $version.apk"
Copy-Item -LiteralPath $SourceApk -Destination $destinationPath -Force

$copied = Get-Item -LiteralPath $destinationPath
Write-Host "Copied APK:"
Write-Host ("  Path : " + $copied.FullName)
Write-Host ("  Size : " + [math]::Round($copied.Length / 1MB, 2) + " MB")
