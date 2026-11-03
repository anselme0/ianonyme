import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createState } from 'engine';
import { parseConfig } from '../src/main/config.js';
import { createLocalLlm } from '../src/main/localllm.js';

let server: Server | undefined;
afterEach(() => server?.close());

async function start(handler: (url: string, body: string) => [number, unknown]): Promise<string> {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      const [status, json] = handler(req.url ?? '', body);
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
    });
  });
  await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r));
  const addr = server.address();
  return `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/v1`;
}

function config(baseUrl: string) {
  return parseConfig({
    localModel: {
      engine: 'openai-compatible',
      active: 's',
      registry: [{ id: 's', file: '', downloadUrl: '', sha256: '', contextSize: 0, chunkChars: 2000, timeoutMs: 5000, baseUrl, model: 'm' }],
    },
  });
}

describe('moteur local openai-compatible', () => {
  it('passe à prêt puis renvoie la sortie du modèle', async () => {
    const calls: string[] = [];
    const base = await start((url) => {
      calls.push(url);
      return url.endsWith('/models') ? [200, { data: [] }] : [200, { choices: [{ message: { content: '{"mentions":[]}' } }] }];
    });
    const llm = createLocalLlm(config(base), '');
    llm.warmUp();
    await new Promise((r) => setTimeout(r, 100));
    expect(llm.status()).toBe('ready');
    expect(await llm.propose('texte', createState(), new AbortController().signal)).toBe('{"mentions":[]}');
  });

  it('retente sans sortie structurée sur un 400', async () => {
    let n = 0;
    const base = await start(() => (++n === 1 ? [400, {}] : [200, { choices: [{ message: { content: '{"mentions":[]}' } }] }]));
    const llm = createLocalLlm(config(base), '');
    expect(await llm.propose('texte', createState(), new AbortController().signal)).toBe('{"mentions":[]}');
    expect(n).toBe(2);
  });

  it('serveur injoignable : état erreur', async () => {
    const llm = createLocalLlm(config('http://127.0.0.1:1/v1'), '');
    llm.warmUp();
    await new Promise((r) => setTimeout(r, 300));
    expect(llm.status()).toBe('error');
  });
});
