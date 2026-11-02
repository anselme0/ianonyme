// Copies des logos sans le bloc <metadata> (manifeste volumineux) pour les ressources de l'application.
// Les originaux d'assets/logo/ ne sont jamais modifiés.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const out = resolve(import.meta.dirname, '../src/renderer/assets');
mkdirSync(out, { recursive: true });

const strip = (svg) => svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/g, '').replace(/\s+xmlns:c2pa="[^"]*"/, '');
const read = (name) => strip(readFileSync(resolve(root, 'assets/logo', name), 'utf8'));

const icon = read('logo-court-couleurs.svg');
const full = read('logo.svg');
writeFileSync(resolve(out, 'icon.svg'), icon);
writeFileSync(resolve(out, 'logo.svg'), full);

// Fond sombre : le mot passe en blanc cassé, l'icône garde son fond marine avec un fin liseré clair.
const split = full.indexOf('<path d="M146');
const head = full.slice(0, split).replace('<rect x="0" y="0" width="112" height="112" rx="28" fill="#1B2A41"/>', '<rect x="0.5" y="0.5" width="111" height="111" rx="27.5" fill="#1B2A41" stroke="#C9D1DC" stroke-opacity="0.55"/>');
const word = full.slice(split).replaceAll('#1B2A41', '#EEF1F5');
writeFileSync(resolve(out, 'logo-dark.svg'), head + word);
const iconDark = icon.replace('<rect x="0" y="0" width="112" height="112" rx="28" fill="#1B2A41"/>', '<rect x="0.5" y="0.5" width="111" height="111" rx="27.5" fill="#1B2A41" stroke="#C9D1DC" stroke-opacity="0.55"/>');
writeFileSync(resolve(out, 'icon-dark.svg'), iconDark);
console.log('logos préparés');
