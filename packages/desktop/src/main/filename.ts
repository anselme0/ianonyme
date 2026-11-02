// Le nom d'un fichier est traité comme une entrée (docs/DOCUMENTATION.md, §6) : il passe par la détection
// puis par le masquage. Par prudence, tout mot qui reste lisible sans être un mot courant de dossier
// est remplacé par « … » : un nom que les règles ne connaissent pas (« rapport garnier.docx »)
// ne doit pas partir en clair.

import { normalizeValue } from 'engine';

const GENERIC = new Set(
  `rapport expertise expertises compte rendu reunion note notes piece pieces annexe annexes courrier dossier
  jugement ordonnance assignation conclusions pv proces verbal constat constats devis facture contrat copie final
  finale version scan document documents brouillon audience mission avis analyse synthese chronologie lettre mail
  email courriel attestation expert judiciaire fictif demo de du des la le les et en sur sous pour par tribunal
  cour appel premiere instance dire dires partie parties technique`.split(/\s+/),
);

const PLACEHOLDER = /^\[[A-Z][A-Z_]*_\d+\]$/;

export function sanitizeFileName(maskedName: string): string {
  const dot = maskedName.lastIndexOf('.');
  const hasExt = dot > 0 && /^\.[A-Za-z0-9]{1,5}$/.test(maskedName.slice(dot));
  const base = hasExt ? maskedName.slice(0, dot) : maskedName;
  const ext = hasExt ? maskedName.slice(dot).toLowerCase() : '';
  const parts = base.split(/(\[[A-Z][A-Z_]*_\d+\]|[\s_.\-]+)/);
  let out = '';
  for (const part of parts) {
    if (part.length === 0) continue;
    if (/^[\s_.\-]+$/.test(part) || PLACEHOLDER.test(part)) out += part;
    else if (/^v?\d+$/i.test(part) || GENERIC.has(normalizeValue(part))) out += part;
    else out += '…';
  }
  const cleaned = out.replace(/…(?:[\s_.\-]*…)+/g, '…').trim();
  return `${cleaned.length > 0 ? cleaned : 'document'}${ext}`;
}
