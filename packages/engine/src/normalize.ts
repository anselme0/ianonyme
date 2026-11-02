// Normalisation à la comparaison (docs/DOCUMENTATION.md, annexe A.4).
// Chaque unité UTF-16 du texte source donne exactement une unité normalisée :
// les décalages du texte normalisé sont donc ceux du texte source.

/** Caractère « invisible » : accent combinant, trait d'union conditionnel, espace de largeur nulle… */
export const INVISIBLE = '\u0001';

const INVISIBLE_RE = /[\p{M}­​-‏⁠﻿‪-‮]/u;
const DASH_RE = /[-‐-―−]/;
const APOS_RE = /['‘’‛ʼ`´]/;

export function normalizeChar(c: string): string {
  if (INVISIBLE_RE.test(c)) return INVISIBLE;
  if (/\s/.test(c)) return ' ';
  if (DASH_RE.test(c) || c === '_') return ' ';
  if (APOS_RE.test(c)) return "'";
  const base = c.normalize('NFKD')[0] ?? c;
  return base.toLowerCase()[0] ?? base;
}

export function normalizeText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += normalizeChar(text[i] as string);
  return out;
}

/** Forme canonique d'une valeur pour les comparaisons (espaces réduits, invisibles retirés). */
export function normalizeValue(value: string): string {
  return normalizeText(value).replaceAll(INVISIBLE, '').replace(/ +/g, ' ').trim();
}

export const PLACEHOLDER_SOURCE = String.raw`\[[A-Z][A-Z_]*_\d+\]`;

/** Plages occupées par des repères déjà présents dans un texte : jamais retouchées. */
export function placeholderRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(new RegExp(PLACEHOLDER_SOURCE, 'g'))) {
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

const regexCache = new Map<string, RegExp>();

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Expression qui reconnaît `normalizedValue` dans un texte normalisé, à frontières de mot. */
function valueRegex(normalizedValue: string): RegExp {
  const cached = regexCache.get(normalizedValue);
  if (cached) return cached;
  const inv = `${INVISIBLE}*`;
  let body = '';
  const chars = [...normalizedValue];
  chars.forEach((ch, i) => {
    if (ch === ' ') body += `[ ${INVISIBLE}]+`;
    else body += escapeRe(ch) + (i < chars.length - 1 && chars[i + 1] !== ' ' ? inv : '');
  });
  const first = chars[0] ?? '';
  const last = chars[chars.length - 1] ?? '';
  const before = /[\p{L}\p{N}_]/u.test(first) ? String.raw`(?<![\p{L}\p{N}_])` : '';
  const after = /[\p{L}\p{N}_]/u.test(last) ? String.raw`(?![\p{L}\p{N}_])` : '';
  const re = new RegExp(`${before}${body}${after}`, 'gu');
  if (regexCache.size > 2000) regexCache.clear();
  regexCache.set(normalizedValue, re);
  return re;
}

export interface Occurrence {
  start: number;
  end: number;
}

/** Occurrences de `value` dans `normalizedText` (déjà normalisé), frontières de mot respectées. */
export function findOccurrences(normalizedText: string, value: string): Occurrence[] {
  const nv = normalizeValue(value);
  if (nv.length === 0) return [];
  const re = valueRegex(nv);
  const out: Occurrence[] = [];
  for (const m of normalizedText.matchAll(re)) {
    if (m[0].length === 0) continue;
    const start = m.index;
    let end = m.index + m[0].length;
    while (end > start && normalizedText[end - 1] === INVISIBLE) end--;
    out.push({ start, end });
  }
  return out;
}
