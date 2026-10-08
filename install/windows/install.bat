@echo off
rem Valuables Vault - Windows installer (current user, no admin rights needed)
rem Powered by (c) Ing.-Buero Sachit Shrestha - support@medtec24.com
title Valuables Vault - Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
