const fs   = require('fs');
const path = require('path');

const DB_URL = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README = path.join(__dirname, '..', 'README.md');

const APPS = [
  { key: 'focus-timer' },
  { key: 'newsfeed' },
  { key: 'plant-bug-interactive-map' },
];

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

async function main() {
  if (!DB_URL) { console.error('FIREBASE_DB_URL not set'); process.exit(1); }

  console.log('Reading Firebase visit counts...');
  const res = await fetch(`${DB_URL}/visits.json`);
  if (!res.ok) { console.error(`Firebase error: HTTP ${res.status}`); process.exit(1); }

  const visits = await res.json() || {};
  let sum = 0;
  let readme = fs.readFileSync(README, 'utf8');

  for (const app of APPS) {
    const count = visits[app.key] ?? 0;
    sum += count;
    console.log(`  ${app.key}: ${fmt(count)}`);
    const open  = `<!-- USES:${app.key} -->`;
    const close = `<!-- /USES:${app.key} -->`;
    const s = readme.indexOf(open);
    const e = readme.indexOf(close);
    if (s === -1 || e === -1) { console.warn(`  warning: markers not found for ${app.key}`); continue; }
    readme = readme.slice(0, s + open.length) + `${fmt(count)} uses` + readme.slice(e);
  }

  const total = visits['total'] ?? sum;
  const date  = new Date().toISOString().slice(0, 10);

  // Update total
  const ts = readme.indexOf('<!-- TOTAL_START -->');
  const te = readme.indexOf('<!-- TOTAL_END -->');
  if (ts !== -1 && te !== -1) {
    readme = readme.slice(0, ts + '<!-- TOTAL_START -->'.length)
      + `${fmt(total)} total uses · updated ${date}`
      + readme.slice(te);
  }

  fs.writeFileSync(README, readme, 'utf8');
  console.log(`✓ README.md updated — ${fmt(total)} total uses`);
}

main().catch(err => { console.error(err); process.exit(1); });
