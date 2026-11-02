// Restitution des valeurs dans les réponses, y compris en flux
// (docs/DOCUMENTATION.md, annexe A.3 et §11).

import { CATEGORIES } from './types.js';
import type { Anomaly, ConversationState, Segment } from './types.js';

const BRACKET_RE = /\[([^[\]\n]{1,40})\]/g;
const STRICT_RE = /^[A-Z][A-Z_]*_\d+$/;
const MAX_HELD = 41;
const HELD_RE = /^\[[A-Za-z0-9_ -]*$/;

function placeholderIndex(state: ConversationState): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of Object.values(state.entities)) map.set(e.placeholder, e.id);
  return map;
}

/** Vrai si le contenu entre crochets ressemble à un repère (même altéré). */
function looksLikePlaceholder(inner: string): boolean {
  const norm = inner.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return CATEGORIES.some((c) => norm === c || norm.startsWith(`${c}_`));
}

function pushPlain(segments: Segment[], text: string): void {
  if (text.length === 0) return;
  const last = segments[segments.length - 1];
  if (last && last.restoredFrom === undefined) last.text += text;
  else segments.push({ text });
}

function scan(
  text: string,
  offset: number,
  state: ConversationState,
  segments: Segment[],
  anomalies: Anomaly[],
): void {
  const index = placeholderIndex(state);
  let cursor = 0;
  for (const m of text.matchAll(BRACKET_RE)) {
    const inner = m[1] as string;
    if (!STRICT_RE.test(inner) && !looksLikePlaceholder(inner)) continue;
    pushPlain(segments, text.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    if (STRICT_RE.test(inner)) {
      const id = index.get(m[0]);
      const entity = id ? state.entities[id] : undefined;
      if (entity) {
        segments.push({ text: entity.canonical, restoredFrom: entity.id });
      } else {
        anomalies.push({ kind: 'unknown_placeholder', text: m[0], position: offset + m.index });
        pushPlain(segments, m[0]);
      }
    } else {
      anomalies.push({ kind: 'malformed_placeholder', text: m[0], position: offset + m.index });
      pushPlain(segments, m[0]);
    }
  }
  pushPlain(segments, text.slice(cursor));
}

export function restore(
  text: string,
  state: ConversationState,
): { restored: string; segments: Segment[]; anomalies: Anomaly[] } {
  const segments: Segment[] = [];
  const anomalies: Anomaly[] = [];
  scan(text, 0, state, segments, anomalies);
  return { restored: segments.map((s) => s.text).join(''), segments, anomalies };
}

/**
 * Restaurateur en flux : met en attente tout fragment qui commence par `[` et pourrait
 * devenir un repère, jusqu'à ce que celui-ci soit complet. Le résultat cumulé est le même
 * quel que soit le découpage du texte.
 */
export function createStreamRestorer(state: ConversationState): {
  push(chunk: string): Segment[];
  flush(): Segment[];
  anomalies: Anomaly[];
} {
  let buffer = '';
  let consumed = 0;
  const anomalies: Anomaly[] = [];

  function heldStart(): number {
    const i = buffer.lastIndexOf('[');
    if (i < 0) return -1;
    const tail = buffer.slice(i);
    return tail.length <= MAX_HELD && HELD_RE.test(tail) ? i : -1;
  }

  return {
    anomalies,
    push(chunk: string): Segment[] {
      buffer += chunk;
      const held = heldStart();
      const cut = held < 0 ? buffer.length : held;
      const ready = buffer.slice(0, cut);
      buffer = buffer.slice(cut);
      const segments: Segment[] = [];
      scan(ready, consumed, state, segments, anomalies);
      consumed += ready.length;
      return segments;
    },
    /** Fin du flux : un repère resté incomplet est retiré et signalé comme altéré. */
    flush(): Segment[] {
      const segments: Segment[] = [];
      const held = heldStart();
      if (held >= 0) {
        const tail = buffer.slice(held);
        const before = buffer.slice(0, held);
        scan(before, consumed, state, segments, anomalies);
        if (looksLikePlaceholder(tail.slice(1))) {
          anomalies.push({ kind: 'malformed_placeholder', text: tail, position: consumed + held });
        } else {
          pushPlain(segments, tail);
        }
      } else {
        scan(buffer, consumed, state, segments, anomalies);
      }
      consumed += buffer.length;
      buffer = '';
      return segments;
    },
  };
}
