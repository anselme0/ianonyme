// Détection déterministe : motifs et règles (docs/DOCUMENTATION.md, annexe B.1).
// Principe : privilégier le rappel. Les faux positifs sont rejetés à la revue.

import {
  CIVILITY_SOURCE,
  CIVILITIES,
  LEGAL_FORM_SET,
  NAME_STOPWORDS,
  isFirstName,
} from './names.js';
import { normalizeValue } from './normalize.js';
import type { Category } from './types.js';
import { ibanValid, luhnValid, nirValid } from './validators.js';

export interface RuleHit {
  start: number;
  end: number;
  text: string;
  category: Category;
  /** Départage deux règles de même longueur : plus grand = plus spécifique. */
  priority: number;
}

const SP = String.raw`[^\S\r\n]`;
const CAP = String.raw`[A-ZÀ-ÖØ-Þ][\p{L}'’\-]*`;
const MONTHS = 'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';

function hit(
  out: RuleHit[],
  text: string,
  start: number,
  end: number,
  category: Category,
  priority: number,
): void {
  if (end > start) out.push({ start, end, text: text.slice(start, end), category, priority });
}

function isStop(token: string): boolean {
  return NAME_STOPWORDS.has(normalizeValue(token));
}

function isCivility(token: string): boolean {
  return CIVILITIES.includes(token.replace(/\.$/, ''));
}

interface Tok {
  value: string;
  start: number;
  end: number;
}

function tokenize(text: string, from: number, to: number): Tok[] {
  const out: Tok[] = [];
  for (const m of text.slice(from, to).matchAll(/[^\s  ]+/gu)) {
    out.push({ value: m[0], start: from + m.index, end: from + m.index + m[0].length });
  }
  return out;
}

/** Retire les ponctuations de fin d'un jeton (le jeton peut finir par une virgule collée). */
function cleanEnd(tok: Tok): Tok {
  const v = tok.value.replace(/[,;:.!?)\]]+$/u, '');
  return { value: v, start: tok.start, end: tok.start + v.length };
}

// ---- Coordonnées et identifiants structurés ----

function emails(text: string, out: RuleHit[]): void {
  const re = /[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)*\.\p{L}{2,}/gu;
  for (const m of text.matchAll(re)) hit(out, text, m.index, m.index + m[0].length, 'EMAIL', 7);
}

function phones(text: string, out: RuleHit[]): void {
  const sep = String.raw`[\s.\-]?`;
  const fr = new RegExp(
    String.raw`(?<![\d])(?:(?:\+|00)33${sep}\(?0?\)?${sep}[1-9](?:${sep}\d{2}){4}|0[1-9](?:${sep}\d{2}){4})(?![\d])`,
    'gu',
  );
  for (const m of text.matchAll(fr)) hit(out, text, m.index, m.index + m[0].length, 'TELEPHONE', 7);
  const intl = new RegExp(String.raw`(?<![\d])(?:\+|00)(?!33)\d{1,3}(?:${sep}\d{2,4}){3,5}(?![\d])`, 'gu');
  for (const m of text.matchAll(intl)) hit(out, text, m.index, m.index + m[0].length, 'TELEPHONE', 6);
}

function ibans(text: string, out: RuleHit[]): void {
  const re = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?(?![A-Za-z0-9])/giu;
  for (const m of text.matchAll(re)) {
    let cand = m[0];
    // Retire des groupes de fin tant que la clé n'est pas valide.
    while (cand.length >= 15) {
      if (ibanValid(cand)) {
        hit(out, text, m.index, m.index + cand.length, 'IBAN', 10);
        break;
      }
      const cut = cand.search(/[  ][^  ]*$/u);
      if (cut < 0) break;
      cand = cand.slice(0, cut);
    }
  }
}

function nirs(text: string, out: RuleHit[]): void {
  const re = new RegExp(
    String.raw`(?<![\d])[12]${SP}?\d{2}${SP}?\d{2}${SP}?(?:\d{2}|2A|2B)${SP}?\d{3}${SP}?\d{3}${SP}?\d{2}(?![\d])`,
    'gu',
  );
  for (const m of text.matchAll(re)) {
    if (nirValid(m[0])) hit(out, text, m.index, m.index + m[0].length, 'IDENTIFIANT', 9);
  }
}

function sirens(text: string, out: RuleHit[]): void {
  const re = new RegExp(String.raw`(?<![\d])\d{3}${SP}?\d{3}${SP}?\d{3}(?:${SP}?\d{5})?(?![\d])`, 'gu');
  for (const m of text.matchAll(re)) {
    const digits = m[0].replace(/\D/g, '');
    if ((digits.length === 9 || digits.length === 14) && luhnValid(digits)) {
      hit(out, text, m.index, m.index + m[0].length, 'IDENTIFIANT', 8);
    }
  }
}

