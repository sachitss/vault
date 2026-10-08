#Requires -Version 5.1
<#
.SYNOPSIS
  Installs Valuables Vault for the current user (no administrator rights needed).

.DESCRIPTION
  Copies the app to %LOCALAPPDATA%\Programs\ValuablesVault, creates Start-menu and
  desktop shortcuts that open it in its own window (Microsoft Edge, Chrome or Brave
  in app mode; otherwise the default browser), and registers it under
  Settings > Apps so it can be uninstalled normally.

  Your vault data is NOT stored in the program folder. It lives encrypted in the
  browser profile and stays in place across updates and re-installs, as long as the
  app is opened from the same location with the same browser.

  Powered by (c) Ing.-Buero Sachit Shrestha - support@medtec24.com

.PARAMETER NoDesktopShortcut
  Do not create a desktop shortcut.

.PARAMETER NoLaunch
  Do not open the app after installing.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$NoDesktopShortcut,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$AppName   = 'Valuables Vault'
$AppId     = 'ValuablesVault'
$Publisher = 'Ing.-Büro Sachit Shrestha'
$Support   = 'support@medtec24.com'
$Here      = $PSScriptRoot

function Find-Source([string[]]$Candidates, [string]$What) {
    foreach ($c in $Candidates) {
        $p = Join-Path $Here $c
        if (Test-Path -LiteralPath $p) { return (Resolve-Path -LiteralPath $p).Path }
    }
    throw "Cannot find $What next to the installer. Extract the whole ZIP file first, then run install.bat from the extracted folder."
}

function Find-Browser {
    # Edge first (present on every Windows 10/11), then Chrome, then Brave.
    $relative = @(
        'Microsoft\Edge\Application\msedge.exe',
        'Google\Chrome\Application\chrome.exe',
        'BraveSoftware\Brave-Browser\Application\brave.exe'
    )
    $bases = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) | Where-Object { $_ }
    foreach ($r in $relative) {
        foreach ($b in $bases) {
            $p = Join-Path $b $r
            if (Test-Path -LiteralPath $p) { return $p }
        }
    }
    return $null
}

function New-Shortcut([string]$Path, [string]$Target, [string]$Arguments, [string]$WorkDir, [string]$Icon) {
    if (-not $PSCmdlet.ShouldProcess($Path, 'Create shortcut')) { return }
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($Path)
    $lnk.TargetPath = $Target
    $lnk.Arguments = $Arguments
    $lnk.WorkingDirectory = $WorkDir
    $lnk.IconLocation = "$Icon,0"
    $lnk.Description = 'Secure inventory for valuables, safes and bank lockers'
    $lnk.Save()
}

# ---- sources (release ZIP layout first, then repository layout) ----
$srcHtml      = Find-Source @('valuables-vault.html', '..\..\dist\valuables-vault.html') 'valuables-vault.html'
$srcIcon      = Find-Source @('app.ico', '..\..\assets\icons\app.ico') 'app.ico'
$srcUninstall = Find-Source @('uninstall.ps1') 'uninstall.ps1'

$version = '0.0.0'
$m = Select-String -LiteralPath $srcHtml -Pattern 'name="generator" content="Valuables Vault ([^"]+)"' | Select-Object -First 1
if ($m) { $version = $m.Matches[0].Groups[1].Value }

if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set - this installer is for Windows.' }
$dest = Join-Path $env:LOCALAPPDATA "Programs\$AppId"
$html = Join-Path $dest 'valuables-vault.html'
$icon = Join-Path $dest 'app.ico'

Write-Host ''
Write-Host "  $AppName $version" -ForegroundColor Cyan
Write-Host "  Powered by $Publisher - $Support"
Write-Host ''

$isUpdate = Test-Path -LiteralPath $html
if ($PSCmdlet.ShouldProcess($dest, 'Copy application files')) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -LiteralPath $srcHtml -Destination $html -Force
    Copy-Item -LiteralPath $srcIcon -Destination $icon -Force
    Copy-Item -LiteralPath $srcUninstall -Destination (Join-Path $dest 'uninstall.ps1') -Force
}

# ---- shortcuts: own app window when a Chromium browser is available ----
$browser = Find-Browser
$uri = ([System.Uri]$html).AbsoluteUri
if ($browser) {
    $target = $browser
    $arguments = "--app=`"$uri`""
    Write-Host "  Opens in its own window using: $browser"
} else {
    $target = $html
    $arguments = ''
    Write-Host '  No Edge/Chrome/Brave found - the app will open in your default browser.'
}

$programs = [Environment]::GetFolderPath('Programs')
if (-not $programs) { $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs' }
$startMenu = Join-Path $programs "$AppName.lnk"
New-Shortcut -Path $startMenu -Target $target -Arguments $arguments -WorkDir $dest -Icon $icon
if (-not $NoDesktopShortcut) {
    $desktopDir = [Environment]::GetFolderPath('Desktop')
    if (-not $desktopDir) { $desktopDir = Join-Path $env:USERPROFILE 'Desktop' }
    $desktop = Join-Path $desktopDir "$AppName.lnk"
    New-Shortcut -Path $desktop -Target $target -Arguments $arguments -WorkDir $dest -Icon $icon
}

# ---- Settings > Apps entry (per user) ----
$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppId"
if ($PSCmdlet.ShouldProcess($key, 'Register uninstaller')) {
    New-Item -Path $key -Force | Out-Null
    $sizeKb = [int]((Get-ChildItem -LiteralPath $dest -File | Measure-Object -Property Length -Sum).Sum / 1KB)
    $values = @{
        DisplayName     = $AppName
        DisplayVersion  = $version
        Publisher       = $Publisher
        DisplayIcon     = $icon
        InstallLocation = $dest
        UninstallString = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $dest 'uninstall.ps1')`""
        HelpLink        = "mailto:$Support"
        URLInfoAbout    = 'https://github.com/sachitss/vault'
    }
    foreach ($k in $values.Keys) { New-ItemProperty -Path $key -Name $k -Value $values[$k] -PropertyType String -Force | Out-Null }
    foreach ($k in @('NoModify', 'NoRepair')) { New-ItemProperty -Path $key -Name $k -Value 1 -PropertyType DWord -Force | Out-Null }
    New-ItemProperty -Path $key -Name 'EstimatedSize' -Value $sizeKb -PropertyType DWord -Force | Out-Null
}

Write-Host ''
if ($isUpdate) {
    Write-Host "  Updated to $version. Your vault data is unchanged." -ForegroundColor Green
} else {
    Write-Host "  Installed to $dest" -ForegroundColor Green
}
Write-Host '  Start it from the Start menu or the desktop shortcut "Valuables Vault".'
Write-Host '  Tip: create an encrypted backup after your first entries (Backup > Create & verify backup).'
Write-Host ''

if (-not $NoLaunch -and $PSCmdlet.ShouldProcess($AppName, 'Launch')) {
    if ($browser) { Start-Process -FilePath $browser -ArgumentList $arguments } else { Start-Process -FilePath $html }
}
