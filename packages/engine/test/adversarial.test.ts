// Audit adverse de la protection : on essaie de faire fuir une valeur (docs/NIGHT_RUN.md, passe finale).
// Valeurs fictives. Chaque fuite trouvée pendant l'audit est devenue un cas de ce fichier.

import { describe, expect, it } from 'vitest';
import { addManualMention, buildApiPayload, checkLeak, createState, ingestText, mask } from '../src/index.js';
import { conv, stateWith } from './helpers.js';

const person = stateWith(['Jean Garnier']);

function protectedText(text: string, state = person): string {
  const { masked } = mask(text, state);
  expect(checkLeak(masked, state).ok, `fuite dans : ${JSON.stringify(masked)}`).toBe(true);
  return masked;
}

describe('variantes typographiques d’un nom protégé', () => {
  it.each([
    ['casse', 'JEAN GARNIER et jean garnier et jEaN gArNiEr'],
    ['accents ajoutés', 'Jéan Garnièr'],
    ['espaces multiples et tabulation', 'Jean \t  Garnier'],
    ['saut de ligne entre les mots', 'Jean\nGarnier'],
    ['espace insécable', 'Jean Garnier'],
    ['espace fine insécable', 'Jean Garnier'],
    ['espace fine', 'Jean Garnier'],
    ['trait d’union conditionnel', 'Jean Gar­nier'],
    ['espace de largeur nulle', 'Jean Gar​nier'],
    ['liant de largeur nulle', 'Jean Gar‍nier'],
    ['marque de sens d’écriture', 'Jean‎ Garnier‏'],
    ['isolat directionnel', 'Jean ⁦Garnier⁩'],
    ['lettres pleine chasse', 'Ｊｅａｎ Ｇａｒｎｉｅｒ'],
    ['forme décomposée (accent combinant)', 'Jean Garniér'],
    ['lettre cyrillique identique (a)', 'Jean Gаrnier'],
    ['lettre cyrillique identique (e)', 'Jеan Garniеr'],
    ['lettre grecque identique (o)', 'Grοupe Jean Garnier'],
    ['souligné entre les mots', 'Jean_Garnier'],
    ['trait d’union entre les mots', 'Jean-Garnier'],
    ['tiret long entre les mots', 'Jean—Garnier'],
  ])('%s', (_label, text) => {
    expect(protectedText(text)).not.toMatch(/gar.?n.?i.?[eе].?r/i);
  });

  it('forme avec civilité, initiale, inversion et virgule', () => {
    const text = 'M. Garnier, Mme GARNIER, J. Garnier, Garnier Jean, Garnier, Jean, Dr Garnier';
    expect(protectedText(text)).toBe('M. [NOM_1], Mme [NOM_1], [PRENOM_1] [NOM_1], [PRENOM_1] [NOM_1], [PRENOM_1] [NOM_1], Dr [NOM_1]');
  });

  it('nom entre guillemets, parenthèses, ponctuation et Markdown', () => {
    const text = '« Jean Garnier », (Garnier), **Garnier**, _Garnier_, "Garnier", Garnier: Garnier; Garnier!';
    expect(protectedText(text)).not.toMatch(/Garnier/i);
  });

  it('nom accolé à une apostrophe ou à un tiret', () => {
    expect(protectedText("l'avis de d'Garnier et chez-Garnier")).not.toMatch(/Garnier/i);
  });
});

