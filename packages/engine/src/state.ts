// État d'une conversation et décisions de l'utilisateur
// (docs/DOCUMENTATION.md, annexe A.1 à A.3). Toutes les fonctions sont pures.

import { EngineError } from './errors.js';
import { normalizeValue } from './normalize.js';
import { CIVILITY_VARIANTS, ORG_KEYWORDS_STRIPPED, parseName, stripCivility, variantsFor } from './names.js';
import type { Category, ConversationState, Entity, Mention } from './types.js';

export function createState(): ConversationState {
  return { entities: {}, counters: {}, rejectedValues: [], entityCounter: 0, preferred: {} };
}

/** Toutes les formes (référence et variantes) d'une entité. */
export function entityValues(entity: Entity): string[] {
  return [entity.canonical, ...entity.variants];
}

/** Forme de référence d'une mention : sans civilité pour une personne, sans « société » pour une organisation. */
export function canonicalFor(category: Category, text: string): string {
  const t = text.trim().replace(/[   ]+/g, ' ');
  if (category === 'PERSONNE') {
    const stripped = stripCivility(t);
    return stripped.length > 0 ? stripped : t;
  }
  if (category === 'ORGANISATION') {
    const m = /^(\S+)\s+(.+)$/u.exec(t);
    if (m && ORG_KEYWORDS_STRIPPED.includes(normalizeValue(m[1] as string))) return m[2] as string;
  }
  return t;
}

export function findEntityByValue(state: ConversationState, value: string): Entity | undefined {
  const nv = normalizeValue(value);
  if (nv.length === 0) return undefined;
  return Object.values(state.entities).find((e) => entityValues(e).some((v) => normalizeValue(v) === nv));
}

/** Entités dont une forme (référence ou variante) vaut `value`. Plusieurs : ambigu. */
export function entitiesWithValue(state: ConversationState, value: string): Entity[] {
  const nv = normalizeValue(value);
  return Object.values(state.entities).filter((e) => entityValues(e).some((v) => normalizeValue(v) === nv));
}

function addVariant(entity: Entity, value: string): Entity {
  const nv = normalizeValue(value);
  if (nv.length === 0 || entityValues(entity).some((v) => normalizeValue(v) === nv)) return entity;
  return { ...entity, variants: [...entity.variants, value.trim()] };
}

/** Repère de prénom ou de nom de famille pour une valeur : créé une fois, réutilisé ensuite. */
function namePart(
  state: ConversationState,
  kind: 'PRENOM' | 'NOM',
  value: string,
): { state: ConversationState; placeholder: string } {
  const key = `${kind === 'PRENOM' ? 'G' : 'F'}:${normalizeValue(value)}`;
  const known = state.nameParts?.[key];
  if (known) return { state, placeholder: known.placeholder };
  const n = (state.counters[kind] ?? 0) + 1;
  const placeholder = `[${kind}_${n}]`;
  return {
    state: {
      ...state,
      counters: { ...state.counters, [kind]: n },
      nameParts: { ...state.nameParts, [key]: { placeholder, value } },
    },
    placeholder,
  };
}

function createEntity(state: ConversationState, category: Category, text: string): ConversationState {
  const canonical = canonicalFor(category, text);
  const entityCounter = state.entityCounter + 1;
  const id = `E${entityCounter}`;
  let base = state;
  let placeholder: string;
  let parts: Entity['parts'];
  const parsed = category === 'PERSONNE' ? parseName(canonical) : null;
  if (parsed && parsed.firstNames.length > 0 && parsed.family.length > 0) {
    // Prénom et nom séparés : « Isabelle Brunet » devient « [PRENOM_1] [NOM_1] ».
    const given = namePart(base, 'PRENOM', parsed.firstNames.join(' '));
    const family = namePart(given.state, 'NOM', parsed.family.join(' '));
    base = family.state;
    placeholder = `${given.placeholder} ${family.placeholder}`;
    parts = { given: given.placeholder, family: family.placeholder };
  } else {
    const n = (base.counters[category] ?? 0) + 1;
    base = { ...base, counters: { ...base.counters, [category]: n } };
    placeholder = `[${category}_${n}]`;
  }
  let entity: Entity = { id, category, canonical, variants: [], placeholder, ...(parts ? { parts } : {}) };
  for (const v of variantsFor(category, canonical)) entity = addVariant(entity, v);
  if (normalizeValue(text) !== normalizeValue(canonical)) entity = addVariant(entity, text);
  return { ...base, entityCounter, entities: { ...base.entities, [id]: entity } };
}

