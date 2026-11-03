// Runs before every build (npm "prebuild"). Turns the PROTECT_APP environment variable into public/flags.json, which the app reads
// when it starts. PROTECT_APP=false switches the developer-tools and copy protection off on that deployment; true switches it on.
// Not set: no file is written and the app protects itself only in the production build.
import { rmSync, writeFileSync } from 'node:fs';

const file = new URL('../public/flags.json', import.meta.url);
const raw = (process.env.PROTECT_APP ?? '').trim().toLowerCase();

if (!raw) {
  rmSync(file, { force: true });
  console.log('PROTECT_APP not set: protection follows the build (on in production).');
} else {
  const protect = !['false', '0', 'off', 'no'].includes(raw);
  writeFileSync(file, JSON.stringify({ protect }) + '\n');
  console.log(`PROTECT_APP=${raw}: protection ${protect ? 'on' : 'off'}.`);
}
