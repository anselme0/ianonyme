import { describe, expect, it } from 'vitest';
import { addManualMention, checkLeak, createState, mask, normalizeValue } from '../src/index.js';
import { stateWith } from './helpers.js';

describe('masquage', () => {
  const state = stateWith(['Jean Garnier']);

  it('est déterministe', () => {
    const t = 'M. Garnier et Jean Garnier. Garnier encore.';
    expect(mask(t, state).masked).toBe(mask(t, state).masked);
  });

  it('remplace de la forme la plus longue à la plus courte, en une passe', () => {
    const { masked } = mask('Jean Garnier, M. Garnier, Garnier', state);
    expect(masked).toBe('[PRENOM_1] [NOM_1], M. [NOM_1], [NOM_1]');
  });

  it('respecte les frontières de mot', () => {
    const { masked } = mask('Garnieri, Garnier, xGarnier, Garnier-Dupont', state);
    expect(masked).toBe('Garnieri, [NOM_1], xGarnier, [NOM_1]-Dupont');
  });

  it('ignore la casse, les accents, les espaces insécables et les apostrophes', () => {
    const s = stateWith(['Étienne D’Artois']);
    for (const t of [
      'ETIENNE D\'ARTOIS',
      'étienne d’artois',
      'Etienne D\'Artois',
      'Étienne  D’Artois',
      'Étienne D’Artois',
    ]) {
      expect(mask(t, s).masked, t).toBe('[PRENOM_1] [NOM_1]');
    }
  });

  it('traite les tirets comme des espaces', () => {
    const s = stateWith(['Jean-Pierre Martin']);
    expect(mask('Jean Pierre Martin et Jean‑Pierre Martin', s).masked).toBe('[PRENOM_1] [NOM_1] et [PRENOM_1] [NOM_1]');
  });

  it('masque une valeur coupée par des caractères invisibles ou accents combinants', () => {
    const s = stateWith(['Jean Garnier']);
    expect(mask('Gar­nier', s).masked).toBe('[NOM_1]');
    expect(mask('Jean Gar​nier', s).masked).toBe('[PRENOM_1] [NOM_1]');
    const accent = stateWith(['Éric Dupont']);
    expect(mask('Éric Dupont', accent).masked).toBe('[PRENOM_1] [NOM_1]');
  });

  it('ne retouche jamais un repère déjà inséré', () => {
    const s = stateWith(['Jean Garnier'], ['PERSONNE', 'ORGANISATION']);
    const t = 'Voir [PERSONNE_1] puis Garnier';
    expect(mask(t, s).masked).toBe('Voir [PERSONNE_1] puis [NOM_1]');
    const s2 = addManualMention(createState(), 'PERSONNE', 'ORGANISATION');
    expect(mask('[PERSONNE_1]', s2).masked).toBe('[PERSONNE_1]');
  });

  it('ne masque pas une entité non acceptée (suggestion en attente)', () => {
    expect(mask('Paul Dupont', state).masked).toBe('Paul Dupont');
  });

  it('un texte sans entité reste identique', () => {
    expect(mask('Bonjour', createState()).masked).toBe('Bonjour');
  });
});

describe('cohérence des repères', () => {
  it('garde le même repère pour une même entité', () => {
    let s = createState();
    s = addManualMention(s, 'Jean Garnier', 'PERSONNE');
    s = addManualMention(s, 'Garnier', 'PERSONNE');
    expect(Object.keys(s.entities)).toHaveLength(1);
    expect(mask('Garnier', s).masked).toBe('[NOM_1]');
  });

  it('ne réutilise jamais un numéro après suppression', async () => {
    const { rejectMention } = await import('../src/index.js');
    let s = addManualMention(createState(), 'Paul Dupont', 'PERSONNE');
    s = rejectMention(s, {
      id: 'm', text: 'Paul Dupont', span: { start: 0, end: 11 }, category: 'PERSONNE', source: 'manual', status: 'suggested',
    });
    s = addManualMention(s, 'Marie Durand', 'PERSONNE');
    const only = Object.values(s.entities);
    expect(only.map((e) => e.placeholder)).toEqual(['[PRENOM_2] [NOM_2]']);
  });

  it('numérote par catégorie', () => {
    let s = createState();
    s = addManualMention(s, 'Jean Garnier', 'PERSONNE');
    s = addManualMention(s, 'ACME SARL', 'ORGANISATION');
    s = addManualMention(s, 'Marie Durand', 'PERSONNE');
    expect(Object.values(s.entities).map((e) => e.placeholder)).toEqual([
      '[PRENOM_1] [NOM_1]',
      '[ORGANISATION_1]',
      '[PRENOM_2] [NOM_2]',
    ]);
  });
});

describe('contrôle anti-fuite', () => {
  const state = stateWith(['Jean Garnier']);

  it('accepte un texte entièrement masqué', () => {
    expect(checkLeak('[PERSONNE_1] a signé', state).ok).toBe(true);
  });

  it('détecte une valeur validée restée dans le texte', () => {
    const r = checkLeak('Garnier a signé', state);
    expect(r.ok).toBe(false);
    expect(r.leaks[0]?.kind).toBe('exact');
  });

  it('détecte un motif structuré non protégé', () => {
    const r = checkLeak('Écrire à paul.fictif@exemple.org', createState());
    expect(r.ok).toBe(false);
    expect(r.leaks[0]?.kind).toBe('regex');
  });

  it('ignore une valeur explicitement rejetée', () => {
    const s = { ...createState(), rejectedValues: [normalizeValue('paul.fictif@exemple.org')] };
    expect(checkLeak('paul.fictif@exemple.org', s).ok).toBe(true);
  });

  it('ne prend pas un repère pour un motif', () => {
    expect(checkLeak('[TELEPHONE_12] et [IBAN_3] et [NUM_DOSSIER_2]', createState()).ok).toBe(true);
  });
});
