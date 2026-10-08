#!/usr/bin/env bash
# Valuables Vault - Linux installer (current user, no root needed)
#
# Installs the app to ~/ValuablesVault (a visible folder, so snap/flatpak browsers
# such as Ubuntu's Chromium can open it), adds a menu entry and icon, and a
# `valuables-vault` command in ~/.local/bin. The app opens in its own window with
# Chrome, Chromium, Edge or Brave if available, otherwise in the default browser.
# Your vault data is stored encrypted in the browser and survives updates.
#
# Powered by (c) Ing.-Büro Sachit Shrestha - support@medtec24.com
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="${VV_HOME:-$HOME/ValuablesVault}"
BIN="$HOME/.local/bin"

find_src() {
  if [ -f "$HERE/$1" ]; then echo "$HERE/$1"; elif [ -f "$HERE/$2" ]; then echo "$HERE/$2"; else
    echo "Cannot find $1 next to the installer. Extract the whole archive first." >&2; exit 1; fi
}
SRC_HTML="$(find_src valuables-vault.html ../../dist/valuables-vault.html)"
SRC_ICON="$(find_src valuables-vault.png ../../assets/icons/icon-256.png)"
SRC_UNINSTALL="$(find_src uninstall.sh uninstall.sh)"
VERSION="$(sed -n 's/.*name="generator" content="Valuables Vault \([^"]*\)".*/\1/p' "$SRC_HTML" | head -n 1)"
VERSION="${VERSION:-0.0.0}"

echo
echo "  Valuables Vault $VERSION"
echo "  Powered by Ing.-Büro Sachit Shrestha - support@medtec24.com"
echo

UPDATE=0; [ -f "$DEST/valuables-vault.html" ] && UPDATE=1
mkdir -p "$DEST" "$DATA/applications" "$DATA/icons/hicolor/256x256/apps" "$BIN"
install -m 644 "$SRC_HTML" "$DEST/valuables-vault.html"
install -m 644 "$SRC_ICON" "$DATA/icons/hicolor/256x256/apps/valuables-vault.png"
install -m 755 "$SRC_UNINSTALL" "$DEST/uninstall.sh"

cat > "$DEST/valuables-vault" <<'LAUNCHER'
#!/usr/bin/env bash
# Opens Valuables Vault in its own browser window, or in the default browser.
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
HTML="$DIR/valuables-vault.html"
URL="file://$(printf '%s' "$HTML" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g')"
for B in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser brave; do
  if command -v "$B" >/dev/null 2>&1; then
    [ -n "${VV_DRY_RUN:-}" ] && { echo "$B --app=$URL"; exit 0; }
    exec "$B" --app="$URL"
  fi
done
[ -n "${VV_DRY_RUN:-}" ] && { echo "xdg-open $URL"; exit 0; }
exec xdg-open "$URL"
LAUNCHER
chmod 755 "$DEST/valuables-vault"
ln -sf "$DEST/valuables-vault" "$BIN/valuables-vault"

cat > "$DATA/applications/valuables-vault.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Valuables Vault
GenericName=Valuables inventory
Comment=Secure inventory for valuables, safes and bank lockers
Exec="$DEST/valuables-vault"
Icon=valuables-vault
Terminal=false
Categories=Office;Finance;
Keywords=inventory;jewellery;gold;insurance;locker;safe;
StartupNotify=true
X-Version=$VERSION
DESKTOP
chmod 644 "$DATA/applications/valuables-vault.desktop"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true

if [ "$UPDATE" = 1 ]; then echo "  Updated to $VERSION. Your vault data is unchanged."; else echo "  Installed to $DEST"; fi
echo "  Start it from your application menu (\"Valuables Vault\") or run: valuables-vault"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "  (Add $BIN to your PATH to use the command.)";; esac
echo "  Tip: create an encrypted backup after your first entries (Backup > Create & verify backup)."
echo
if [ -z "${VV_NO_LAUNCH:-}" ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then ( "$DEST/valuables-vault" >/dev/null 2>&1 & ); fi
