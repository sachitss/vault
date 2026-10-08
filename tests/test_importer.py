"""Migrates the encrypted backup written by tests/e2e.py into the relational schema and checks the result.
Run after e2e.py (tests/run_all.py does)."""
import os, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
BAK = ROOT / 'tests' / 'out' / 'backup.vaultbak'
TOOL = [sys.executable, str(ROOT / 'tools' / 'vaultbak_to_sqlite.py')]
if not BAK.exists():
    sys.exit('tests/out/backup.vaultbak missing - run tests/e2e.py first')

env = {**os.environ, 'VV_BACKUP_PASSWORD': 'backup-pass-123456'}
r = subprocess.run(TOOL + [str(BAK)], capture_output=True, text=True, env=env)
print(r.stdout[-2500:], r.stderr[-1500:])
assert r.returncode == 0, 'migration failed'
assert 'Integrity: ok; foreign-key problems: 0' in r.stdout
assert 'inventory_items        8' in r.stdout, 'expected the 8 items created by e2e.py'
# same totals as the app shows for that vault (5 sample items + gold bar + 2 imported rows)
assert 'purchase 29750.5, current 34770.5, insurance 28400.0' in r.stdout, 'totals differ from the app'

bad = subprocess.run(TOOL + [str(BAK)], capture_output=True, text=True, env={**env, 'VV_BACKUP_PASSWORD': 'wrong'})
assert bad.returncode != 0 and 'Wrong password' in (bad.stdout + bad.stderr), 'wrong password must fail'

with tempfile.TemporaryDirectory() as t:
    out = pathlib.Path(t) / 'vault.db'
    w = subprocess.run(TOOL + [str(BAK), '--out', str(out)], capture_output=True, text=True, env=env)
    assert w.returncode == 0 and out.exists() and out.stat().st_size > 0, 'database file not written'
    again = subprocess.run(TOOL + [str(BAK), '--out', str(out)], capture_output=True, text=True, env=env)
    assert again.returncode != 0 and 'refusing to overwrite' in (again.stdout + again.stderr)
print('Importer tests passed.')
