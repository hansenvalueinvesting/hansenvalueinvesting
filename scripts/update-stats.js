const fs   = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const DB_URL     = (process.env.FIREBASE_DB_URL || '').replace(/\/$/, '');
const README     = path.join(__dirname, '..', 'README.md');
const PNG_PATH   = path.join(__dirname, '..', 'stats.png');
const BLOCK_START = '<!-- STATS_START -->';
const BLOCK_END   = '<!-- STATS_END -->';

const APPS = [
  { key: 'focus-timer',               label: 'focus timer',   color: '#1D9E75' },
  { key: 'newsfeed',                  label: 'newsfeed',      color: '#BA7517' },
  { key: 'plant-bug-interactive-map', label: 'plant-bug map', color: '#993556' },
];

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

function setPixel(data, width, x, y, r, g, b, a=255) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=a;
}

function fillRect(data, W, x, y, w, h, r, g, b) {
  for (let py = y; py < y+h; py++)
    for (let px = x; px < x+w; px++)
      setPixel(data, W, px, py, r, g, b);
}

function fillRoundRect(data, W, x, y, w, h, radius, r, g, b) {
  // Fill main body
  fillRect(data, W, x+radius, y, w-radius*2, h, r, g, b);
  fillRect(data, W, x, y+radius, w, h-radius*2, r, g, b);
  // Corners (approximate with small filled squares)
  for (let cy = 0; cy < radius; cy++)
    for (let cx = 0; cx < radius; cx++) {
      const dist = Math.sqrt((cx-radius+0.5)**2 + (cy-radius+0.5)**2);
      if (dist <= radius) {
        setPixel(data, W, x+cx, y+cy, r, g, b);
        setPixel(data, W, x+w-1-cx, y+cy, r, g, b);
        setPixel(data, W, x+cx, y+h-1-cy, r, g, b);
        setPixel(data, W, x+w-1-cx, y+h-1-cy, r, g, b);
      }
    }
}

