// Point de passage unique vers un fournisseur d'assistant.
// Aucun texte ne part sans avoir été masqué par `buildApiPayload` et vérifié par `checkLeak`
// dans le processus principal : un défaut d'interface ne peut pas contourner ce contrôle.

import { buildApiPayload } from 'engine';
import type { Conversation, LeakItem } from 'engine';
import type { ApiMessage, AssistantProvider, StreamOptions } from './providers/types.js';

export class LeakBlockedError extends Error {
  constructor(public readonly leaks: LeakItem[]) {
    super('leak_blocked');
    this.name = 'LeakBlockedError';
  }
}

export function preparePayload(conv: Conversation): { messages: ApiMessage[]; leaks: LeakItem[] } {
  const payload = buildApiPayload(conv);
  return {
    messages: payload.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    leaks: payload.leak.leaks,
  };
}

/**
 * Masque tout l'historique, vérifie, puis seulement alors appelle le fournisseur.
 * Lève `LeakBlockedError` (sans appeler le fournisseur) si une valeur reste visible.
 */
export function secureStream(
  provider: AssistantProvider,
  conv: Conversation,
  signal: AbortSignal,
  options?: StreamOptions,
): AsyncIterable<string> {
  const { messages, leaks } = preparePayload(conv);
  if (leaks.length > 0) throw new LeakBlockedError(leaks);
  return provider.stream(messages, signal, options);
}
