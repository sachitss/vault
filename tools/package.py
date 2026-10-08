"""Package release downloads into dist/release/ (run tools/build.py first).

  ValuablesVault-<v>-Windows.zip     install.bat, install.ps1, uninstall.ps1, app.ico, app
  ValuablesVault-<v>-macOS.zip       install.command, uninstall.command, AppIcon.icns, app
  ValuablesVault-<v>-Linux.tar.gz    install.sh, uninstall.sh, icon, app
  ValuablesVault-<v>-Standalone.html the single file, for USB sticks or manual use
  ValuablesVault-<v>-Templates.zip   Excel/CSV import templates and sample data
  SHA256SUMS.txt                     checksums of all of the above

Archives get fixed timestamps and permissions, so packaging is reproducible.
"""
import hashlib, io, json, pathlib, shutil, sys, tarfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
OUT = DIST / 'release'
STAMP = (2026, 1, 1, 0, 0, 0)
TS = 1767225600  # 2026-01-01


def readme(platform: str, steps: str, version: str) -> str:
    return f"""Valuables Vault {version} - {platform}
Secure, offline inventory for valuables, safes and bank lockers.
Powered by (c) Ing.-Büro Sachit Shrestha - support@medtec24.com

INSTALL
{steps}

YOUR DATA
- Everything is encrypted (AES-256) and stays on this device. Nothing is uploaded.
- The vault password cannot be recovered. Keep it safe.
- Data lives in the browser profile, not in the program folder, so updates keep it.
  Clearing the browser's "site data" for local files would delete it:
  make encrypted backups regularly (Backup > Create & verify backup).

UPDATE: run the installer of the new version - your data stays.
UNINSTALL: see the uninstall script in this package (data is kept unless you erase it in the app).

More: https://github.com/sachitss/vault
"""


def zip_files(path: pathlib.Path, entries):
    """entries: list of (arcname, bytes, executable)"""
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data, exe in entries:
            info = zipfile.ZipInfo(name, STAMP)
            info.external_attr = ((0o100755 if exe else 0o100644) << 16)
            info.create_system = 3  # unix, so permissions are honoured
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)


def tar_files(path: pathlib.Path, entries):
    with tarfile.open(path, 'w:gz', format=tarfile.PAX_FORMAT) as t:
        for name, data, exe in entries:
            info = tarfile.TarInfo(name); info.size = len(data); info.mtime = TS
            info.mode = 0o755 if exe else 0o644; info.uname = info.gname = 'root'
            t.addfile(info, io.BytesIO(data))


def main():
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    html_path = DIST / 'valuables-vault.html'
    if not html_path.exists():
        sys.exit('dist/valuables-vault.html missing - run tools/build.py first')
    html = html_path.read_bytes()
    if f'content="Valuables Vault {version}"'.encode() not in html:
        sys.exit('dist/valuables-vault.html is out of date - run tools/build.py')
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    rd = lambda p: (ROOT / p).read_bytes()
    base = f'ValuablesVault-{version}'
    win = f'{base}-Windows'
    zip_files(OUT / f'{win}.zip', [
        (f'{win}/install.bat', rd('install/windows/install.bat'), False),
        (f'{win}/install.ps1', rd('install/windows/install.ps1'), False),
        (f'{win}/uninstall.ps1', rd('install/windows/uninstall.ps1'), False),
        (f'{win}/app.ico', rd('assets/icons/app.ico'), False),
        (f'{win}/valuables-vault.html', html, False),
        (f'{win}/README.txt', readme('Windows 10/11', '1. Right-click the ZIP > Extract All.\r\n2. Open the extracted folder and double-click install.bat.\r\n   (If Windows SmartScreen asks: More info > Run anyway.)\r\n3. Start "Valuables Vault" from the Start menu or desktop.', version).replace('\n', '\r\n').encode('utf-8-sig'), False),
    ])
    mac = f'{base}-macOS'
    zip_files(OUT / f'{mac}.zip', [
        (f'{mac}/install.command', rd('install/macos/install.command'), True),
        (f'{mac}/uninstall.command', rd('install/macos/uninstall.command'), True),
        (f'{mac}/AppIcon.icns', rd('assets/icons/AppIcon.icns'), False),
        (f'{mac}/valuables-vault.html', html, False),
        (f'{mac}/README.txt', readme('macOS 10.13 or later', '1. Double-click the ZIP to unpack it.\n2. Right-click install.command > Open > Open\n   (needed once because the script is not from the App Store).\n3. Start "Valuables Vault" from Launchpad or Spotlight.', version).encode(), False),
    ])
    lin = f'{base}-Linux'
    tar_files(OUT / f'{lin}.tar.gz', [
        (f'{lin}/install.sh', rd('install/linux/install.sh'), True),
        (f'{lin}/uninstall.sh', rd('install/linux/uninstall.sh'), True),
        (f'{lin}/valuables-vault.png', rd('assets/icons/icon-256.png'), False),
        (f'{lin}/valuables-vault.html', html, False),
        (f'{lin}/README.txt', readme('Linux', '1. tar xzf ' + lin + '.tar.gz\n2. ./' + lin + '/install.sh\n3. Start "Valuables Vault" from your application menu or run: valuables-vault', version).encode(), False),
    ])
    (OUT / f'{base}-Standalone.html').write_bytes(html)
    zip_files(OUT / f'{base}-Templates.zip', [
        (f'{base}-Templates/{p.name}', p.read_bytes(), False)
        for p in sorted((ROOT / 'templates').iterdir()) if p.is_file()
    ])
    sums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(OUT.iterdir()))
    (OUT / 'SHA256SUMS.txt').write_text(sums)
    for p in sorted(OUT.iterdir()):
        print(f'{p.stat().st_size // 1024:>6} KB  {p.name}')


if __name__ == '__main__':
    main()
