// scripts/update-stats.js
const fs = require('fs');
const path = require('path');

const DB_URL = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README = path.join(__dirname, '..', 'README.md');
const BLOCK_START = '<!-- STATS_START -->';
const BLOCK_END   = '<!-- STATS_END -->';

function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-US');
}

async function main() {
  if (!DB_URL) {
    console.error('Error: FIREBASE_DB_URL is not set.');
    process.exit(1);
  }

  console.log('Reading Firebase visit counts...');

  const res = await fetch(`${DB_URL}/visits.json`);
  if (!res.ok) {
    console.error(`Firebase REST error: HTTP ${res.status}`);
    process.exit(1);
  }

  const visits = await res.json();

  const focus  = visits?.['focus-timer']   ?? 0;
  const news   = visits?.['newsfeed']      ?? 0;
  const plants = visits?.['plant-bug-map'] ?? 0;
  const total  = visits?.['total']         ?? (focus + news + plants);

  console.log(`  focus-timer:   ${fmt(focus)}`);
  console.log(`  newsfeed:      ${fmt(news)}`);
  console.log(`  plant-bug-map: ${fmt(plants)}`);
  console.log(`  total:         ${fmt(total)}`);

  const date = new Date().toISOString().slice(0, 10);

  const newBlock =
`${BLOCK_START}
| app | opens (all time) |
|-----|-----------------|
| **all apps** | ${fmt(total)} |
| focus timer | ${fmt(focus)} |
| newsfeed | ${fmt(news)} |
| plant-bug map | ${fmt(plants)} |

*updated ${date}
${BLOCK_END}`;

  const readme = fs.readFileSync(README, 'utf8');
  const s = readme.indexOf(BLOCK_START);
  const e = readme.indexOf(BLOCK_END) + BLOCK_END.length;

  if (s === -1 || e < BLOCK_END.length) {
    console.error('Stats block markers not found in README.md');
    process.exit(1);
  }

  fs.writeFileSync(README, readme.slice(0, s) + newBlock + readme.slice(e), 'utf8');
  console.log(`✓ README.md updated (${date})`);
}

main().catch(err => { console.error(err); process.exit(1); });
