"""Runs every query in db/queries.sql against the sample vault and checks key results."""
import pathlib, sqlite3, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
c = sqlite3.connect(':memory:'); c.execute('PRAGMA foreign_keys = ON')
for f in ['schema.sql', 'reference_data.sql', 'seed_sample.sql']:
    c.executescript((ROOT / 'db' / f).read_text(encoding='utf-8'))

blocks = [b.strip() for b in (ROOT / 'db' / 'queries.sql').read_text(encoding='utf-8').split('\n-- Q')[1:]]
results = {}
for b in blocks:
    title, sql = b.split('\n', 1)
    q = 'Q' + title.split()[0]
    results[q] = c.execute(sql, {'item_id': '00000000-0000-4000-8000-0000000000i1'}).fetchall()
    print(f'{q:4} {len(results[q]):2} rows  {title.split(" ", 1)[1]}')

fails = []
def expect(cond, msg):
    if not cond: fails.append(msg); print('FAIL', msg)

expect(results['Q1'] == [(5, 22400.0, 27420.0, 18500.0)], f"Q1 totals {results['Q1']}")
expect(results['Q2'][0][0] == 'Diamonds & Gemstones', f"Q2 order {results['Q2']}")
expect([r[1] for r in results['Q3']] == ['COI-2026-00001', 'JWL-2026-00001'], f"Q3 lockers {results['Q3']}")
expect(results['Q4'][0][0] == 'Child (sample)' and results['Q4'][0][2] == 17320.0, f"Q4 estate {results['Q4']}")
expect(any(r[0] == 'Family member (sample)' and r[1] == 'COI-2026-00001' and r[5] == 2010.0 for r in results['Q5']), f"Q5 {results['Q5']}")
expect({r[0] for r in results['Q7']} == {'COI-2026-00001', 'WAT-2026-00001'}, f"Q7 {results['Q7']}")
expect(len(results['Q9']) == 3, f"Q9 {results['Q9']}")
expect(len(results['Q10']) == 8, f"Q10 {results['Q10']}")
print('All query checks passed.' if not fails else 'FAILED')
sys.exit(1 if fails else 0)
