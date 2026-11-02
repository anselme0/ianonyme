import type { Category, Conversation, ConversationState } from '../src/index.js';
import { addManualMention, createState, ingestText, mask } from '../src/index.js';

/** Valeurs de test fictives (jamais de donnée réelle). */
export const GARNIER = 'Jean Garnier';

export function stateWith(...people: [string, Category?][]): ConversationState {
  let s = createState();
  for (const [text, cat] of people) s = addManualMention(s, text, cat ?? 'PERSONNE');
  return s;
}

export function protect(text: string, state = createState()) {
  const r = ingestText(state, text);
  const { masked, replacements } = mask(text, r.state);
  return { ...r, masked, replacements };
}

export function conv(state: ConversationState, ...clear: string[]): Conversation {
  return {
    id: 'c1',
    title: 't',
    state,
    settings: { assistantId: 'x', deepAnalysisOnMessages: true },
    messages: clear.map((c, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', clear: c })),
  };
}