// Tiny bitmap font — 5x7, digits 0-9 + comma + space
const GLYPHS = {
  '0':[[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  '1':[[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  '2':[[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  '3':[[1,1,1],[0,0,1],[0,1,1],[0,0,1],[1,1,1]],
  '4':[[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5':[[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  '6':[[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  '7':[[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '8':[[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  '9':[[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
  ',':[[0,0],[0,0],[0,0],[0,1],[1,0]],
  ' ':[[0,0],[0,0],[0,0],[0,0],[0,0]],
  'a':[[0,1,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  'b':[[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  'c':[[0,1,1],[1,0,0],[1,0,0],[1,0,0],[0,1,1]],
  'd':[[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  'e':[[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  'f':[[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
  'g':[[0,1,1],[1,0,0],[1,0,1],[1,0,1],[0,1,1]],
  'h':[[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  'i':[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  'j':[[0,0,1],[0,0,1],[0,0,1],[1,0,1],[0,1,1]],
  'k':[[1,0,1],[1,1,0],[1,0,0],[1,1,0],[1,0,1]],
  'l':[[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  'm':[[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
  'n':[[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  'o':[[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  'p':[[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
  'r':[[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
  's':[[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
  't':[[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
  'u':[[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,1]],
  'w':[[1,0,1],[1,0,1],[1,1,1],[1,1,1],[1,0,1]],
  '-':[[0,0,0],[0,0,0],[1,1,1],[0,0,0],[0,0,0]],
  ':':[[0,0],[0,1],[0,0],[0,1],[0,0]],
  '/':[[0,0,1],[0,0,1],[0,1,0],[1,0,0],[1,0,0]],
  '·':[[0,0],[0,0],[0,1],[0,0],[0,0]],
};

function drawText(data, W, text, startX, startY, r, g, b, scale=2) {
  let x = startX;
  for (const ch of text.toLowerCase()) {
    const glyph = GLYPHS[ch];
    if (!glyph) { x += (3+1)*scale; continue; }
    const gW = glyph[0].length;
    for (let row=0; row<glyph.length; row++)
      for (let col=0; col<gW; col++)
        if (glyph[row][col])
          for (let sy=0; sy<scale; sy++)
            for (let sx=0; sx<scale; sx++)
              setPixel(data, W, x+col*scale+sx, startY+row*scale+sy, r, g, b);
    x += (gW+1)*scale;
  }
  return x;
}

function generatePNG(apps, total) {
  const SCALE   = 2;
  const W       = 540;
  const PAD     = 20;
  const LABEL_W = 110;
  const TRACK_W = W - PAD*2 - LABEL_W - 55;
  const TRACK_H = 8;
  const ROW_H   = 30;
  const ROW_GAP = 8;
  const PAD_TOP = 54;
  const H       = PAD_TOP + apps.length*(ROW_H+ROW_GAP) + 20;

  const png = new PNG({ width: W*SCALE, height: H*SCALE, filterType: -1 });
  const data = png.data;
  const sw = W*SCALE;

  // BG
  fillRoundRect(data, sw, 0, 0, W*SCALE, H*SCALE, 16, 0x0d, 0x11, 0x17);

  // "total opens" label
  drawText(data, sw, 'total opens', PAD*SCALE, 14*SCALE, 0x55, 0x55, 0x55, SCALE);

  // Total number (big)
  const totalStr = fmt(total);
  const numScale = 3;
  const numW = totalStr.length * (3+1) * numScale;
  drawText(data, sw, totalStr, (W - PAD - numW/SCALE)*SCALE, 10*SCALE, 0xff, 0xff, 0xff, numScale);

  // Divider
  fillRect(data, sw, PAD*SCALE, 34*SCALE, (W-PAD*2)*SCALE, SCALE, 0x1e, 0x25, 0x30);

  const maxVal = Math.max(...apps.map(a => a.count), 1);

  apps.forEach((app, i) => {
    const y    = PAD_TOP + i*(ROW_H+ROW_GAP);
    const midY = y + ROW_H/2 - 4;

    // Label
    drawText(data, sw, app.label, PAD*SCALE, midY*SCALE, 0x88, 0x88, 0x88, SCALE);

    // Track bg
    const tx = (PAD + LABEL_W)*SCALE;
    const ty = (midY + 2)*SCALE;
    fillRoundRect(data, sw, tx, ty, TRACK_W*SCALE, TRACK_H*SCALE, 3*SCALE, 0x1e, 0x25, 0x30);

    // Track fill
    const fillW = Math.max((app.count/maxVal)*TRACK_W, app.count>0?4:0);
    if (fillW > 0) {
      const [cr,cg,cb] = hexToRgb(app.color);
      fillRoundRect(data, sw, tx, ty, fillW*SCALE, TRACK_H*SCALE, 3*SCALE, cr, cg, cb);
    }

    // Count
    const countStr = fmt(app.count);
    const cw = countStr.length*(3+1)*SCALE;
    drawText(data, sw, countStr, (W-PAD)*SCALE - cw, midY*SCALE, 0xcc, 0xcc, 0xcc, SCALE);
  });

  // "updated ... firebase · raw opens" footer
  const date = new Date().toISOString().slice(0,10);
  const footer = `updated ${date}`;
  const footerY = PAD_TOP + apps.length*(ROW_H+ROW_GAP) + 6;
  drawText(data, sw, footer, PAD*SCALE, footerY*SCALE, 0x33, 0x33, 0x33, SCALE);

  return PNG.sync.write(png);
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

  fs.writeFileSync(PNG_PATH, generatePNG(appsWithCounts, total));
  console.log('✓ stats.png written');

  const date = new Date().toISOString().slice(0,10);
  const newBlock =
`${BLOCK_START}
![impact stats](stats.png)

*updated ${date} · firebase · raw opens*
${BLOCK_END}`;

  const readme = fs.readFileSync(README, 'utf8');
  const s = readme.indexOf(BLOCK_START);
  const e = readme.indexOf(BLOCK_END) + BLOCK_END.length;
  if (s===-1 || e<BLOCK_END.length) { console.error('Stats markers not found'); process.exit(1); }
  fs.writeFileSync(README, readme.slice(0,s)+newBlock+readme.slice(e), 'utf8');
  console.log(`✓ README.md updated — ${fmt(total)} total opens`);
}

main().catch(err => { console.error(err); process.exit(1); });
