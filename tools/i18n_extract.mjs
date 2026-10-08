// Static half of the translation harvest: every string and template literal in the
// app source, split at HTML tags, with ${…} replaced by {0}, {1}… — these give the
// patterns for text that contains numbers, names or amounts.
// Usage: node tools/i18n_extract.mjs > tests/out/i18n-static.json
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const files = ['platform.js', 'core.js', 'ui.js', 'views2.js', 'data.js', 'updates.js'].map(f => new URL(`../src/${f}`, import.meta.url));
const out = new Set();
const letters = /[A-Za-z]{2,}/;

function addSegments(text) {
  // split on tags; inside a segment renumber placeholders from {0}
  for (let seg of text.split(/<[^>]*>/)) {
    seg = seg.replace(/\s+/g, ' ').trim();
    if (!seg) continue;
    let n = 0; const map = {};
    seg = seg.replace(/(\d+)/g, (_, i) => `{${map[i] ??= n++}}`);
    if (!letters.test(seg.replace(/\{\d\}/g, ''))) continue;
    if (/^[\w.$-]+$/.test(seg) && /[a-z][A-Z]|[._$]/.test(seg)) continue;   // identifiers, css classes
    out.add(seg);
  }
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  walk.full(ast, node => {
    if (node.type === 'Literal' && typeof node.value === 'string') addSegments(node.value);
    if (node.type === 'TemplateLiteral') {
      let s = '';
      node.quasis.forEach((q, i) => { s += q.value.cooked ?? q.value.raw; if (i < node.expressions.length) s += `${i}`; });
      addSegments(s);
    }
  });
}
process.stdout.write(JSON.stringify([...out].sort(), null, 1));
