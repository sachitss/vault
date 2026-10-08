"""Auto-update manifest (latest.json) for the desktop apps.

  fragment <out_dir> <frag.json>
      Run in each desktop CI job after the installers are collected: moves every
      *.sig signature out of <out_dir> and records, per updater platform, which
      file it belongs to and its signature.

  merge <tag> <frag.json>... <latest.json>
      Run once after all desktop jobs: combines the fragments into latest.json with
      download URLs on the GitHub release <tag> and the release notes from
      CHANGELOG.md. The installed apps read
      https://github.com/sachitss/vault/releases/latest/download/latest.json
      and accept an update only if its signature matches the public key built in.
"""
import datetime, json, pathlib, re, sys

REPO = 'sachitss/vault'


def platforms_for(name: str):
    n = name.lower()
    if n.endswith('-setup.exe'): return ['windows-x86_64', 'windows-x86_64-nsis']
    if n.endswith('_en-us.msi'): return ['windows-x86_64-msi']
    if n.endswith('.app.tar.gz'): return ['darwin-aarch64', 'darwin-x86_64', 'darwin-aarch64-app', 'darwin-x86_64-app']
    if n.endswith('.appimage'): return ['linux-x86_64', 'linux-x86_64-appimage']
    if n.endswith('_amd64.deb'): return ['linux-x86_64-deb']        # installed with pkexec (asks for the admin password)
    if n.endswith('.x86_64.rpm'): return ['linux-x86_64-rpm']
    return []                                   # e.g. the German .msi: same app as the English one


def fragment(out_dir, frag):
    out = pathlib.Path(out_dir); data = {}
    for sig in sorted(out.glob('*.sig')):
        target = sig.with_suffix('')            # "X.AppImage.sig" -> "X.AppImage"
        sig_text = sig.read_text(encoding='utf-8').strip()
        sig.unlink()
        if not target.exists(): continue
        for p in platforms_for(target.name):
            data[p] = {'file': target.name, 'signature': sig_text}
    pathlib.Path(frag).write_text(json.dumps(data, indent=1), encoding='utf-8')
    print(f'{frag}: {", ".join(sorted(data)) or "no signed updater files (signing key secret not set?)"}')


def merge(tag, frags, dest):
    platforms = {}
    for f in frags:
        p = pathlib.Path(f)
        if p.exists(): platforms.update(json.loads(p.read_text(encoding='utf-8')))
    if not platforms:
        print('No signed updater files - latest.json not written.'); return
    version = tag.lstrip('v')
    notes = ''
    ch = pathlib.Path(__file__).resolve().parents[1] / 'CHANGELOG.md'
    if ch.exists():
        m = re.search(rf'^## {re.escape(version)}\b.*?\n(.*?)(?=^## |\Z)', ch.read_text(encoding='utf-8'), re.S | re.M)
        if m: notes = m.group(1).strip()
    manifest = {
        'version': version,
        'notes': notes[:4000],
        'pub_date': datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'platforms': {k: {'signature': v['signature'], 'url': f'https://github.com/{REPO}/releases/download/{tag}/{v["file"]}'}
                      for k, v in sorted(platforms.items())},
    }
    pathlib.Path(dest).write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'{dest}: version {version}, platforms {", ".join(manifest["platforms"])}')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'fragment': fragment(sys.argv[2], sys.argv[3])
    elif cmd == 'merge': merge(sys.argv[2], sys.argv[3:-1], sys.argv[-1])
    else: sys.exit(__doc__)
