import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createProviders } from '../src/main/providers/registry.js';
import { createProvider } from '../src/main/providers/registry.js';
import { defaultConfig, parseConfig, configuredProviders } from '../src/main/config.js';
import { ProviderError } from '../src/main/providers/types.js';
import type { AssistantProvider } from '../src/main/providers/types.js';
import { secureStream, LeakBlockedError } from '../src/main/secure-send.js';
import { createState, addManualMention } from 'engine';

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function readBody(req: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += String(chunk);
  return body;
}

function start(handler: Parameters<typeof createServer>[1]): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`));
  });
}

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const c of it) out += c;
  return out;
}

describe('fournisseur anthropic (faux serveur local)', () => {
  it('envoie le modèle, la clé et la consigne, et lit le flux', async () => {
    let seen: { headers: IncomingMessage['headers']; body: Record<string, unknown> } | undefined;
    const base = await start(async (req, res) => {
      seen = { headers: req.headers, body: JSON.parse(await readBody(req)) as Record<string, unknown> };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const t of ['Bon', 'jour [PERS', 'ONNE_1]']) {
        res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } })}\n\n`);
      }
      res.end(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    });
    const p = createProvider({ id: 'c', label: 'C', type: 'anthropic', model: 'modele-de-test', apiKey: 'cle-de-test', baseUrl: base });
    const text = await collect(p.stream([{ role: 'user', content: '[PERSONNE_1] écrit' }], new AbortController().signal, { system: 'consigne' }));
    expect(text).toBe('Bonjour [PERSONNE_1]');
    expect(seen?.headers['x-api-key']).toBe('cle-de-test');
    expect(seen?.body.model).toBe('modele-de-test');
    expect(seen?.body.system).toBe('consigne');
    expect(seen?.body.stream).toBe(true);
    expect(seen?.body.messages).toEqual([{ role: 'user', content: '[PERSONNE_1] écrit' }]);
  });

  it('traduit un refus ou une panne en erreur sans détail', async () => {
    const base = await start((_req, res) => {
      res.writeHead(401).end('{"error":"détail sensible"}');
    });
    const p = createProvider({ id: 'c', label: 'C', type: 'anthropic', model: 'm', apiKey: 'k', baseUrl: base });
    await expect(collect(p.stream([{ role: 'user', content: 'x' }], new AbortController().signal))).rejects.toMatchObject({ message: 'rejected' });
    const down = createProvider({ id: 'c', label: 'C', type: 'anthropic', model: 'm', apiKey: 'k', baseUrl: 'http://127.0.0.1:1' });
    await expect(collect(down.stream([{ role: 'user', content: 'x' }], new AbortController().signal))).rejects.toBeInstanceOf(ProviderError);
  });

  it('s\'arrête quand on interrompt la génération', async () => {
    const base = await start((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const timer = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'a' } })}\n\n`), 5);
      res.on('close', () => clearInterval(timer));
    });
    const p = createProvider({ id: 'c', label: 'C', type: 'anthropic', model: 'm', apiKey: 'k', baseUrl: base });
    const controller = new AbortController();
    let n = 0;
    for await (const chunk of p.stream([{ role: 'user', content: 'x' }], controller.signal)) {
      if (chunk.length > 0 && ++n === 3) controller.abort();
    }
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThan(20);
  });
});

describe('fournisseur openai-compatible (faux serveur local)', () => {
  it('place la consigne en premier message et lit le flux', async () => {
    let body: { messages: { role: string; content: string }[]; model: string } | undefined;
    const base = await start(async (req, res) => {
      body = JSON.parse(await readBody(req)) as typeof body;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Salut ' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '[LIEU_1]' } }] })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
    const p = createProvider({ id: 'l', label: 'L', type: 'openai-compatible', model: 'modele-local', baseUrl: `${base}/v1` });
    expect(await collect(p.stream([{ role: 'user', content: 'bonjour' }], new AbortController().signal, { system: 'sys' }))).toBe('Salut [LIEU_1]');
    expect(body?.model).toBe('modele-local');
    expect(body?.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });
});

describe('configuration', () => {
  it('une configuration absente donne le faux assistant seul', () => {
    expect(configuredProviders(defaultConfig()).map((p) => p.id)).toEqual(['demo-fake']);
  });

  it('un fournisseur non configuré n\'apparaît pas', () => {
    const cfg = parseConfig({
      assistant: {
        default: 'claude',
        providers: [
          { id: 'claude', label: 'Claude', type: 'anthropic', model: 'À DÉCIDER', apiKey: '…' },
          { id: 'sans-cle', label: 'X', type: 'anthropic', model: 'un-modele', apiKey: '' },
          { id: 'local', label: 'L', type: 'openai-compatible', baseUrl: 'http://localhost:1/v1', model: 'À DÉCIDER' },
          { id: 'ok', label: 'OK', type: 'openai-compatible', baseUrl: 'http://localhost:1/v1', model: 'un-modele' },
        ],
      },
    });
    expect(configuredProviders(cfg).map((p) => p.id)).toEqual(['ok']);
    expect([...createProviders(cfg).keys()]).toEqual(['ok']);
  });

  it('ignore un fichier mal formé', () => {
    expect(parseConfig('n\'importe quoi').assistant.providers[0]?.id).toBe('demo-fake');
    expect(parseConfig({ limits: { maxFileBytes: -1 } }).limits.maxFileBytes).toBeGreaterThan(0);
  });
});

describe('envoi sécurisé', () => {
  it('n\'appelle jamais le fournisseur quand une valeur reste visible', () => {
    let called = false;
    const provider: AssistantProvider = {
      id: 'x', label: 'x', simulated: false,
      // eslint-disable-next-line require-yield
      async *stream() {
        called = true;
      },
    };
    const state = addManualMention(createState(), 'Jean Garnier', 'PERSONNE');
    const conv = (clear: string) => ({
      id: 'c', title: 't', state, settings: { assistantId: 'x', deepAnalysisOnMessages: true },
      messages: [{ role: 'user' as const, clear }],
    });
    expect(() => secureStream(provider, conv('Contact : fictif@exemple.org'), new AbortController().signal)).toThrow(LeakBlockedError);
    expect(called).toBe(false);
    void secureStream(provider, conv('Bonjour Jean Garnier'), new AbortController().signal);
  });

  it('transmet l\'historique masqué', async () => {
    let got: string[] = [];
    const provider: AssistantProvider = {
      id: 'x', label: 'x', simulated: false,
      async *stream(messages) {
        got = messages.map((m) => m.content);
        yield 'ok';
      },
    };
    const state = addManualMention(createState(), 'Jean Garnier', 'PERSONNE');
    const c = {
      id: 'c', title: 't', state, settings: { assistantId: 'x', deepAnalysisOnMessages: true },
      messages: [
        { role: 'user' as const, clear: 'Jean Garnier écrit' },
        { role: 'assistant' as const, clear: 'Garnier a bien écrit' },
        { role: 'user' as const, clear: 'Et M. Garnier ?' },
      ],
    };
    await collect(secureStream(provider, c, new AbortController().signal));
    expect(got).toEqual(['[PERSONNE_1] écrit', '[PERSONNE_1] a bien écrit', 'Et [PERSONNE_1] ?']);
  });
});
