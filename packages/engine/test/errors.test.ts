import { describe, expect, it } from 'vitest';
import { acceptMention, addManualMention, createState, EngineError, linkMention } from '../src/index.js';

const SECRET = 'Valeur-Secrète-Fictive';

describe('erreurs sans valeur', () => {
  it('rattacher à une entité inconnue ne cite pas la valeur', () => {
    let message = '';
    try {
      addManualMention(createState(), SECRET, 'PERSONNE', 'E999');
    } catch (e) {
      message = String((e as Error).message) + String((e as Error).stack ?? '').split('\n')[0];
      expect(e).toBeInstanceOf(EngineError);
    }
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(SECRET);
  });

  it('une valeur vide est refusée par un code fixe', () => {
    expect(() => addManualMention(createState(), '   ', 'LIEU')).toThrowError('empty_value');
  });

  it('linkMention vers une entité absente ne cite pas la valeur', () => {
    const mention = {
      id: 'm', text: SECRET, span: { start: 0, end: 5 }, category: 'PERSONNE' as const, source: 'manual' as const, status: 'suggested' as const,
    };
    for (const fn of [() => linkMention(createState(), mention, 'E1'), () => acceptMention(createState(), mention, 'E1')]) {
      try {
        fn();
        throw new Error('attendu');
      } catch (e) {
        expect(String((e as Error).message)).not.toContain(SECRET);
      }
    }
  });
});
