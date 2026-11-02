// Lecture de la configuration locale (docs/DOCUMENTATION.md, annexe A.7).
// Aucun nom de modèle n'est écrit dans le code : tout vient de ce fichier.

import { existsSync, readFileSync } from 'node:fs';

export type ProviderConfig =
  | { id: string; label: string; type: 'anthropic'; model: string; apiKey: string; baseUrl?: string; maxTokens?: number }
  | { id: string; label: string; type: 'openai-compatible'; model: string; baseUrl: string; apiKey?: string; maxTokens?: number }
  | { id: string; label: string; type: 'fake' };

export interface LocalModelEntry {
  id: string;
  file: string;
  downloadUrl: string;
  sha256: string;
  contextSize: number;
  chunkChars: number;
  timeoutMs: number;
}

export interface AppConfig {
  assistant: { default: string; providers: ProviderConfig[] };
  localModel: { engine: 'node-llama-cpp' | 'fake' | 'none'; active: string; registry: LocalModelEntry[] };
  limits: { maxFileBytes: number; maxMentionsPerChunk: number };
  user: { name: string; firm: string; email: string };
}

export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_CHUNK_CHARS = 2000;
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;

const PLACEHOLDER_RE = /^(À DÉCIDER|À RENSEIGNER|…)/u;

export function defaultConfig(): AppConfig {
  return {
    assistant: {
      default: 'demo-fake',
      providers: [{ id: 'demo-fake', label: 'Assistant de démonstration (hors ligne)', type: 'fake' }],
    },
    localModel: { engine: 'none', active: '', registry: [] },
    limits: { maxFileBytes: DEFAULT_MAX_FILE_BYTES, maxMentionsPerChunk: 20 },
    user: { name: 'Anselme', firm: 'Cabinet Exemple', email: 'anselme@exemple.org' },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Fusionne un fichier de configuration (éventuellement partiel) avec les valeurs par défaut. */
export function parseConfig(raw: unknown): AppConfig {
  const base = defaultConfig();
  if (!isRecord(raw)) return base;
  const out: AppConfig = { ...base };
  if (isRecord(raw.assistant) && Array.isArray(raw.assistant.providers)) {
    const providers = raw.assistant.providers.filter(
      (p): p is ProviderConfig =>
        isRecord(p) && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.type === 'string',
    );
    out.assistant = {
      default: typeof raw.assistant.default === 'string' ? raw.assistant.default : (providers[0]?.id ?? base.assistant.default),
      providers: providers.length > 0 ? providers : base.assistant.providers,
    };
  }
  if (isRecord(raw.localModel)) {
    const lm = raw.localModel;
    const engine = lm.engine === 'node-llama-cpp' || lm.engine === 'fake' || lm.engine === 'none' ? lm.engine : 'none';
    out.localModel = {
      engine,
      active: typeof lm.active === 'string' ? lm.active : '',
      registry: Array.isArray(lm.registry) ? (lm.registry.filter(isRecord) as unknown as LocalModelEntry[]) : [],
    };
  }
  if (isRecord(raw.limits)) {
    const maxFileBytes = Number(raw.limits.maxFileBytes);
    const maxMentionsPerChunk = Number(raw.limits.maxMentionsPerChunk);
    out.limits = {
      maxFileBytes: maxFileBytes > 0 ? maxFileBytes : DEFAULT_MAX_FILE_BYTES,
      maxMentionsPerChunk: maxMentionsPerChunk > 0 ? maxMentionsPerChunk : 20,
    };
  }
  if (isRecord(raw.user)) {
    const u = raw.user;
    out.user = {
      name: typeof u.name === 'string' ? u.name : base.user.name,
      firm: typeof u.firm === 'string' ? u.firm : base.user.firm,
      email: typeof u.email === 'string' ? u.email : base.user.email,
    };
  }
  return out;
}

export function loadConfig(path: string | undefined): AppConfig {
  if (!path || !existsSync(path)) return defaultConfig();
  try {
    return parseConfig(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    // Fichier illisible : configuration par défaut (le contenu n'est jamais cité).
    return defaultConfig();
  }
}

/** Un fournisseur non configuré n'apparaît pas dans la liste de l'interface. */
export function isConfigured(p: ProviderConfig): boolean {
  if (p.type === 'fake') return true;
  if (PLACEHOLDER_RE.test(p.model ?? '') || !p.model) return false;
  if (p.type === 'anthropic') return typeof p.apiKey === 'string' && p.apiKey.length > 0 && !PLACEHOLDER_RE.test(p.apiKey);
  return typeof p.baseUrl === 'string' && p.baseUrl.length > 0;
}

export function configuredProviders(cfg: AppConfig): ProviderConfig[] {
  return cfg.assistant.providers.filter(isConfigured);
}

export function activeLocalModel(cfg: AppConfig): LocalModelEntry | undefined {
  return cfg.localModel.registry.find((m) => m.id === cfg.localModel.active);
}
