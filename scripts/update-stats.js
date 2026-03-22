const fs   = require('fs');
const path = require('path');

const DB_URL      = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README      = path.join(__dirname, '..', 'README.md');
const PNG_PATH    = path.join(__dirname, '..', 'stats.png');
const BLOCK_START = '<!-- STATS_START -->';
const BLOCK_END   = '<!-- STATS_END -->';

const APPS = [
  { key: 'focus-timer',               label: 'focus timer',   color: '#1D9E75' },
  { key: 'newsfeed',                  label: 'newsfeed',      color: '#BA7517' },
  { key: 'plant-bug-interactive-map', label: 'plant-bug map', color: '#993556' },
];

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

function generateSVG(apps, total) {
  const W        = 540;
  const PAD      = 24;
  const ROW_H    = 36;
  const ROW_GAP  = 6;
  const PAD_TOP  = 64;
  const LABEL_W  = 120;
  const COUNT_W  = 56;
  const TRACK_X  = PAD + LABEL_W + 10;
  const TRACK_W  = W - TRACK_X - COUNT_W - PAD;
  const TRACK_H  = 7;
  const H        = PAD_TOP + apps.length * (ROW_H + ROW_GAP) + 28;
  const maxVal   = Math.max(...apps.map(a => a.count), 1);

  const rows = apps.map((app, i) => {
    const y      = PAD_TOP + i * (ROW_H + ROW_GAP);
    const midY   = y + ROW_H / 2;
    const fillW  = Math.max((app.count / maxVal) * TRACK_W, app.count > 0 ? 5 : 0);
    return `
    <text x="${PAD}" y="${midY + 5}" font-family="'Courier New', Courier, monospace" font-size="12" fill="#777777">${app.label}</text>
    <rect x="${TRACK_X}" y="${midY - TRACK_H / 2}" width="${TRACK_W}" height="${TRACK_H}" rx="3" fill="#1e2530"/>
    <rect x="${TRACK_X}" y="${midY - TRACK_H / 2}" width="${fillW.toFixed(1)}" height="${TRACK_H}" rx="3" fill="${app.color}"/>
    <text x="${W - PAD}" y="${midY + 5}" font-family="'Courier New', Courier, monospace" font-size="12" fill="#aaaaaa" text-anchor="end">${fmt(app.count)}</text>`;
  }).join('');

  const date = new Date().toISOString().slice(0, 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
  <text x="${PAD}" y="26" font-family="'Courier New', Courier, monospace" font-size="11" fill="#555555" letter-spacing="1">TOTAL USES</text>
  <text x="${W - PAD}" y="28" font-family="'Courier New', Courier, monospace" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="end">${fmt(total)}</text>
  <line x1="${PAD}" y1="42" x2="${W - PAD}" y2="42" stroke="#1e2530" stroke-width="1"/>
  ${rows}
  <text x="${PAD}" y="${H - 10}" font-family="'Courier New', Courier, monospace" font-size="10" fill="#333333">updated ${date} · firebase</text>
</svg>`;
}

async function main() {
  if (!DB_URL) { console.error('FIREBASE_DB_URL not set'); process.exit(1); }

  console.log('Reading Firebase visit counts...');
  const res = await fetch(`${DB_URL}/visits.json`);
  if (!res.ok) { console.error(`Firebase error: HTTP ${res.status}`); process.exit(1); }

  const visits = await res.json() || {};
  let sum = 0;
  const appsWithCounts = APPS.map(app => {
    const count = visits[app.key] ?? 0;
    sum += count;
    console.log(`  ${app.label}: ${fmt(count)}`);
    return { ...app, count };
  });
  const total = visits['total'] ?? sum;

  const svg = generateSVG(appsWithCounts, total);

  // sharp is pre-installed on ubuntu-latest GitHub Actions runners
  const sharp = require('sharp');
  await sharp(Buffer.from(svg)).png().toFile(PNG_PATH);
  console.log('✓ stats.png written');

  const date = new Date().toISOString().slice(0, 10);
  const newBlock =
`${BLOCK_START}
![impact stats](stats.png)
${BLOCK_END}`;

  const readme = fs.readFileSync(README, 'utf8');
  const s = readme.indexOf(BLOCK_START);
  const e = readme.indexOf(BLOCK_END) + BLOCK_END.length;
  if (s === -1 || e < BLOCK_END.length) { console.error('Stats markers not found'); process.exit(1); }
  fs.writeFileSync(README, readme.slice(0, s) + newBlock + readme.slice(e), 'utf8');
  console.log(`✓ README.md updated — ${fmt(total)} total opens`);
}

main().catch(err => { console.error(err); process.exit(1); });
