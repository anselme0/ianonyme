// Fournisseur « openai-compatible » : modèle servi par Ollama ou llama-server sur le poste de démonstration.
// Emprunte exactement le même chemin que Claude (masquage, vérification, restitution).

import type { OpenAiConfigLike } from './registry.js';
import { ProviderError, sseData } from './types.js';
import type { ApiMessage, AssistantProvider, StreamOptions } from './types.js';

export function createOpenAiProvider(cfg: OpenAiConfigLike): AssistantProvider {
  return {
    id: cfg.id,
    label: cfg.label,
    simulated: false,
    async *stream(messages: ApiMessage[], signal: AbortSignal, options?: StreamOptions) {
      let response: Response;
      const all = options?.system ? [{ role: 'system', content: options.system }, ...messages] : messages;
      try {
        response = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: cfg.model,
            stream: true,
            ...(cfg.maxTokens ? { max_tokens: cfg.maxTokens } : {}),
            messages: all,
          }),
        });
      } catch {
        if (signal.aborted) return;
        throw new ProviderError('unreachable');
      }
      if (!response.ok) throw new ProviderError(response.status >= 500 ? 'unreachable' : 'rejected');
      for await (const data of sseData(response, signal)) {
        if (data.trim() === '[DONE]') return;
        let event: { choices?: { delta?: { content?: string } }[] };
        try {
          event = JSON.parse(data) as typeof event;
        } catch {
          continue;
        }
        const text = event.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    },
  };
}
