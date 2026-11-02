// Enchaînements utilisés par l'application : repérage automatique d'un texte,
// protection d'un nom de fichier, décompte pour le volet Protection.

import { detect } from './detect.js';
import { mask } from './mask.js';
import { normalizeValue } from './normalize.js';
import { acceptMention, entityValues } from './state.js';
import type { Conflict, ConversationState, Mention } from './types.js';

/**
 * Détecte puis accepte automatiquement ce que les règles et les variantes ont repéré.
 * Les conflits restent à trancher par l'utilisateur. Répète jusqu'à stabilité, car une entité
 * nouvelle apporte de nouvelles variantes (« Mme Moreau » après « Isabelle Moreau »).
 */
export function ingestText(
  state: ConversationState,
  text: string,
): { state: ConversationState; mentions: Mention[]; conflicts: Conflict[] } {
  let current = state;
  for (let round = 0; round < 10; round++) {
    const { mentions } = detect(text, current);
    let changed = false;
    // Les formes les plus longues d'abord : elles portent la forme de référence la plus complète.
    const ordered = [...mentions].sort((a, b) => b.text.length - a.text.length);
    for (const mention of ordered) {
      if (mention.status !== 'accepted') continue;
      const entity = mention.entityId ? current.entities[mention.entityId] : undefined;
      const known =
        entity && entityValues(entity).some((v) => normalizeValue(v) === normalizeValue(mention.text));
      if (known) continue;
      current = acceptMention(current, mention);
      changed = true;
    }
    if (!changed) break;
  }
  const final = detect(text, current);
  return { state: current, mentions: final.mentions, conflicts: final.conflicts };
}

/** Nom de fichier traité comme une entrée : détecté, accepté puis masqué. */
export function protectFileName(
  state: ConversationState,
  fileName: string,
): { state: ConversationState; maskedName: string } {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  // Les séparateurs usuels des noms de fichier deviennent des espaces pour la détection.
  const readable = base.replace(/[_]+/g, ' ');
  const { state: next } = ingestText(state, readable);
  const { masked } = mask(readable, next);
  return { state: next, maskedName: `${masked}${ext}` };
}

export interface ProtectionSummary {
  protectedCount: number;
  toReview: number;
}

/** Nombre d'éléments protégés (entités) et de points à vérifier. */
export function summarize(
  state: ConversationState,
  pendingSuggestions: number,
  conflicts: number,
): ProtectionSummary {
  return { protectedCount: Object.keys(state.entities).length, toReview: pendingSuggestions + conflicts };
}
