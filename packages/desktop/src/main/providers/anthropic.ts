// Fournisseur « anthropic » (Claude). Le modèle et la clé viennent de la configuration.
// Écrit et testé contre un faux serveur local ; non testé contre le service réel (aucune clé cette nuit).

import type { AnthropicConfigLike } from './registry.js';
import { ProviderError, sseData } from './types.js';
import type { ApiMessage, AssistantProvider, StreamOptions } from './types.js';

const DEFAULT_BASE = 'https://api.anthropic.com';

export function createAnthropicProvider(cfg: AnthropicConfigLike): AssistantProvider {
  return {
    id: cfg.id,
    label: cfg.label,
    simulated: false,
    async *stream(messages: ApiMessage[], signal: AbortSignal, options?: StreamOptions) {
      let response: Response;
      try {
        response = await fetch(`${(cfg.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '')}/v1/messages`, {
          method: 'POST',
          signal,
          headers: {
            'content-type': 'application/json',
            'x-api-key': cfg.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: cfg.maxTokens ?? 4096,
            stream: true,
            ...(options?.system ? { system: options.system } : {}),
            messages,
          }),
        });
      } catch {
        if (signal.aborted) return;
        throw new ProviderError('unreachable');
      }
      if (!response.ok) throw new ProviderError(response.status >= 500 ? 'unreachable' : 'rejected');
      for await (const data of sseData(response, signal)) {
        let event: { type?: string; delta?: { type?: string; text?: string }; error?: unknown };
        try {
          event = JSON.parse(data) as typeof event;
        } catch {
          continue;
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          yield event.delta.text;
        } else if (event.type === 'error') {
          throw new ProviderError('unreachable');
        } else if (event.type === 'message_stop') {
          return;
        }
      }
    },
  };
}
