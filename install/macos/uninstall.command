#!/bin/bash
# Valuables Vault - macOS uninstaller.
# Removes the app. Your encrypted vault data stays in the browser and is not deleted;
# to delete it too, open the app first and use Settings > Erase vault on this device.
# Powered by (c) Ing.-Büro Sachit Shrestha - support@medtec24.com
set -euo pipefail
APP="${VV_APPS_DIR:-$HOME/Applications}/Valuables Vault.app"
if [ ! -d "$APP" ]; then echo "  Valuables Vault is not installed in ${APP%/*}."; exit 0; fi
echo
echo "  This removes $APP."
echo "  Your encrypted vault data stays in the browser. Make sure you have a current backup."
if [ -z "${VV_YES:-}" ]; then
  read -r -p "  Uninstall now? (y/n) " A
  case "$A" in y|Y|yes|j|J|ja) ;; *) echo "  Cancelled."; exit 0;; esac
fi
rm -rf "$APP"
echo "  Valuables Vault has been removed."
