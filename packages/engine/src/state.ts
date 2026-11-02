// État d'une conversation et décisions de l'utilisateur
// (docs/DOCUMENTATION.md, annexe A.1 à A.3). Toutes les fonctions sont pures.

import { EngineError } from './errors.js';
import { normalizeValue } from './normalize.js';
import { ORG_KEYWORDS_STRIPPED, stripCivility, variantsFor } from './names.js';
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

function createEntity(state: ConversationState, category: Category, text: string): ConversationState {
  const canonical = canonicalFor(category, text);
  const n = (state.counters[category] ?? 0) + 1;
  const entityCounter = state.entityCounter + 1;
  const id = `E${entityCounter}`;
  let entity: Entity = {
    id,
    category,
    canonical,
    variants: [],
    placeholder: `[${category}_${n}]`,
  };
  for (const v of variantsFor(category, canonical)) entity = addVariant(entity, v);
  if (normalizeValue(text) !== normalizeValue(canonical)) entity = addVariant(entity, text);
  return {
    ...state,
    entityCounter,
    counters: { ...state.counters, [category]: n },
    entities: { ...state.entities, [id]: entity },
  };
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
