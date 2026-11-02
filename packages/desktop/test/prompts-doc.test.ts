// Le document docs/PROMPTS.md et le code ne doivent pas diverger.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LLM_PROMPT_TEMPLATE } from 'engine';
import { SYSTEM_PROMPT } from '../src/main/prompts.js';
import { t } from '../src/renderer/messages.js';

const doc = readFileSync(resolve(import.meta.dirname, '../../../docs/PROMPTS.md'), 'utf8').replace(/\r\n/g, '\n');
const between = (a: string, b: string): string => doc.slice(doc.indexOf(a) + a.length, doc.indexOf(b));

describe('docs/PROMPTS.md', () => {
  it('reprend la consigne système à l’identique', () => {
    const block = between('<!-- SYSTEM_PROMPT:BEGIN -->', '<!-- SYSTEM_PROMPT:END -->');
    expect(block).toContain(SYSTEM_PROMPT);
  });

  it('ordonne de conserver les repères', () => {
    expect(SYSTEM_PROMPT).toMatch(/Conservez les repères tels quels/);
  });

  it('reprend les trois modèles de tâches', () => {
    const block = between('<!-- TASKS:BEGIN -->', '<!-- TASKS:END -->');
    for (const k of ['summary', 'timeline', 'contradictions'] as const) {
      expect(block).toContain(t.tasks[k].label);
      expect(block).toContain(t.tasks[k].prompt);
    }
  });

  it('la consigne du LLM local est celle de l’annexe C.2', () => {
    const annex = readFileSync(resolve(import.meta.dirname, '../../../docs/DOCUMENTATION.md'), 'utf8').replace(/\r\n/g, '\n');
    const first = LLM_PROMPT_TEMPLATE.split('\n')[0] as string;
    expect(annex).toContain(first);
    expect(annex).toContain('Réponds uniquement avec un objet JSON conforme au schéma.');
  });
});
