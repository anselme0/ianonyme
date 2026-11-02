// Intégration : un document du corpus d'ajustement passe de bout en bout
// (détection, masquage, vérification) sans appel réseau.
// Seuls les documents `ajust-*` sont lus ici : les `eval-*` ne servent qu'à la mesure.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLeak, createState, findOccurrences, ingestText, mask, normalizeText } from '../src/index.js';

const DIR = resolve(import.meta.dirname, '../../../corpus');

interface Annotation {
  entities: { category: string; mentions: { text: string; kind: 'direct' | 'indirect' }[] }[];
}

describe.each(['ajust-01', 'ajust-02', 'ajust-03'])('corpus %s', (name) => {
  const text = readFileSync(resolve(DIR, `${name}.txt`), 'utf8');
  const ann = JSON.parse(readFileSync(resolve(DIR, `${name}.annotations.json`), 'utf8')) as Annotation;

  it('chaque mention annotée figure telle quelle dans le texte', () => {
    for (const e of ann.entities) for (const m of e.mentions) expect(text).toContain(m.text);
  });

  it('aucune valeur directe de référence ne reste dans le texte masqué, hors conflits à trancher', () => {
    const { state, conflicts } = ingestText(createState(), text);
    const masked = mask(text, state).masked;
    const nt = normalizeText(masked);
    const left: string[] = [];
    for (const e of ann.entities) {
      // LIEU, FONCTION et LIEN_PARENTE n'ont pas de règle déterministe (annexe B.1).
      if (['LIEU', 'FONCTION', 'LIEN_PARENTE'].includes(e.category)) continue;
      for (const m of e.mentions) {
        if (m.kind !== 'direct') continue;
        if (findOccurrences(nt, m.text).length > 0) left.push(m.text);
      }
    }
    // Seules les valeurs ambiguës (deux personnes de même nom) peuvent subsister : la vérification les bloque.
    const report = checkLeak(masked, state);
    if (left.length > 0) {
      expect(conflicts.length).toBeGreaterThan(0);
      expect(report.ok).toBe(false);
    }
  });

  it('le texte masqué est stable (déterminisme)', () => {
    const a = ingestText(createState(), text);
    const b = ingestText(createState(), text);
    expect(mask(text, a.state).masked).toBe(mask(text, b.state).masked);
  });
});
