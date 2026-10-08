#!/usr/bin/env bash
# Valuables Vault - Linux uninstaller.
# Removes the app, menu entry, icon and command. Your encrypted vault data stays in
# the browser and is not deleted; to delete it too, open the app first and use
# Settings > Erase vault on this device.
# Powered by (c) Ing.-Büro Sachit Shrestha - support@medtec24.com
set -euo pipefail
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="${VV_HOME:-$HOME/ValuablesVault}"
echo
echo "  This removes Valuables Vault ($DEST)."
echo "  Your encrypted vault data stays in the browser. Make sure you have a current backup."
if [ -z "${VV_YES:-}" ]; then
  read -r -p "  Uninstall now? (y/n) " A
  case "$A" in y|Y|yes|j|J|ja) ;; *) echo "  Cancelled."; exit 0;; esac
fi
rm -f "$HOME/.local/bin/valuables-vault" "$DATA/applications/valuables-vault.desktop" "$DATA/icons/hicolor/256x256/apps/valuables-vault.png"
rm -f "$DEST/valuables-vault.html" "$DEST/valuables-vault" "$DEST/uninstall.sh"
rmdir "$DEST" 2>/dev/null || echo "  Kept $DEST because it contains other files (e.g. your backups)."
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
echo "  Valuables Vault has been removed."
