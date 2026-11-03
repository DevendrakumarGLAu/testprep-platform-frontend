// Rebuilds src/bootstrap-icons-subset.scss: only the Bootstrap Icons that templates under src/app actually use.
//   node scripts/bootstrap-icons-subset.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const codes = JSON.parse(readFileSync('node_modules/bootstrap-icons/font/bootstrap-icons.json', 'utf8'));
const used = new Set();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(html|ts)$/.test(name)) for (const m of readFileSync(path, 'utf8').matchAll(/\bbi-([a-z0-9-]+)/g)) used.add(m[1]);
  }
};
walk('src/app');
used.delete('icons');
const unknown = [...used].filter((u) => !(u in codes));
if (unknown.length) console.warn('Not a Bootstrap icon:', unknown.join(', '));
const head = readFileSync('src/bootstrap-icons-subset.scss', 'utf8').split('\n.bi-')[0];
const BACKSLASH = String.fromCharCode(92);
const rules = [...used]
  .filter((u) => u in codes)
  .sort()
  .map((u) => '.bi-' + u + '::before { content: "' + BACKSLASH + codes[u].toString(16) + '"; }');
writeFileSync('src/bootstrap-icons-subset.scss', head + '\n' + rules.join('\n') + '\n');
console.log(rules.length + ' icons');
