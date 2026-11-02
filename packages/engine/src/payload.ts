// Mode de validation hybride et charge utile envoyée à l'assistant
// (docs/DOCUMENTATION.md, §9 et annexe A.3 et A.5).

import { checkLeak, mask } from './mask.js';
import type { Conversation, LeakItem, LeakReport } from './types.js';

/** Revue obligatoire : fichier, suggestions du LLM en attente, ou conflit. */
export function requiresReview(input: {
  isFile: boolean;
  pendingLlmSuggestions: number;
  conflicts: number;
}): boolean {
  return input.isFile || input.pendingLlmSuggestions > 0 || input.conflicts > 0;
}

/**
 * Recalcule la version masquée de tout l'historique avec l'état courant, puis lance
 * le contrôle anti-fuite sur l'ensemble de la charge utile.
 */
export function buildApiPayload(conv: Conversation): {
  messages: { role: string; content: string }[];
  leak: LeakReport;
} {
  const messages: { role: string; content: string }[] = [];
  const leaks: LeakItem[] = [];
  conv.messages.forEach((message, messageIndex) => {
    const { masked } = mask(message.clear, conv.state);
    messages.push({ role: message.role, content: masked });
    for (const leak of checkLeak(masked, conv.state).leaks) leaks.push({ ...leak, messageIndex });
  });
  return { messages, leak: { ok: leaks.length === 0, leaks } };
}