describe('numéros et coordonnées', () => {
  it.each([
    '01 99 00 67 45',
    '01.99.00.67.45',
    '01-99-00-67-45',
    '0199006745',
    '+33 1 99 00 67 45',
    '+33199006745',
    '+33 (0)1 99 00 67 45',
    '0033 1 99 00 67 45',
    '01 99 00 67 45',
    '01 99 00 67 45',
    '01 99 00 67 45',
  ])('téléphone %s', (num) => {
    const { state, masked } = (() => {
      const r = ingestText(createState(), `Appelez le ${num} demain`);
      return { state: r.state, masked: mask(`Appelez le ${num} demain`, r.state).masked };
    })();
    expect(masked).toBe('Appelez le [TELEPHONE_1] demain');
    expect(checkLeak(masked, state).ok).toBe(true);
  });

  it.each(['FR76 3000 6000 0112 3456 7890 189', 'fr76 3000 6000 0112 3456 7890 189', 'FR7630006000011234567890189', 'FR76 3000 6000 0112 3456 7890 189'])(
    'IBAN %s',
    (iban) => {
      const text = `Compte : ${iban}.`;
      const r = ingestText(createState(), text);
      expect(mask(text, r.state).masked).toBe('Compte : [IBAN_1].');
    },
  );

  it('e-mail en majuscules, avec étiquette et dans une URL', () => {
    const state = addManualMention(createState(), 'Jean.Fictif@Exemple.ORG', 'EMAIL');
    expect(protectedText('JEAN.FICTIF@EXEMPLE.ORG et mailto:jean.fictif@exemple.org', state)).not.toMatch(/fictif/i);
  });

  it('une valeur sensible reste signalée même si le masquage a été sauté', () => {
    const text = 'Contact : paul.fictif@exemple.org, 01 99 00 11 22, FR76 3000 6000 0112 3456 7890 189, RG 25/01234';
    const leaks = checkLeak(text, createState());
    expect(leaks.ok).toBe(false);
    expect(leaks.leaks.map((l) => l.kind)).toEqual(['regex', 'regex', 'regex', 'regex']);
  });
});

describe('historique et état', () => {
  it('une valeur ajoutée en cours de conversation est re-masquée partout, assistant compris', () => {
    const turns = ['Bonjour', 'Réponse sur Zoé Quenelle.', 'Merci', 'Quenelle confirme.'];
    const state = addManualMention(createState(), 'Zoé Quenelle', 'PERSONNE');
    const payload = buildApiPayload(conv(state, ...turns));
    expect(JSON.stringify(payload.messages)).not.toMatch(/quenelle/i);
    expect(payload.leak.ok).toBe(true);
  });

  it('une valeur rejetée ne sort jamais du masquage des autres valeurs', () => {
    const text = 'Jean Garnier a écrit à Paul Fictif.';
    const r = ingestText(createState(), text);
    expect(mask(text, r.state).masked).toBe('[PRENOM_1] [NOM_1] a écrit à [PRENOM_2] [NOM_2].');
  });

  it('un repère saisi par l’utilisateur n’est jamais confondu avec un repère généré', () => {
    const state = addManualMention(createState(), 'Jean Garnier', 'PERSONNE');
    const masked = mask('[PERSONNE_1] et Jean Garnier', state).masked;
    expect(masked).toBe('[PERSONNE_1] et [PRENOM_1] [NOM_1]');
  });

  it('un nom très long ou très répété reste traité en un temps raisonnable', () => {
    const text = `${'Garnier Jean et Mme Garnier, '.repeat(20000)}fin`;
    const t0 = Date.now();
    const out = mask(text, person).masked;
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(out).not.toMatch(/garnier/i);
  });

  it('des centaines d’entités sur un long texte restent traitées en un temps raisonnable', () => {
    let state = createState();
    for (let i = 0; i < 300; i++) state = addManualMention(state, `Prénom${i} Nomfictif${i}`, 'PERSONNE');
    const text = `${'Nomfictif12 a écrit à Nomfictif250. '.repeat(3000)}`;
    const t0 = Date.now();
    const out = mask(text, state).masked;
    expect(Date.now() - t0).toBeLessThan(8000);
    expect(out).not.toMatch(/Nomfictif/);
  });
});

describe('prénoms inconnus et formes inversées', () => {
  it('propage le nom de famille même si le prénom n’est pas dans la liste', () => {
    const state = addManualMention(createState(), 'Dimitri Kowal', 'PERSONNE');
    expect(mask('M. Kowal, Mme Kowal et D. Kowal', state).masked).toBe('M. [NOM_1], Mme [NOM_1] et [PRENOM_1] [NOM_1]');
  });
  it('comprend une forme de référence inversée', () => {
    const state = addManualMention(createState(), 'Garnier Jean', 'PERSONNE');
    expect(mask('Garnier, J. Garnier et Jean Garnier', state).masked).toBe('[NOM_1], [PRENOM_1] [NOM_1] et [PRENOM_1] [NOM_1]');
  });
});

describe('limites connues (documentées, non corrigées)', () => {
  it('lettres espacées : non reconnues', () => {
    expect(mask('J e a n  G a r n i e r', person).masked).toContain('G a r n i e r');
  });
  it('encodage de pourcentage : non reconnu', () => {
    expect(mask('Jean%20Garnier', person).masked).toContain('Jean%20Garnier');
  });
});
