// Détection déterministe : règles + variantes des entités connues
// (docs/DOCUMENTATION.md, annexe A.3 et B).

import { Coverage, makeHaystack, normalizeValue, findOccurrences, placeholderRanges } from './normalize.js';
import { runRules } from './rules.js';
import type { Category, Conflict, ConversationState, Mention } from './types.js';
import type { Haystack } from './normalize.js';
import { canonicalFor, entityValues } from './state.js';
import { parseName } from './names.js';

interface Candidate {
  start: number;
  end: number;
  kind: 'rule' | 'entity';
  category: Category;
  priority: number;
  entityIds: string[];
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function mentionId(start: number, end: number): string {
  return `m${start}_${end}`;
}

/** Candidats issus des entités connues : toutes leurs formes, dans tout le texte. */
function entityCandidates(nt: Haystack, state: ConversationState): Candidate[] {
  const bySpan = new Map<string, Candidate>();
  for (const entity of Object.values(state.entities)) {
    for (const value of entityValues(entity)) {
      for (const occ of findOccurrences(nt, value)) {
        const key = `${occ.start}:${occ.end}`;
        const existing = bySpan.get(key);
        if (!existing) {
          bySpan.set(key, {
            start: occ.start,
            end: occ.end,
            kind: 'entity',
            category: entity.category,
            priority: 0,
            entityIds: [entity.id],
          });
        } else if (!existing.entityIds.includes(entity.id)) {
          existing.entityIds.push(entity.id);
        }
      }
    }
  }
  return [...bySpan.values()];
}

export function detect(
  text: string,
  state: ConversationState,
): { mentions: Mention[]; conflicts: Conflict[] } {
  const nt = makeHaystack(text);
  const blocked = placeholderRanges(text).map(([start, end]) => ({ start, end }));
  const free = <T extends { start: number; end: number }>(c: T): boolean =>
    !blocked.some((b) => overlaps(b, c));

  const entityCands = entityCandidates(nt, state).filter(free);
  const ruleCands: Candidate[] = runRules(text)
    .filter((h) => !state.rejectedValues.includes(normalizeValue(h.text)))
    .map((h) => ({
      start: h.start,
      end: h.end,
      kind: 'rule' as const,
      category: h.category,
      priority: h.priority,
      entityIds: [],
    }))
    .filter(free);

  const all = [...ruleCands, ...entityCands].sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      (a.kind === b.kind ? 0 : a.kind === 'rule' ? -1 : 1) ||
      b.priority - a.priority ||
      a.start - b.start,
  );
  const picked: Candidate[] = [];
  const covered = new Coverage(text.length);
  for (const c of all) {
    if (covered.overlaps(c.start, c.end)) continue;
    covered.add(c.start, c.end);
    picked.push(c);
  }
  picked.sort((a, b) => a.start - b.start);

  const mentions: Mention[] = [];
  const conflicts: Conflict[] = [];
  for (const c of picked) {
    const id = mentionId(c.start, c.end);
    const value = text.slice(c.start, c.end);
    let ids = c.entityIds;
    if (c.kind === 'rule') {
      const exact = entityCands.filter((e) => e.start === c.start && e.end === c.end);
      const overlapping = entityCands.filter((e) => e.category === c.category && overlaps(e, c));
      const pool = exact.length > 0 ? exact : overlapping;
      ids = [...new Set(pool.flatMap((e) => e.entityIds))];
      if (c.category === 'PERSONNE' && exact.length === 0) {
        ids = ids.filter((id) => sameFirstName(state, id, text.slice(c.start, c.end)));
      }
    }
    if (ids.length > 1) {
      const chosen = state.preferred[normalizeValue(value)];
      if (chosen && ids.includes(chosen)) ids = [chosen];
    }
    if (ids.length > 1) {
      mentions.push({
        id,
        text: value,
        span: { start: c.start, end: c.end },
        category: c.category,
        source: c.kind === 'rule' ? 'regex' : 'variant',
        status: 'suggested',
      });
      conflicts.push({
        mentionId: id,
        candidateEntityIds: ids,
        reason: 'ambiguous_entity',
      });
      continue;
    }
    const mention: Mention = {
      id,
      text: value,
      span: { start: c.start, end: c.end },
      category: c.category,
      source: c.kind === 'rule' ? 'regex' : 'variant',
      status: 'accepted',
    };
    if (ids[0]) mention.entityId = ids[0];
    mentions.push(mention);
  }
  return { mentions, conflicts };
}

/** Deux personnes ne peuvent être la même si leurs prénoms (ou initiales) diffèrent. */
function sameFirstName(state: ConversationState, entityId: string, hitText: string): boolean {
  const entity = state.entities[entityId];
  if (!entity) return false;
  const hitFirst = parseName(canonicalFor('PERSONNE', hitText)).firstNames[0];
  const entFirst = parseName(entity.canonical).firstNames[0];
  if (!hitFirst || !entFirst) return true;
  return normalizeValue(hitFirst)[0] === normalizeValue(entFirst)[0];
}
