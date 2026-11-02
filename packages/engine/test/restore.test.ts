import { describe, expect, it } from 'vitest';
import { createStreamRestorer, restore } from '../src/index.js';
import type { Segment } from '../src/index.js';
import { stateWith } from './helpers.js';

const state = stateWith(['Jean Garnier'], ['ACME SARL', 'ORGANISATION']);

function merge(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.restoredFrom === s.restoredFrom && s.restoredFrom === undefined) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function stream(text: string, cuts: number[]) {
  const r = createStreamRestorer(state);
  const segs: Segment[] = [];
  let prev = 0;
  for (const c of [...cuts, text.length]) {
    segs.push(...r.push(text.slice(prev, c)));
    prev = c;
  }
  segs.push(...r.flush());
  return { segments: merge(segs), anomalies: r.anomalies };
}

describe('restitution', () => {
  it('rétablit les valeurs', () => {
    const r = restore('Voir [PERSONNE_1] chez [ORGANISATION_1].', state);
    expect(r.restored).toBe('Voir Jean Garnier chez ACME SARL.');
    expect(r.segments.filter((s) => s.restoredFrom)).toHaveLength(2);
    expect(r.anomalies).toEqual([]);
  });

  it('signale un repère inconnu', () => {
    const r = restore('Voir [PERSONNE_9]', state);
    expect(r.restored).toBe('Voir [PERSONNE_9]');
    expect(r.anomalies.map((a) => a.kind)).toEqual(['unknown_placeholder']);
  });

  it.each(['[personne_1]', '[PERSONNE 1]', '[PERSONNE]', '[ PERSONNE_1 ]', '[Personne-1]'])(
    'signale un repère mal formé %s',
    (bad) => {
      const r = restore(`Voir ${bad}`, state);
      expect(r.anomalies.map((a) => a.kind)).toEqual(['malformed_placeholder']);
      expect(r.restored).toBe(`Voir ${bad}`);
    },
  );

  it('laisse les crochets ordinaires', () => {
    const r = restore('Voir [1] et [note] et [lien](http://x)', state);
    expect(r.restored).toBe('Voir [1] et [note] et [lien](http://x)');
    expect(r.anomalies).toEqual([]);
  });

  it('indique la position des anomalies', () => {
    const r = restore('ab [PERSONNE_9]', state);
    expect(r.anomalies[0]?.position).toBe(3);
  });
});

describe('restitution en flux', () => {
  const texts = [
    'Bonjour [PERSONNE_1], voici [ORGANISATION_1] et [PERSONNE_9] puis [personne_1].',
    '[PERSONNE_1][PERSONNE_1] [ [PERSONNE_1]',
    'Texte [lien](http://x) [1] [note] fin [PERSONNE_1]',
    '[ORGANISATION_1]',
  ];

  it.each(texts)('même résultat quelle que soit la coupure (une coupure) : %s', (text) => {
    const expected = merge(restore(text, state).segments);
    const anomalies = restore(text, state).anomalies;
    for (let i = 0; i <= text.length; i++) {
      const got = stream(text, [i]);
      expect(got.segments, `coupure ${i}`).toEqual(expected);
      expect(got.anomalies, `coupure ${i}`).toEqual(anomalies);
    }
  });

  it.each(texts)('même résultat avec deux coupures : %s', (text) => {
    const expected = merge(restore(text, state).segments);
    for (let i = 0; i <= text.length; i++) {
      for (let j = i; j <= text.length; j++) {
        expect(stream(text, [i, j]).segments, `coupures ${i},${j}`).toEqual(expected);
      }
    }
  });

  it('même résultat caractère par caractère', () => {
    for (const text of texts) {
      const cuts = [...text].map((_, i) => i);
      expect(stream(text, cuts).segments).toEqual(merge(restore(text, state).segments));
    }
  });

  it('ne laisse jamais un repère incomplet à l\'écran', () => {
    const r = createStreamRestorer(state);
    const first = r.push('Bonjour [PERS');
    expect(first.map((s) => s.text).join('')).toBe('Bonjour ');
    const second = r.push('ONNE_1] !');
    expect(second.map((s) => s.text).join('')).toBe('Jean Garnier !');
  });

  it('retire le repère incomplet à l\'arrêt de la génération', () => {
    const r = createStreamRestorer(state);
    const a = r.push('Bonjour [PERSONNE_');
    const b = r.flush();
    expect([...a, ...b].map((s) => s.text).join('')).toBe('Bonjour ');
    expect(r.anomalies.map((x) => x.kind)).toEqual(['malformed_placeholder']);
  });

  it('libère un crochet ordinaire à la fin du flux', () => {
    const r = createStreamRestorer(state);
    const a = r.push('Voir [exemple');
    const b = r.flush();
    expect([...a, ...b].map((s) => s.text).join('')).toBe('Voir [exemple');
  });
});
