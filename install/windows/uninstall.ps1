#Requires -Version 5.1
<#
.SYNOPSIS
  Removes Valuables Vault for the current user.

.DESCRIPTION
  Removes the program files, shortcuts and the Settings > Apps entry.
  Your encrypted vault data is kept in the browser profile and is NOT deleted,
  so re-installing brings it back. To delete the data as well, open the app
  first and use Settings > Erase vault on this device.

  Powered by (c) Ing.-Buero Sachit Shrestha - support@medtec24.com
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
$AppName = 'Valuables Vault'
$AppId   = 'ValuablesVault'
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set - this uninstaller is for Windows.' }
$dest = Join-Path $env:LOCALAPPDATA "Programs\$AppId"

if (-not $Quiet) {
    Write-Host ''
    Write-Host "  This removes $AppName from this computer." -ForegroundColor Cyan
    Write-Host '  Your encrypted vault data stays in the browser and is not deleted.'
    Write-Host '  Make sure you have a current encrypted backup before you continue.'
    $answer = Read-Host '  Uninstall now? (y/n)'
    if ($answer -notmatch '^(y|yes|j|ja)$') { Write-Host '  Cancelled.'; return }
}

$programs = [Environment]::GetFolderPath('Programs')
if (-not $programs) { $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs' }
$desktopDir = [Environment]::GetFolderPath('Desktop')
if (-not $desktopDir) { $desktopDir = Join-Path $env:USERPROFILE 'Desktop' }
$links = @((Join-Path $programs "$AppName.lnk"), (Join-Path $desktopDir "$AppName.lnk"))
foreach ($l in $links) {
    if ((Test-Path -LiteralPath $l) -and $PSCmdlet.ShouldProcess($l, 'Remove shortcut')) { Remove-Item -LiteralPath $l -Force }
}

$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppId"
if ((Test-Path -LiteralPath $key) -and $PSCmdlet.ShouldProcess($key, 'Remove uninstall entry')) { Remove-Item -LiteralPath $key -Recurse -Force }

if ((Test-Path -LiteralPath $dest) -and $PSCmdlet.ShouldProcess($dest, 'Remove program files')) {
    # This script runs from inside $dest; delete the other files now and the folder after exit.
    Get-ChildItem -LiteralPath $dest -Force | Where-Object { $_.FullName -ne $PSCommandPath } | Remove-Item -Recurse -Force
    $cmd = "/c timeout /t 2 /nobreak >nul & rmdir /s /q `"$dest`""
    Start-Process -FilePath 'cmd.exe' -ArgumentList $cmd -WindowStyle Hidden
}

Write-Host "  $AppName has been removed." -ForegroundColor Green
