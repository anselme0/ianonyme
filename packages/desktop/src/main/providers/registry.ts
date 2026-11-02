import type { AppConfig, ProviderConfig } from '../config.js';
import { configuredProviders } from '../config.js';
import { createAnthropicProvider } from './anthropic.js';
import { createFakeProvider } from './fake.js';
import type { FakeOptions } from './fake.js';
import { createOpenAiProvider } from './openai.js';
import type { AssistantProvider } from './types.js';

export type AnthropicConfigLike = Extract<ProviderConfig, { type: 'anthropic' }>;
export type OpenAiConfigLike = Extract<ProviderConfig, { type: 'openai-compatible' }>;

export function createProvider(cfg: ProviderConfig, fake: FakeOptions = {}): AssistantProvider {
  switch (cfg.type) {
    case 'anthropic':
      return createAnthropicProvider(cfg);
    case 'openai-compatible':
      return createOpenAiProvider(cfg);
    default:
      return createFakeProvider(cfg, fake);
  }
}

/** Fournisseurs configurés, par identifiant. Un fournisseur non configuré n'existe pas. */
export function createProviders(cfg: AppConfig, fake: FakeOptions = {}): Map<string, AssistantProvider> {
  return new Map(configuredProviders(cfg).map((p) => [p.id, createProvider(p, fake)]));
}
