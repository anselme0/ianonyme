// Masquage et contrôle anti-fuite (docs/DOCUMENTATION.md, annexe A.4).

import { Coverage, findOccurrences, makeHaystack, normalizeValue, placeholderRanges } from './normalize.js';
import { runStructuredRules } from './rules.js';
import { CIVILITY_SOURCE } from './names.js';
import { entityValues, sharedFamily } from './state.js';
import type { ConversationState, LeakReport, LeakItem, Replacement } from './types.js';

interface Match {
  start: number;
  end: number;
  entityId: string;
  /** Repère à la place de celui de l'entité (nom de famille seul). */
  replacement?: string;
  /** Fonction ou lien de parenté de l'entité (voir `Entity.roles`). */
  role?: boolean;
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Valeur normalisée -> entités qui la portent (`skip` : valeurs à ignorer). */
function valueIndex(state: ConversationState, skip?: Set<string>): Map<string, { value: string; ids: string[] }> {
  const index = new Map<string, { value: string; ids: string[] }>();
  for (const entity of Object.values(state.entities)) {
    for (const value of entityValues(entity)) {
      const nv = normalizeValue(value);
      if (nv.length === 0 || skip?.has(nv)) continue;
      const slot = index.get(nv);
      if (!slot) index.set(nv, { value, ids: [entity.id] });
      else if (!slot.ids.includes(entity.id)) slot.ids.push(entity.id);
    }
  }
  return index;
}

const isRoleOf = (state: ConversationState, entityId: string, nv: string): boolean =>
  (state.entities[entityId]?.roles ?? []).some((r) => normalizeValue(r) === nv);

/**
 * Texte d'une fonction une fois ses éléments identifiants masqués (« maire de [LIEU_2] »), ou `null` s'il en
 * reste un (mot capitalisé hors premier mot) : la fonction est alors remplacée en entier par le repère.
 */
function keptRole(value: string, state: ConversationState, nv: string): string | null {
  // Les autres fonctions ne sont pas re-remplacées à l'intérieur : seuls les éléments identifiants le sont.
  const roles = new Set<string>([nv]);
  for (const e of Object.values(state.entities)) for (const r of e.roles ?? []) roles.add(normalizeValue(r));
  const inner = core(value, state, roles).masked;
  const tokens = inner.split(/\s+/).slice(1);
  return tokens.some((t) => /^[«"'(]?\p{Lu}/u.test(t)) ? null : inner;
}

/**
 * Remplace en une seule passe toutes les formes des entités, de la plus longue à la plus courte.
 * Une valeur partagée par plusieurs entités et non tranchée n'est pas remplacée
 * (la vérification de sécurité la signale alors comme non protégée).
 * Une fonction rattachée à une personne reste lisible à côté du repère (« [PRENOM_1] [NOM_1] (gérant) »).
 */
export function mask(
  text: string,
  state: ConversationState,
): { masked: string; replacements: Replacement[] } {
  return core(text, state, new Set());
}

function core(
  text: string,
  state: ConversationState,
  skip: Set<string>,
): { masked: string; replacements: Replacement[] } {
  const hay = makeHaystack(text);
  const blocked = placeholderRanges(text).map(([start, end]) => ({ start, end }));
  const matches: Match[] = [];
  for (const [nv, { value, ids }] of valueIndex(state, skip)) {
    let entityId: string | undefined;
    let replacement: string | undefined;
    const family = sharedFamily(state, ids, value);
    if (family && (ids.length > 1 || state.entities[ids[0] as string]?.parts)) {
      // Nom de famille seul : le repère du nom, commun à toutes les personnes qui le portent.
      entityId = family.entityId;
      replacement = family.placeholder;
    } else if (ids.length === 1) entityId = ids[0];
    else {
      const chosen = state.preferred[nv];
      if (chosen && ids.includes(chosen)) entityId = chosen;
    }
    if (!entityId) continue;
    for (const occ of findOccurrences(hay, value)) {
      if (blocked.some((b) => overlaps(b, occ))) continue;
      const role = !replacement && isRoleOf(state, entityId, nv);
      matches.push({ ...occ, entityId, ...(replacement ? { replacement } : {}), ...(role ? { role } : {}) });
    }
  }
  matches.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const picked: Match[] = [];
  const covered = new Coverage(text.length);
  for (const m of matches) {
    if (covered.overlaps(m.start, m.end)) continue;
    covered.add(m.start, m.end);
    picked.push(m);
  }
  picked.sort((a, b) => a.start - b.start);

  let masked = '';
  let cursor = 0;
  const replacements: Replacement[] = [];
  for (const [i, m] of picked.entries()) {
    const entity = state.entities[m.entityId];
    if (!entity) continue;
    if (m.role) {
      const original = text.slice(m.start, m.end);
      const inner = keptRole(original, state, normalizeValue(original));
      if (inner !== null) {
        // La fonction reste lisible ; le repère de la personne est ajouté, sauf si le nom est juste à côté.
        const gap = (a: number, b: number): boolean => /^\s*,\s*$/.test(text.slice(a, b));
        const prev = picked[i - 1];
        const next = picked[i + 1];
        const beside = (prev?.entityId === m.entityId && gap(prev.end, m.start)) || (next?.entityId === m.entityId && gap(m.end, next.start));
        const placeholder = beside ? inner : `${entity.placeholder} (${inner})`;
        masked += text.slice(cursor, m.start) + placeholder;
        replacements.push({ span: { start: m.start, end: m.end }, placeholder, entityId: m.entityId, original });
        cursor = m.end;
        continue;
      }
    }
    // Nom de famille seul : la civilité reste lisible (« Mme [NOM_2] »), elle distingue deux personnes de même nom.
    const civility = m.replacement ? (new RegExp(`^${CIVILITY_SOURCE}\\s+`, 'u').exec(text.slice(m.start, m.end))?.[0] ?? '') : '';
    const placeholder = civility + (m.replacement ?? entity.placeholder);
    masked += text.slice(cursor, m.start) + placeholder;
    replacements.push({
      span: { start: m.start, end: m.end },
      placeholder,
      entityId: m.entityId,
      original: text.slice(m.start, m.end),
    });
    cursor = m.end;
  }
  masked += text.slice(cursor);
  return { masked, replacements };
}

/**
 * Contrôle anti-fuite : aucune forme d'une entité ne doit subsister, et les motifs structurés
 * (e-mail, téléphone, IBAN, numéros…) relancés sur le texte masqué ne doivent rien trouver.
 */
export function checkLeak(masked: string, state: ConversationState): LeakReport {
  const hay = makeHaystack(masked);
  const blocked = placeholderRanges(masked).map(([start, end]) => ({ start, end }));
  const leaks: LeakItem[] = [];
  const seen = new Set<string>();
  for (const [nv, { value, ids }] of valueIndex(state)) {
    // Une fonction générique (« le gérant ») reste lisible par conception : ce n'est pas une fuite.
    if (ids.length === 1 && isRoleOf(state, ids[0] as string, nv) && keptRole(value, state, nv) === value) continue;
    for (const occ of findOccurrences(hay, value)) {
      if (blocked.some((b) => overlaps(b, occ))) continue;
      const key = `${nv}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const item: LeakItem = { value: masked.slice(occ.start, occ.end), kind: 'exact' };
      if (ids.length === 1 && ids[0]) item.entityId = ids[0];
      const owner = ids[0] ? state.entities[ids[0]] : undefined;
      if (owner) item.category = owner.category;
      leaks.push(item);
    }
  }
  // Les repères sont neutralisés (même longueur) avant de relancer les motifs.
  let neutral = masked;
  for (const b of [...blocked].reverse()) {
    neutral = neutral.slice(0, b.start) + ' '.repeat(b.end - b.start) + neutral.slice(b.end);
  }
  for (const h of runStructuredRules(neutral)) {
    const nv = normalizeValue(h.text);
    if (state.rejectedValues.includes(nv) || seen.has(nv)) continue;
    seen.add(nv);
    leaks.push({ value: h.text, kind: 'regex', category: h.category });
  }
  return { ok: leaks.length === 0, leaks };
}
