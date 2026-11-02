// Faux fournisseur scripté : tests et démonstration hors ligne.
// Il ne comprend rien : il compose une réponse type à partir des repères qu'il reçoit,
// et la découpe en petits fragments (repères coupés compris) pour exercer la restitution en flux.
// L'interface le signale comme « Assistant de démonstration (hors ligne) ».

import { ProviderError } from './types.js';
import type { ApiMessage, AssistantProvider, StreamOptions } from './types.js';

export interface FakeOptions {
  /** Taille des fragments émis, en caractères. */
  chunkSize?: number;
  /** Pause entre deux fragments, en millisecondes. */
  delayMs?: number;
}

const DATE_RE = /\d{1,2}(?:er)?\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/iu;
const PLACEHOLDER_RE = /\[[A-Z][A-Z_]*_\d+\]/g;

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function uniquePlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_RE) ?? [])];
}

function shorten(s: string, max = 180): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Réponse type, fonction pure des messages reçus. Exportée pour les tests. */
export function scriptedReply(messages: ApiMessage[]): string {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const last = userTexts[userTexts.length - 1] ?? '';
  const all = userTexts.join('\n');

  if (/simule une panne/i.test(last)) throw new ProviderError('unreachable');

  if (/anomalie/i.test(last)) {
    const known = uniquePlaceholders(all)[0] ?? '[PERSONNE_1]';
    return `Réponse de démonstration avec repères altérés : ${known}, puis [PERSONNE_99] (inconnu) et [personne_1] (mal formé).`;
  }

  if (/chronolog/i.test(last)) {
    const facts = sentences(all).filter((s) => DATE_RE.test(s));
    const lines = facts.map((s) => {
      const date = DATE_RE.exec(s)?.[0] ?? '';
      return `- **${date}** : ${shorten(s)}`;
    });
    if (lines.length === 0) return 'Je n’ai trouvé aucune date dans les messages transmis.';
    return `Voici la chronologie des faits établie à partir des documents transmis :\n\n${lines.join('\n')}\n\nCes dates sont reprises telles qu’elles figurent dans le texte.`;
  }

  if (/r[ée]sum/i.test(last)) {
    const parts = uniquePlaceholders(all);
    const lines = sentences(all)
      .slice(0, 4)
      .map((s) => `- ${shorten(s)}`);
    return `Résumé du dossier :\n\n${lines.join('\n')}\n\nParties et éléments cités : ${parts.join(', ') || 'aucun repère'}.`;
  }

  if (/contradict/i.test(last)) {
    const hits = sentences(all).filter((s) => /conteste|n’a pas|n'a pas|refus|nie|dément/iu.test(s));
    const lines = hits.map((s) => `- ${shorten(s)}`);
    return lines.length > 0
      ? `Points pouvant relever d’une contradiction ou d’une contestation :\n\n${lines.join('\n')}\n\nÀ vérifier par vos soins sur les pièces.`
      : 'Je n’ai relevé aucune contradiction dans les messages transmis.';
  }

  const parts = uniquePlaceholders(last);
  return parts.length > 0
    ? `J’ai bien reçu votre message. Il mentionne ${parts.join(', ')}. Précisez ce que vous souhaitez faire de ces éléments.`
    : 'J’ai bien reçu votre message. Précisez ce que vous souhaitez en faire.';
}

export function createFakeProvider(
  cfg: { id: string; label: string },
  options: FakeOptions = {},
): AssistantProvider {
  const chunkSize = Math.max(1, options.chunkSize ?? 7);
  const delayMs = options.delayMs ?? 12;
  return {
    id: cfg.id,
    label: cfg.label,
    simulated: true,
    async *stream(messages: ApiMessage[], signal: AbortSignal, _options?: StreamOptions) {
      const reply = scriptedReply(messages);
      for (let i = 0; i < reply.length; i += chunkSize) {
        if (signal.aborted) return;
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        if (signal.aborted) return;
        yield reply.slice(i, i + chunkSize);
      }
    },
  };
}
