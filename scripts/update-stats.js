const fs   = require('fs');
const path = require('path');

const DB_URL  = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README  = path.join(__dirname, '..', 'README.md');
const BLOCK_START = '<!-- STATS_START -->';
const BLOCK_END   = '<!-- STATS_END -->';

const APPS = [
  { key: 'focus-timer',               label: 'focus timer',            url: 'https://hansenvalueinvesting.github.io/focus-timer/' },
  { key: 'newsfeed',                  label: 'newsfeed',               url: 'https://hansenvalueinvesting.github.io/newsfeed/' },
  { key: 'plant-bug-interactive-map', label: 'plant-bug interaction map', url: 'https://hansenvalueinvesting.github.io/plant-bug-interactive-map/' },
];

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

async function main() {
  if (!DB_URL) { console.error('FIREBASE_DB_URL not set'); process.exit(1); }

  console.log('Reading Firebase visit counts...');
  const res = await fetch(`${DB_URL}/visits.json`);
  if (!res.ok) { console.error(`Firebase error: HTTP ${res.status}`); process.exit(1); }

  const visits = await res.json() || {};
  let sum = 0;

  const lines = APPS.map(app => {
    const count = visits[app.key] ?? 0;
    sum += count;
    console.log(`  ${app.label}: ${fmt(count)}`);
    return `- ${app.label} [↗](${app.url}) | **${fmt(count)} uses**`;
  });

  const total = visits['total'] ?? sum;
  const date  = new Date().toISOString().slice(0, 10);

  const newBlock =
`${BLOCK_START}
${lines.join('\n')}

**${fmt(total)} total uses** · *updated ${date}*
${BLOCK_END}`;

  const readme = fs.readFileSync(README, 'utf8');
  const s = readme.indexOf(BLOCK_START);
  const e = readme.indexOf(BLOCK_END) + BLOCK_END.length;
  if (s === -1 || e < BLOCK_END.length) { console.error('Stats markers not found'); process.exit(1); }
  fs.writeFileSync(README, readme.slice(0, s) + newBlock + readme.slice(e), 'utf8');
  console.log(`✓ README.md updated — ${fmt(total)} total uses`);
}

main().catch(err => { console.error(err); process.exit(1); });
