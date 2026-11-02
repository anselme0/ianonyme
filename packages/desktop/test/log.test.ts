import { afterEach, describe, expect, it } from 'vitest';
import { log, logError, setLogSink } from '../src/main/log.js';

const lines: string[] = [];
setLogSink((l) => lines.push(l));
afterEach(() => (lines.length = 0));

describe('journal', () => {
  it('n\'accepte que des codes et des nombres', () => {
    log('module', 'evenement', { count: 3, ok: true });
    expect(lines[0]).toMatch(/module evenement count=3 ok=true$/);
  });

  it('écarte tout nom ou code libre, donc tout texte', () => {
    log('module', 'Jean Garnier a signé');
    log('Jean Garnier', 'code');
    log('module', 'code', { 'Jean Garnier': 1 } as never);
    log('module', 'code', { value: 'Jean Garnier' } as never);
    expect(lines.join('\n')).not.toContain('Garnier');
    expect(lines).toHaveLength(2);
  });

  it('ne journalise pas le message d\'une exception', () => {
    logError('module', 'echec', new Error('contient Jean Garnier et fictif@exemple.org'));
    expect(lines.join('\n')).not.toMatch(/Garnier|fictif|exemple/);
  });
});
