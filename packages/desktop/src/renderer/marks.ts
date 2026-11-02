// Découpage d'un texte en morceaux surlignés, sans chevauchement.
import type { Conflict, Mention } from 'engine';
import { familyOf } from './families.js';
import type { FamilyId } from './families.js';

export type MarkKind = 'protected' | 'suggested' | 'conflict';

export interface Mark {
  id: string;
  start: number;
  end: number;
  family: FamilyId;
  kind: MarkKind;
}

export interface Piece {
  text: string;
  mark?: Mark;
}

export function marksFrom(mentions: Mention[], conflicts: Conflict[]): Mark[] {
  const conflictIds = new Set(conflicts.map((c) => c.mentionId));
  return mentions
    .filter((m) => m.status !== 'rejected')
    .map((m) => ({
      id: m.id,
      start: m.span.start,
      end: m.span.end,
      family: familyOf(m.category),
      kind: conflictIds.has(m.id) ? ('conflict' as const) : m.status === 'accepted' ? ('protected' as const) : ('suggested' as const),
    }));
}

export function splitByMarks(text: string, marks: Mark[]): Piece[] {
  const sorted = [...marks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Piece[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.start < cursor || m.end > text.length || m.end <= m.start) continue;
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start) });
    out.push({ text: text.slice(m.start, m.end), mark: m });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}
