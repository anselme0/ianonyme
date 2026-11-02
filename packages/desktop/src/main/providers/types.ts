// Fournisseurs d'assistant (docs/DOCUMENTATION.md, annexe A.7).
// Un fournisseur ne reçoit que la charge utile produite par `buildApiPayload`,
// après la vérification de sécurité finale (voir secure-send.ts).

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  /** Consigne système de l'application : contrôlée par nous, pas de données de l'utilisateur. */
  system?: string;
}

export interface AssistantProvider {
  id: string;
  label: string;
  simulated: boolean;
  stream(messages: ApiMessage[], signal: AbortSignal, options?: StreamOptions): AsyncIterable<string>;
}

export class ProviderError extends Error {
  constructor(public readonly code: 'unreachable' | 'rejected') {
    super(code);
    this.name = 'ProviderError';
  }
}

/** Lit un flux d'évènements « server-sent events » et renvoie le champ `data` de chaque évènement. */
export async function* sseData(response: Response, signal: AbortSignal): AsyncIterable<string> {
  if (!response.body) throw new ProviderError('unreachable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, '');
        const data = block
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (data.length > 0) yield data;
      }
    }
    buffer += decoder.decode();
    const tail = buffer
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (tail.length > 0) yield tail;
  } finally {
    reader.releaseLock();
  }
}
