// LLM local : consigne, découpage et validation des propositions
// (docs/DOCUMENTATION.md, annexe C). Le LLM ne fait que proposer ; le code vérifie.

import { detect, mentionId } from './detect.js';
import { findOccurrences, makeHaystack, normalizeValue } from './normalize.js';
import { acceptMention, entitiesWithValue, entityValues, linkMention } from './state.js';
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

export const LLM_PROMPT_TEMPLATE = `Tu aides à protéger l'identité des personnes dans un document juridique ou d'expertise avant qu'il soit
confié à un assistant. Tu décides toi-même quoi protéger. Tu ne réécris jamais le texte.

À PROTÉGER (à renvoyer) : ce qui permet d'identifier une personne, un lieu ou une organisation précis :
- noms de personnes, de lieux, d'organisations oubliés ;
- fonction qui désigne une personne précise parce qu'elle est rattachée à un lieu ou une structure (ex. « le maire de Saint-Cloud », « le gérant de la société X ») ;
- lien de parenté ou de proximité avec une personne (ex. « son beau-frère », « la voisine du 3e ») ;
- toute formulation qui désigne indirectement une personne ou une entité connue.

À LAISSER (ne pas renvoyer) : le contexte utile à l'assistant, qui n'identifie personne :
- métiers et qualités génériques (ex. « l'architecte », « l'expert », « le propriétaire », « le locataire » seuls, sans lieu ni nom) ;
- notions, lois, termes techniques, dates sans rapport avec une identité.

Pour chaque mention à protéger :
- "text" : la chaîne EXACTE, copiée telle qu'elle apparaît dans le texte, sans modification ; pour un nom propre, uniquement le nom (« Brunet », pas « l'affaire Brunet ») ;
- "category" : une des valeurs PERSONNE, ORGANISATION, LIEU, ADRESSE, FONCTION, LIEN_PARENTE, IDENTIFIANT ;
- "linkedTo" : si la mention désigne la même personne ou entité qu'une autre, le nom de cette autre : soit une entité connue de la liste, soit le "text" d'une autre mention de ta réponse (ex. « le maire de Saint-Cloud » relié à « Jean Dupont » si le texte les identifie l'un à l'autre) ; sinon null.
  Un lien de parenté désigne la personne elle-même, pas celle à qui il se rapporte : « son beau-frère » désigne le beau-frère, jamais la personne dont il est le beau-frère. Relie-le seulement à une personne nommée que le texte présente comme étant ce beau-frère.

Entités déjà connues (déjà protégées, ne les renvoie pas) : {{liste}}

Texte : {{texte}}

Réponds uniquement avec un objet JSON conforme au schéma. Si rien à protéger, renvoie {"mentions": []}.`;

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

const PERSON_LIKE: readonly string[] = ['PERSONNE', 'FONCTION', 'LIEN_PARENTE'];

/** Un lien n'a de sens qu'entre deux désignations de personne, ou deux mentions de même catégorie. */
function compatible(a: string, b: string): boolean {
  return a === b || (PERSON_LIKE.includes(a) && PERSON_LIKE.includes(b));
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
): { mentions: Mention[]; conflicts: Conflict[]; stats: LlmStats; peerLinks: Record<string, string> } {
  const stats = emptyStats();
  stats.invalidJson = options.invalidJson ?? 0;
  const max = options.maxMentions && options.maxMentions > 0 ? options.maxMentions : 20;
  const nt = makeHaystack(text);
  const covered = detect(text, state).mentions.filter((m) => m.status === 'accepted');
  const mentions: Mention[] = [];
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  const peerLinks: Record<string, string> = {};
  const wanted: { from: string; to: string }[] = [];

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
        .filter((e) => compatible(e.category, item.category) && entityValues(e).some((v) => normalizeValue(v) === target))
        .map((e) => e.id);
    }
    if (candidates.length === 0 && typeof item.linkedTo === 'string') {
      const to = normalizeValue(item.linkedTo);
      if (to.length > 0 && to !== nv) wanted.push({ from: nv, to });
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
  // Lien entre deux propositions : seulement si la cible est elle-même retenue, et sans boucle.
  const categoryOf = new Map(mentions.map((m) => [normalizeValue(m.text), m.category]));
  for (const w of wanted) {
    const from = categoryOf.get(w.from);
    const to = categoryOf.get(w.to);
    if (from && to && compatible(from, to) && peerLinks[w.to] !== w.from) peerLinks[w.from] = w.to;
  }
  mentions.sort((a, b) => a.span.start - b.span.start);
  return { mentions, conflicts, stats, peerLinks };
}

/**
 * Accepte d'office ce que l'analyse approfondie propose, sauf les mentions ambiguës (plusieurs entités
 * possibles), laissées à l'utilisateur. Le code applique, l'utilisateur peut tout corriger ensuite.
 * Renvoie l'état et les mentions restant à vérifier.
 */
export function applyLlmMentions(
  state: ConversationState,
  mentions: Mention[],
  conflicts: Conflict[],
  peerLinks: Record<string, string>,
): { state: ConversationState; accepted: Mention[]; remaining: Mention[] } {
  const ambiguous = new Set(conflicts.map((c) => c.mentionId));
  const remaining = mentions.filter((m) => ambiguous.has(m.id));
  const todo = mentions.filter((m) => !ambiguous.has(m.id));
  const byValue = new Map<string, Mention>();
  for (const m of todo) if (!byValue.has(normalizeValue(m.text))) byValue.set(normalizeValue(m.text), m);
  let current = state;
  const accepted: Mention[] = [];
  const done = new Set<string>();
  const accept = (m: Mention, depth: number): void => {
    const nv = normalizeValue(m.text);
    if (done.has(nv)) return;
    done.add(nv);
    const targetValue = peerLinks[nv];
    const target = targetValue && depth < 5 ? byValue.get(targetValue) : undefined;
    if (target) accept(target, depth + 1);
    const owner = target ? entitiesWithValue(current, target.text)[0] : undefined;
    current = owner ? linkMention(current, m, owner.id) : acceptMention(current, m);
  };
  for (const m of todo) {
    accept(m, 0);
    accepted.push(m);
  }
  return { state: current, accepted, remaining };
}