function plates(text: string, out: RuleHit[]): void {
  const re = /(?<![A-Za-z\d\-])[A-Z]{2}-\d{3}-[A-Z]{2}(?![A-Za-z\d\-])/gu;
  for (const m of text.matchAll(re)) hit(out, text, m.index, m.index + m[0].length, 'IDENTIFIANT', 6);
}

function fileNumbers(text: string, out: RuleHit[]): void {
  const patterns = [
    new RegExp(String.raw`\bRG${SP}*(?:n°${SP}*)?\d{2}/\d{3,6}\b`, 'gu'),
    /\b[A-Z]{2,6}-\d{4}-\d{3,6}\b/gu,
    new RegExp(String.raw`\b[nN]°${SP}?\d{2,4}[/.\-]\d{2,}\b`, 'gu'),
    new RegExp(String.raw`\b[nN]°${SP}?\d{4,}\b`, 'gu'),
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) hit(out, text, m.index, m.index + m[0].length, 'NUM_DOSSIER', 6);
  }
}

function birthDates(text: string, out: RuleHit[]): void {
  const date = String.raw`(\d{1,2}(?:er)?${SP}+(?:${MONTHS})${SP}+\d{4}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})`;
  const re = new RegExp(
    String.raw`(?:\bné(?:e)?${SP}+le|\bdate${SP}+de${SP}+naissance${SP}*:?)${SP}+${date}`,
    'giud',
  );
  for (const m of text.matchAll(re)) {
    const idx = (m as RegExpMatchArray & { indices?: [number, number][] }).indices?.[1];
    if (idx) hit(out, text, idx[0], idx[1], 'DATE_NAISSANCE', 6);
  }
}

// ---- Adresses ----

function addresses(text: string, out: RuleHit[]): void {
  const conn = String.raw`(?:(?:de la|de|du|des|la|le|les|aux|au|sur|sous|en)${SP}+|(?:de l|d|l)['’])`;
  const part = String.raw`(?:${conn})*(?:${CAP}|\d{1,4}(?!\d))`;
  const ways = [
    'rue', 'avenue', 'boulevard', 'bd', 'chemin', 'impasse', 'place', 'allée', 'quai', 'route',
    'cours', 'square', 'passage', 'chaussée', 'villa', 'résidence', 'lotissement',
  ];
  const way = `(?:${ways.map((w) => `[${w[0]!.toUpperCase()}${w[0]}]${w.slice(1)}`).join('|')})`;
  const city = String.raw`\d{5}${SP}+${CAP}(?:${SP}+${CAP})*`;
  const re = new RegExp(
    String.raw`(?<![\p{L}\d])\d{1,4}(?:${SP}?(?:bis|ter|quater))?,?${SP}+${way}${SP}+${part}(?:${SP}+${part})*(?:,?${SP}+${city})?`,
    'gu',
  );
  for (const m of text.matchAll(re)) hit(out, text, m.index, m.index + m[0].length, 'ADRESSE', 5);
  const postal = new RegExp(String.raw`(?<![\d/.\-])${city}`, 'gu');
  for (const m of text.matchAll(postal)) hit(out, text, m.index, m.index + m[0].length, 'ADRESSE', 4);
}

// ---- Personnes ----

const SEQ = String.raw`${CAP}(?:${SP}+(?:(?:de la|de|du|des|van der|van|von|le|la)${SP}+)?${CAP})*`;

function trimTrailingStops(toks: Tok[]): Tok[] {
  const t = toks.map(cleanEnd);
  while (t.length > 0 && (isStop(t[t.length - 1]!.value) || t[t.length - 1]!.value === '')) t.pop();
  return t;
}

