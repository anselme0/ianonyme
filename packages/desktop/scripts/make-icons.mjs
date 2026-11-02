// Produit l'icône de l'application (PNG et .ico) à partir de l'icône seule d'assets/logo/.
// Le rendu utilise Chromium, déjà présent via Electron : aucune dépendance de plus.
// Usage : node scripts/make-icons.mjs  (après `node scripts/prepare-assets.mjs`)

import { _electron as electron } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'src/renderer/assets/icon.svg'), 'utf8');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const app = await electron.launch({ args: [resolve(root, 'scripts/icon-host.cjs')] });
const page = await app.firstWindow();
const png = {};
for (const size of [...SIZES, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`,
  );
  png[size] = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await app.close();

mkdirSync(resolve(root, 'resources'), { recursive: true });
mkdirSync(resolve(root, 'build'), { recursive: true });
writeFileSync(resolve(root, 'resources/icon.png'), png[512]);
writeFileSync(resolve(root, 'build/icon.png'), png[512]);

// Fichier .ico : entrées PNG (acceptées depuis Windows Vista).
const count = SIZES.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(count, 4);
const entries = [];
let offset = 6 + 16 * count;
for (const size of SIZES) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size >= 256 ? 0 : size, 0);
  e.writeUInt8(size >= 256 ? 0 : size, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png[size].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png[size].length;
  entries.push(e);
}
writeFileSync(resolve(root, 'build/icon.ico'), Buffer.concat([header, ...entries, ...SIZES.map((s) => png[s])]));
console.log('icônes écrites : resources/icon.png, build/icon.ico');
