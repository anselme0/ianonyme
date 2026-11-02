// LLM local : consigne, découpage et validation des propositions
// (docs/DOCUMENTATION.md, annexe C). Le LLM ne fait que proposer ; le code vérifie.

import { detect, mentionId } from './detect.js';
import { findOccurrences, normalizeText, normalizeValue } from './normalize.js';
import { entityValues } from './state.js';
import type {
  Category,
  Conflict,
  ConversationState,
  LlmCategory,
  LlmMention,
  LlmStats,
  Mention,
} from './types.js';

export const LLM_CATEGORIES: readonly LlmCategory[] = [
  'PERSONNE',
  'ORGANISATION',
  'LIEU',
  'ADRESSE',
  'FONCTION',
  'LIEN_PARENTE',
  'IDENTIFIANT',
];

export const LLM_PROMPT_TEMPLATE = `Tu aides à repérer des informations permettant d'identifier des personnes dans un document
juridique ou d'expertise. Tu ne réécris jamais le texte.

Repère les mentions qui n'ont PAS déjà été repérées par des règles simples :
- fonctions ou rôles qui désignent une personne précise (ex. « le maire de la commune ») ;
- liens de parenté ou de proximité (ex. « son beau-frère ») ;
- noms de lieux, d'organisations ou de personnes oubliés ;
- toute formulation qui désigne indirectement une personne ou une entité connue.

Pour chaque mention :
- "text" : la chaîne EXACTE, copiée telle qu'elle apparaît dans le texte, sans modification ;
- "category" : une des valeurs PERSONNE, ORGANISATION, LIEU, ADRESSE, FONCTION, LIEN_PARENTE, IDENTIFIANT ;
- "linkedTo" : le nom de référence d'une entité connue de la liste si la mention la désigne, sinon null.

Entités déjà connues : {{liste}}

Texte : {{texte}}

Réponds uniquement avec un objet JSON conforme au schéma. Si rien à signaler, renvoie {"mentions": []}.`;

/** Construit la consigne d'un morceau. Les entités connues sont listées par nom de référence. */
export function buildLlmPrompt(chunk: string, state: ConversationState): string {
  const known = Object.values(state.entities)
    .map((e) => `${e.canonical} (${e.category})`)
    .join(' ; ');
  return LLM_PROMPT_TEMPLATE.replace('{{liste}}', known.length > 0 ? known : 'aucune').replace(
    '{{texte}}',
    chunk,
  );
}

/** Découpe par paragraphes, avec un paragraphe de chevauchement. */
export function chunkText(text: string, chunkChars: number): string[] {
  const paragraphs = text.split(/\n{1,}/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 0;
  for (const p of paragraphs) {
    if (size + p.length > chunkChars && current.length > 0) {
      chunks.push(current.join('\n'));
      const overlap = current[current.length - 1] as string;
      current = overlap.length < chunkChars ? [overlap] : [];
      size = current.reduce((n, c) => n + c.length, 0);
    }
    current.push(p);
    size += p.length;
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

/** Analyse tolérante de la sortie brute du modèle. `null` si le JSON est inutilisable. */
export function parseLlmOutput(raw: string): unknown[] | null {
  const tryParse = (s: string): unknown[] | null => {
    try {
      const v: unknown = JSON.parse(s);
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object' && Array.isArray((v as { mentions?: unknown }).mentions)) {
        return (v as { mentions: unknown[] }).mentions;
      }
    } catch {
      /* essai suivant */
    }
    return null;
  };
  const direct = tryParse(raw.trim());
  if (direct) return direct;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return tryParse(raw.slice(start, end + 1));
  return null;
}

function emptyStats(): LlmStats {
  return {
    proposed: 0,
    retained: 0,
    invalidJson: 0,
    hallucinated: 0,
    invalidCategory: 0,
    duplicates: 0,
    capped: 0,
    durationMs: 0,
  };
}

function isLlmMention(x: unknown): x is LlmMention {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.text === 'string' && typeof o.category === 'string';
}

/**
 * Validation des propositions (C.5) : schéma, littéralité, dédoublonnage, rattachement, conflits, plafond.
 * `raw` peut contenir n'importe quoi : seules les entrées conformes sont retenues.
 */
export function mergeLlmMentions(
  raw: unknown[],
  text: string,
  state: ConversationState,
  options: { maxMentions?: number; invalidJson?: number } = {},
): { mentions: Mention[]; conflicts: Conflict[]; stats: LlmStats } {
  const stats = emptyStats();
  stats.invalidJson = options.invalidJson ?? 0;
  const max = options.maxMentions && options.maxMentions > 0 ? options.maxMentions : 20;
  const nt = normalizeText(text);
  const covered = detect(text, state).mentions.filter((m) => m.status === 'accepted');
  const mentions: Mention[] = [];
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    stats.proposed++;
    if (!isLlmMention(item)) {
      stats.invalidCategory++;
      continue;
    }
    if (!LLM_CATEGORIES.includes(item.category)) {
      stats.invalidCategory++;
      continue;
    }
    const value = item.text.trim();
    const nv = normalizeValue(value);
    if (nv.length === 0) {
      stats.hallucinated++;
      continue;
    }
    const occurrences = findOccurrences(nt, value);
    if (occurrences.length === 0) {
      if (text.includes(value)) stats.duplicates++;
      else stats.hallucinated++;
      continue;
    }
    if (seen.has(nv) || state.rejectedValues.includes(nv)) {
      stats.duplicates++;
      continue;
    }
    seen.add(nv);
    const fresh = occurrences.filter(
      (o) => !covered.some((m) => o.start >= m.span.start && o.end <= m.span.end),
    );
    if (fresh.length === 0) {
      stats.duplicates++;
      continue;
    }
    if (mentions.length >= max) {
      stats.capped++;
      continue;
    }
    // Rattachement : le nom de référence (ou une forme) doit désigner une entité existante.
    let candidates: string[] = [];
    if (typeof item.linkedTo === 'string' && item.linkedTo.trim().length > 0) {
      const target = normalizeValue(item.linkedTo);
      candidates = Object.values(state.entities)
        .filter((e) => entityValues(e).some((v) => normalizeValue(v) === target))
        .map((e) => e.id);
    }
    for (const occ of fresh) {
      const id = mentionId(occ.start, occ.end);
      const mention: Mention = {
        id,
        text: text.slice(occ.start, occ.end),
        span: { start: occ.start, end: occ.end },
        category: item.category as Category,
        source: 'llm',
        status: 'suggested',
      };
      if (candidates.length === 1 && candidates[0]) mention.entityId = candidates[0];
      if (candidates.length > 1) {
        conflicts.push({ mentionId: id, candidateEntityIds: candidates, reason: 'ambiguous_link' });
      }
      mentions.push(mention);
    }
    stats.retained++;
  }
  mentions.sort((a, b) => a.span.start - b.span.start);
  return { mentions, conflicts, stats };
}
