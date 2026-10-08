#!/bin/bash
# Valuables Vault - macOS installer (current user, no administrator password needed)
# Creates "Valuables Vault.app" in ~/Applications. The app opens in its own window
# with Chrome, Edge or Brave if installed, otherwise in Safari.
# Your vault data is stored encrypted in the browser, not in the app bundle, so
# updates and re-installs keep it.
#
# Powered by (c) Ing.-Büro Sachit Shrestha - support@medtec24.com
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Valuables Vault"
APPS_DIR="${VV_APPS_DIR:-$HOME/Applications}"
APP="$APPS_DIR/$APP_NAME.app"

find_src() { # $1 = file name, $2 = repository fallback
  if [ -f "$HERE/$1" ]; then echo "$HERE/$1"; elif [ -f "$HERE/$2" ]; then echo "$HERE/$2"; else
    echo "Cannot find $1 next to the installer. Unzip the whole download first." >&2; exit 1; fi
}
SRC_HTML="$(find_src valuables-vault.html ../../dist/valuables-vault.html)"
SRC_ICNS="$(find_src AppIcon.icns ../../assets/icons/AppIcon.icns)"
VERSION="$(sed -n 's/.*name="generator" content="Valuables Vault \([^"]*\)".*/\1/p' "$SRC_HTML" | head -n 1)"
VERSION="${VERSION:-0.0.0}"

echo
echo "  $APP_NAME $VERSION"
echo "  Powered by Ing.-Büro Sachit Shrestha - support@medtec24.com"
echo

UPDATE=0; [ -f "$APP/Contents/Resources/valuables-vault.html" ] && UPDATE=1
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cat "$SRC_HTML" > "$APP/Contents/Resources/valuables-vault.html"
cat "$SRC_ICNS" > "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/MacOS/valuables-vault" <<'LAUNCHER'
#!/bin/bash
# Opens Valuables Vault in its own browser window (Chromium browsers) or in Safari.
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
HTML="$RES/valuables-vault.html"
URL="file://$(printf '%s' "$HTML" | sed -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g')"
for B in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  for D in "/Applications" "$HOME/Applications"; do
    if [ -d "$D/$B.app" ]; then
      [ -n "${VV_DRY_RUN:-}" ] && { echo "open -na \"$D/$B.app\" --args --app=$URL"; exit 0; }
      exec open -na "$D/$B.app" --args --app="$URL"
    fi
  done
done
[ -n "${VV_DRY_RUN:-}" ] && { echo "open $HTML"; exit 0; }
exec open "$HTML"
LAUNCHER
chmod 755 "$APP/Contents/MacOS/valuables-vault"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>com.medtec24.valuablesvault</string>
  <key>CFBundleExecutable</key><string>valuables-vault</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.finance</string>
  <key>NSHumanReadableCopyright</key><string>© Ing.-Büro Sachit Shrestha · support@medtec24.com</string>
</dict></plist>
PLIST

# refresh Finder / Launchpad icon cache (best effort)
touch "$APP"
if [ -x /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister ]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
fi

if [ "$UPDATE" = 1 ]; then echo "  Updated to $VERSION. Your vault data is unchanged."; else echo "  Installed: $APP"; fi
echo "  Start it from Launchpad, Spotlight (\"Valuables Vault\") or ~/Applications."
echo "  Tip: create an encrypted backup after your first entries (Backup > Create & verify backup)."
echo
if [ -z "${VV_NO_LAUNCH:-}" ] && command -v open >/dev/null 2>&1; then open "$APP"; fi
