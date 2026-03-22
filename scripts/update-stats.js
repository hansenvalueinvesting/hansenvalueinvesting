// scripts/update-stats.js
const fs = require('fs');
const path = require('path');

const DB_URL = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README = path.join(__dirname, '..', 'README.md');
const SVG_PATH = path.join(__dirname, '..', 'stats.svg');
const BLOCK_START = '<!-- STATS_START -->';
const BLOCK_END   = '<!-- STATS_END -->';

// ── Add new apps here as you build them ──────────────────────────────────────
const APPS = [
  { key: 'focus-timer',   label: 'focus timer',   color: '#1D9E75' },
  { key: 'newsfeed',      label: 'newsfeed',       color: '#BA7517' },
  { key: 'plant-bug-interactive-map', label: 'plant-bug-interactive-map',  color: '#993556' },
];
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function generateSVG(apps, total) {
  const W = 500;
  const ROW_H = 28;
  const ROW_GAP = 10;
  const LABEL_W = 110;
  const COUNT_W = 48;
  const TRACK_W = W - LABEL_W - COUNT_W - 16;
  const TRACK_X = LABEL_W;
  const TRACK_H = 6;
  const PADDING_TOP = 48; // space for total line
  const SVG_H = PADDING_TOP + apps.length * (ROW_H + ROW_GAP);

  const maxVal = Math.max(...apps.map(a => a.count), 1);

  let rows = '';
  apps.forEach((app, i) => {
    const y = PADDING_TOP + i * (ROW_H + ROW_GAP);
    const fillW = Math.max((app.count / maxVal) * TRACK_W, app.count > 0 ? 4 : 0);
    const midY = y + ROW_H / 2;

    rows += `
  <text x="0" y="${midY + 4}" font-family="monospace" font-size="11" fill="#888">${app.label}</text>
  <rect x="${TRACK_X}" y="${midY - TRACK_H / 2}" width="${TRACK_W}" height="${TRACK_H}" rx="3" fill="#1e2530"/>
  <rect x="${TRACK_X}" y="${midY - TRACK_H / 2}" width="${fillW.toFixed(1)}" height="${TRACK_H}" rx="3" fill="${app.color}"/>
  <text x="${W}" y="${midY + 4}" font-family="monospace" font-size="11" fill="#ccc" text-anchor="end">${fmt(app.count)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SVG_H}" viewBox="0 0 ${W} ${SVG_H}">
  <rect width="${W}" height="${SVG_H}" rx="8" fill="#0d1117"/>
  <text x="0" y="20" font-family="monospace" font-size="11" fill="#555">total opens</text>
  <text x="${W}" y="20" font-family="monospace" font-size="20" fill="#ffffff" text-anchor="end" font-weight="bold">${fmt(total)}</text>
  <line x1="0" y1="32" x2="${W}" y2="32" stroke="#1e2530" stroke-width="1"/>
  ${rows}
</svg>`;
}

async function main() {
  if (!DB_URL) { console.error('FIREBASE_DB_URL not set'); process.exit(1); }

  console.log('Reading Firebase visit counts...');
  const res = await fetch(`${DB_URL}/visits.json`);
  if (!res.ok) { console.error(`Firebase error: HTTP ${res.status}`); process.exit(1); }

  const visits = await res.json() || {};
  let total = 0;

  const appsWithCounts = APPS.map(app => {
    const count = visits[app.key] ?? 0;
    total += count;
    console.log(`  ${app.label}: ${fmt(count)}`);
    return { ...app, count };
  });

  // Use stored total if available, otherwise sum
  const storedTotal = visits['total'] ?? total;

  fs.writeFileSync(SVG_PATH, generateSVG(appsWithCounts, storedTotal), 'utf8');
  console.log(`✓ stats.svg written`);

  const date = new Date().toISOString().slice(0, 10);
  const newBlock =
`${BLOCK_START}
![impact stats](stats.svg)

*updated ${date} ${time}*
${BLOCK_END}`;

  const readme = fs.readFileSync(README, 'utf8');
  const s = readme.indexOf(BLOCK_START);
  const e = readme.indexOf(BLOCK_END) + BLOCK_END.length;
  if (s === -1 || e < BLOCK_END.length) { console.error('Stats markers not found in README.md'); process.exit(1); }

  fs.writeFileSync(README, readme.slice(0, s) + newBlock + readme.slice(e), 'utf8');
  console.log(`✓ README.md updated (${date}) — ${fmt(storedTotal)} total opens`);
}

main().catch(err => { console.error(err); process.exit(1); });