function people(text: string, out: RuleHit[]): void {
  // 1. Civilité suivie de mots capitalisés.
  const civ = new RegExp(String.raw`(?<![\p{L}])(${CIVILITY_SOURCE})${SP}+(${SEQ})`, 'gud');
  for (const m of text.matchAll(civ)) {
    const ind = (m as RegExpMatchArray & { indices?: [number, number][] }).indices;
    if (!ind?.[2]) continue;
    const toks = trimTrailingStops(tokenize(text, ind[2][0], ind[2][1]));
    // Arrête devant une autre civilité.
    const cut = toks.findIndex((t, i) => i > 0 && isCivility(t.value));
    const kept = cut > 0 ? toks.slice(0, cut) : toks;
    const first = kept[0];
    const last = kept[kept.length - 1];
    if (!first || !last || isStop(first.value)) continue;
    hit(out, text, m.index, last.end, 'PERSONNE', 3);
  }

  // 2. Prénom connu suivi d'un nom (capitalisé ou en majuscules).
  const seq = new RegExp(SEQ, 'gu');
  for (const m of text.matchAll(seq)) {
    const toks = tokenize(text, m.index, m.index + m[0].length).map(cleanEnd);
    for (let i = 0; i < toks.length - 1; i++) {
      const tok = toks[i]!;
      if (!isFirstName(tok.value) || isCivility(tok.value)) continue;
      let j = Math.min(toks.length - 1, i + 3);
      for (let k = i + 1; k <= j; k++) {
        if (isCivility(toks[k]!.value)) {
          j = k - 1;
          break;
        }
      }
      const kept = trimTrailingStops(toks.slice(i, j + 1));
      const last = kept[kept.length - 1];
      if (kept.length >= 2 && last && !isFirstName(last.value) && !isStop(kept[1]!.value)) {
        hit(out, text, tok.start, last.end, 'PERSONNE', 3);
        break;
      }
    }
  }

  // 3. Initiale suivie d'un nom : « P. Lacombe ».
  const initial = new RegExp(
    String.raw`(?<![\p{L}.])(?![MLN]\.)[A-ZÀ-ÖØ-Þ]\.${SP}?${CAP}(?:-${CAP})?`,
    'gu',
  );
  for (const m of text.matchAll(initial)) hit(out, text, m.index, m.index + m[0].length, 'PERSONNE', 2);
}

// ---- Organisations ----

function organisations(text: string, out: RuleHit[]): void {
  const conn = String.raw`(?:(?:et|&|de|du|des|d')${SP}+)`;
  // 1. Forme juridique : « BATIFRANCE SARL », « Société DUCRET FRÈRES SAS ».
  const seq = new RegExp(String.raw`${CAP}(?:${SP}+${conn}?${CAP})*`, 'gu');
  for (const m of text.matchAll(seq)) {
    const toks = tokenize(text, m.index, m.index + m[0].length).map(cleanEnd);
    for (let k = 1; k < toks.length; k++) {
      if (!LEGAL_FORM_SET.has(toks[k]!.value)) continue;
      const isAllCaps = (v: string): boolean => /^[A-ZÀ-ÖØ-Þ0-9'’\-&]+$/u.test(v);
      const style = isAllCaps(toks[k - 1]!.value);
      let a = k - 1;
      while (
        a - 1 >= 0 &&
        !isStop(toks[a - 1]!.value) &&
        (isAllCaps(toks[a - 1]!.value) === style || /^(et|&|de|du|des)$/.test(toks[a - 1]!.value))
      ) {
        a--;
      }
      if (/^(et|&|de|du|des)$/.test(toks[a]!.value)) a++;
      // Inclut le mot « société » qui précède directement.
      let start = toks[a]!.start;
      const before = text.slice(Math.max(0, start - 12), start);
      const prefix = /(?:Société|société|Sté|sté|Entreprise|entreprise)[  ]+$/u.exec(before);
      if (prefix) start -= prefix[0].length;
      hit(out, text, start, toks[k]!.end, 'ORGANISATION', 4);
      k = toks.length;
    }
  }

  // 2. Mot-clé suivi de mots capitalisés.
  const kw = new RegExp(
    String.raw`(?<![\p{L}])(?:Société|société|Cabinet|cabinet|Entreprise|entreprise|Association|association|Mairie|mairie|Syndicat|syndicat|Banque|banque|Clinique|clinique|Fondation|fondation|Agence|agence|Groupe|groupe)${SP}+(?:(?:de la|de|du|des|d')${SP}*)?(${CAP}(?:${SP}+${conn}?${CAP})*)`,
    'gud',
  );
  for (const m of text.matchAll(kw)) {
    const ind = (m as RegExpMatchArray & { indices?: [number, number][] }).indices;
    if (!ind?.[1]) continue;
    const toks = trimTrailingStops(tokenize(text, ind[1][0], ind[1][1]));
    const first = toks[0];
    const last = toks[toks.length - 1];
    if (!first || !last || isStop(first.value)) continue;
    hit(out, text, m.index, last.end, 'ORGANISATION', 4);
  }
}

/** Toutes les occurrences trouvées par les règles, avant résolution des chevauchements. */
export function runRules(text: string): RuleHit[] {
  const out: RuleHit[] = [];
  ibans(text, out);
  nirs(text, out);
  sirens(text, out);
  phones(text, out);
  emails(text, out);
  plates(text, out);
  fileNumbers(text, out);
  birthDates(text, out);
  addresses(text, out);
  organisations(text, out);
  people(text, out);
  return out;
}

/** Sous-ensemble utilisé par la vérification de sécurité : motifs structurés à faible bruit. */
export function runStructuredRules(text: string): RuleHit[] {
  const out: RuleHit[] = [];
  ibans(text, out);
  nirs(text, out);
  sirens(text, out);
  phones(text, out);
  emails(text, out);
  plates(text, out);
  fileNumbers(text, out);
  birthDates(text, out);
  return out;
}
