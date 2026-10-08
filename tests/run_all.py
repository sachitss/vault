"""Run every browser test against dist/. Exit code is non-zero if any test fails."""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TESTS = ['test_db.py', 'test_db_queries.py', 'e2e.py', 'test_importer.py', 'imp.py', 'splash.py', 'test_pwa.py', 'test_i18n.py', 'test_updates.py']
failed = []
for t in TESTS:
    print(f'\n=== {t} ===', flush=True)
    r = subprocess.run([sys.executable, str(ROOT / 'tests' / t)], capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr
    print(out[-3000:])
    if r.returncode != 0 or 'Traceback' in out:
        failed.append(t)
print('\nFAILED: ' + ', '.join(failed) if failed else '\nAll tests passed.')
sys.exit(1 if failed else 0)
