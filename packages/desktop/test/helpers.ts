import { ChatService } from '../src/main/service.js';
import type { ServiceEvents } from '../src/main/service.js';
import { defaultConfig } from '../src/main/config.js';
import type { AppConfig } from '../src/main/config.js';
import { FakeLlm } from '../src/main/localllm.js';
import type { LocalLlm } from '../src/main/localllm.js';
import { createFakeProvider } from '../src/main/providers/fake.js';
import type { ApiMessage, AssistantProvider } from '../src/main/providers/types.js';
import type { ChatDoneEvent, ChatErrorEvent } from '../src/shared/api.js';

export interface Spy {
  provider: AssistantProvider;
  calls: { messages: ApiMessage[]; system?: string }[];
}

/** Fournisseur qui enregistre ce qu'il reçoit puis répond comme le faux fournisseur. */
export function spyProvider(chunkSize = 5): Spy {
  const inner = createFakeProvider({ id: 'demo-fake', label: 'Assistant de démonstration (hors ligne)' }, { chunkSize, delayMs: 0 });
  const calls: Spy['calls'] = [];
  return {
    calls,
    provider: {
      ...inner,
      stream(messages, signal, options) {
        calls.push({ messages: messages.map((m) => ({ ...m })), system: options?.system });
        return inner.stream(messages, signal, options);
      },
    },
  };
}

export class Harness {
  service: ChatService;
  done: ChatDoneEvent[] = [];
  errors: ChatErrorEvent[] = [];
  waiters: (() => void)[] = [];

  constructor(public spy: Spy = spyProvider(), llm: LocalLlm = new FakeLlm(), config: AppConfig = defaultConfig()) {
    const events: ServiceEvents = {
      chunk: () => {},
      done: (e) => {
        this.done.push(e);
        this.waiters.splice(0).forEach((w) => w());
      },
      error: (e) => {
        this.errors.push(e);
        this.waiters.splice(0).forEach((w) => w());
      },
    };
    this.service = new ChatService({ config, providers: new Map([['demo-fake', spy.provider]]), llm, events });
  }

  /** Envoie et attend la fin (réponse ou erreur). */
  async send(convId: string, userText: string, fileIds: string[] = []): Promise<void> {
    const before = this.done.length + this.errors.length;
    const wait = new Promise<void>((r) => this.waiters.push(r));
    this.service.send({ convId, userText, fileIds });
    if (this.done.length + this.errors.length === before) await wait;
  }
}