/** Formes réduites au seul nom de famille d'une personne (« Brunet », « M. Brunet »…). */
function familyOnlyForms(familyValue: string): Set<string> {
  return new Set([familyValue, ...CIVILITY_VARIANTS.map((c) => `${c} ${familyValue}`)].map(normalizeValue));
}

/**
 * Repère de nom de famille à utiliser pour `value` quand toutes les entités qui la portent n'en
 * désignent que le nom de famille (« l'affaire Brunet » quand Isabelle et Patrick Brunet existent) :
 * il n'y a alors rien à trancher. Renvoie l'entité qui porte le nom et le repère.
 */
export function sharedFamily(
  state: ConversationState,
  ids: string[],
  value: string,
): { entityId: string; placeholder: string } | undefined {
  const nv = normalizeValue(value);
  let owner: { entityId: string; placeholder: string } | undefined;
  for (const id of ids) {
    const e = state.entities[id];
    if (!e) return undefined;
    if (e.parts) {
      const fam = Object.values(state.nameParts ?? {}).find((p) => p.placeholder === e.parts?.family);
      if (!fam || !familyOnlyForms(fam.value).has(nv)) return undefined;
      if (owner && owner.placeholder !== e.parts.family) return undefined;
      owner ??= { entityId: id, placeholder: e.parts.family };
    } else if (normalizeValue(e.canonical) !== nv) {
      return undefined;
    }
  }
  return owner;
}

function withoutRejected(state: ConversationState, value: string): ConversationState {
  const nv = normalizeValue(value);
  if (!state.rejectedValues.includes(nv)) return state;
  return { ...state, rejectedValues: state.rejectedValues.filter((v) => v !== nv) };
}

function attach(state: ConversationState, entityId: string, text: string): ConversationState {
  const entity = state.entities[entityId];
  if (!entity) throw new EngineError('entity_not_found');
  const next = addVariant(entity, text);
  if (next === entity) return state;
  return { ...state, entities: { ...state.entities, [entityId]: next } };
}

function acceptText(
  state: ConversationState,
  category: Category,
  text: string,
  entityId?: string,
): ConversationState {
  if (normalizeValue(text).length === 0) throw new EngineError('empty_value');
  const base = withoutRejected(state, text);
  if (entityId) return attach(base, entityId, text);
  const existing = findEntityByValue(base, canonicalFor(category, text)) ?? findEntityByValue(base, text);
  if (existing) return attach(base, existing.id, text);
  return createEntity(base, category, text);
}

/** Accepte une mention : crée l'entité si `entityId` est absent, sinon rattache la valeur à l'entité. */
export function acceptMention(
  state: ConversationState,
  mention: Mention,
  entityId?: string,
): ConversationState {
  return acceptText(state, mention.category, mention.text, entityId ?? mention.entityId);
}

/** Rejette une mention : la valeur n'est plus jamais suggérée, et retirée de l'entité qui la portait. */
export function rejectMention(state: ConversationState, mention: Mention): ConversationState {
  const nv = normalizeValue(mention.text);
  let next: ConversationState = state.rejectedValues.includes(nv)
    ? state
    : { ...state, rejectedValues: [...state.rejectedValues, nv] };
  for (const entity of Object.values(next.entities)) {
    const values = entityValues(entity);
    if (!values.some((v) => normalizeValue(v) === nv)) continue;
    const entities = { ...next.entities };
    if (normalizeValue(entity.canonical) === nv) {
      // Rejeter la forme de référence retire toute l'entité ; un numéro n'est jamais réutilisé.
      delete entities[entity.id];
    } else {
      entities[entity.id] = {
        ...entity,
        variants: entity.variants.filter((v) => normalizeValue(v) !== nv),
      };
    }
    next = { ...next, entities };
  }
  return next;
}

/** Rattache une mention à une entité existante ; lève aussi l'ambiguïté d'une valeur partagée. */
export function linkMention(
  state: ConversationState,
  mention: Mention,
  entityId: string,
): ConversationState {
  const linked = acceptText(state, mention.category, mention.text, entityId);
  return { ...linked, preferred: { ...linked.preferred, [normalizeValue(mention.text)]: entityId } };
}

export function addManualMention(
  state: ConversationState,
  text: string,
  category: Category,
  entityId?: string,
): ConversationState {
  return acceptText(state, category, text, entityId);
}
