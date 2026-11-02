// LLM local derrière `proposeMentions` (docs/DOCUMENTATION.md, annexe C).
// Le moteur d'inférence et le modèle se choisissent par configuration : rien n'est écrit en dur ici.
// Trois moteurs : `none` (absent, mode dégradé), `fake` (scripté, pour les tests et la démonstration
// de l'interface, jamais présenté comme une vraie analyse) et `node-llama-cpp`.

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { buildLlmPrompt } from 'engine';
import type { ConversationState } from 'engine';
import type { AppConfig, LocalModelEntry } from './config.js';
import { activeLocalModel } from './config.js';
import { log, logError } from './log.js';
import type { LocalAnalysisStatus } from '../shared/api.js';

export interface LocalLlm {
  status(): LocalAnalysisStatus;
  simulated: boolean;
  /** Sortie brute du modèle pour un morceau de texte (JSON attendu). */
  propose(chunk: string, state: ConversationState, signal: AbortSignal): Promise<string>;
  /** Démarre le chargement du modèle sans bloquer. */
  warmUp(): void;
}

class AbsentLlm implements LocalLlm {
  simulated = false;
  status(): LocalAnalysisStatus {
    return 'absent';
  }
  propose(): Promise<string> {
    return Promise.reject(new Error('absent'));
  }
  warmUp(): void {}
}

const FAMILY_WORDS =
  'beau-frère|belle-sœur|beau-père|belle-mère|frère|sœur|époux|épouse|mari|femme|fils|fille|neveu|nièce|cousin|cousine|voisin|voisine|oncle|tante';
const FUNCTION_WORDS = 'maire|gérant|gérante|directeur|directrice|syndic|locataire|propriétaire|président|présidente';

/** Faux LLM scripté : repère quelques formulations types, sans rien comprendre. Pour les tests seulement. */
export class FakeLlm implements LocalLlm {
  simulated = true;
  status(): LocalAnalysisStatus {
    return 'ready';
  }
  warmUp(): void {}
  propose(chunk: string, state: ConversationState): Promise<string> {
    const mentions: { text: string; category: string; linkedTo: string | null }[] = [];
    const push = (text: string, category: string, linkedTo: string | null): void => {
      if (!mentions.some((m) => m.text === text)) mentions.push({ text, category, linkedTo });
    };
    const kin = new RegExp(`\\b(?:[Ss]on|[Ss]a|[Ss]es|[Ll]a|[Ll]e|[Ll]es)\\s+(?:${FAMILY_WORDS})\\b(?:\\s+d[eu']\\s?[\\p{L}' -]{1,30}?(?=[,.;:)]|\\s+(?:a|est|qui|avait|était)\\b))?`, 'gu');
    for (const m of chunk.matchAll(kin)) push(m[0], 'LIEN_PARENTE', null);
    const fn = new RegExp(`\\b[Ll]e\\s+(?:${FUNCTION_WORDS})(?:\\s+d(?:e la|e l'|u|es|')\\s?[\\p{L}' -]{1,30}?)?(?=[,.;:)]|\\s+(?:a|est|qui|de|n')\\b)`, 'gu');
    for (const m of chunk.matchAll(fn)) {
      const word = (FUNCTION_WORDS.split('|').find((w) => m[0].includes(w)) ?? '').trim();
      // Rattachement : une entité connue citée juste avant la même fonction.
      let linked: string | null = null;
      for (const e of Object.values(state.entities)) {
        if (e.category !== 'PERSONNE') continue;
        const re = new RegExp(`${e.canonical.split(' ').pop() ?? ''}[^.]{0,40}${word}`, 'iu');
        if (word && re.test(chunk)) linked = e.canonical;
      }
      push(m[0], 'FONCTION', linked);
    }
    return Promise.resolve(JSON.stringify({ mentions }));
  }
}

const SCHEMA = {
  type: 'object',
  properties: {
    mentions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          category: { enum: ['PERSONNE', 'ORGANISATION', 'LIEU', 'ADRESSE', 'FONCTION', 'LIEN_PARENTE', 'IDENTIFIANT'] },
          linkedTo: { type: ['string', 'null'] },
        },
        required: ['text', 'category', 'linkedTo'],
      },
    },
  },
  required: ['mentions'],
} as const;

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/** Téléchargement avec vérification d'empreinte. Écrit mais non vérifié contre un vrai modèle. */
export async function downloadModel(entry: LocalModelEntry, dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, entry.file);
  if (existsSync(target) && (await sha256(target)) === entry.sha256) return target;
  const response = await fetch(entry.downloadUrl);
  if (!response.ok || !response.body) throw new Error('download_failed');
  const part = `${target}.part`;
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(part));
  if ((await sha256(part)) !== entry.sha256) throw new Error('hash_mismatch');
  const { renameSync } = await import('node:fs');
  renameSync(part, target);
  return target;
}

export class NodeLlamaLlm implements LocalLlm {
  simulated = false;
  private state: LocalAnalysisStatus = 'absent';
  private loading: Promise<void> | null = null;
  private runtime: { prompt(p: string, signal: AbortSignal): Promise<string> } | null = null;

  constructor(
    private readonly entry: LocalModelEntry | undefined,
    private readonly modelsDir: string,
  ) {
    if (entry) this.state = 'loading';
  }

  status(): LocalAnalysisStatus {
    return this.state;
  }

  warmUp(): void {
    if (!this.entry || this.loading) return;
    this.loading = this.load().catch((e: unknown) => {
      this.state = 'error';
      logError('localllm', 'load_failed', e);
    });
  }

  private async load(): Promise<void> {
    const entry = this.entry as LocalModelEntry;
    const started = Date.now();
    const path = await downloadModel(entry, this.modelsDir);
    const lib = await import('node-llama-cpp');
    const llama = await lib.getLlama();
    const model = await llama.loadModel({ modelPath: path });
    const context = await model.createContext(entry.contextSize > 0 ? { contextSize: entry.contextSize } : {});
    const grammar = await llama.createGrammarForJsonSchema(SCHEMA as never);
    this.runtime = {
      prompt: async (text, signal) => {
        const session = new lib.LlamaChatSession({ contextSequence: context.getSequence() });
        try {
          return await session.prompt(text, { grammar, temperature: 0, signal });
        } finally {
          session.dispose();
        }
      },
    };
    this.state = 'ready';
    log('localllm', 'loaded', { ms: Date.now() - started });
  }

  async propose(chunk: string, state: ConversationState, signal: AbortSignal): Promise<string> {
    if (this.state !== 'ready' || !this.runtime) throw new Error(this.state);
    return this.runtime.prompt(buildLlmPrompt(chunk, state), signal);
  }
}

export function createLocalLlm(cfg: AppConfig, modelsDir: string): LocalLlm {
  switch (cfg.localModel.engine) {
    case 'fake':
      return new FakeLlm();
    case 'node-llama-cpp': {
      const entry = activeLocalModel(cfg);
      return entry ? new NodeLlamaLlm(entry, modelsDir) : new AbsentLlm();
    }
    default:
      return new AbsentLlm();
  }
}
