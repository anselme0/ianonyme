import { describe, expect, it } from 'vitest';
import { createState, detect } from '../src/index.js';

function found(text: string): { text: string; category: string }[] {
  return detect(text, createState()).mentions.map((m) => ({ text: m.text, category: m.category }));
}

describe('règles déterministes (valeurs fictives)', () => {
  it('e-mail', () => {
    expect(found('Contact : marie.fictive@exemple.org.')).toEqual([
      { text: 'marie.fictive@exemple.org', category: 'EMAIL' },
    ]);
  });

  it.each([
    '01 23 45 67 89',
    '01.23.45.67.89',
    '01-23-45-67-89',
    '0123456789',
    '+33 1 23 45 67 89',
    '+33 (0)1 23 45 67 89',
    '0033 1 23 45 67 89',
    '01 23 45 67 89',
  ])('téléphone %s', (num) => {
    expect(found(`Appelez le ${num} demain`)).toEqual([{ text: num, category: 'TELEPHONE' }]);
  });

  it('IBAN avec ou sans espaces, clé contrôlée', () => {
    expect(found('IBAN FR76 3000 6000 0112 3456 7890 189 ok')[0]?.category).toBe('IBAN');
    expect(found('IBAN FR7630006000011234567890189')[0]?.category).toBe('IBAN');
    expect(found('IBAN FR76 3000 6000 0112 3456 7890 188 ok').some((m) => m.category === 'IBAN')).toBe(false);
  });

  it('numéro de sécurité sociale avec clé valide', () => {
    expect(found('NIR 2 69 05 49 588 157 80')[0]?.category).toBe('IDENTIFIANT');
    expect(found('NIR 2 69 05 49 588 157 81').some((m) => m.category === 'IDENTIFIANT')).toBe(false);
  });

  it('SIREN et SIRET avec contrôle de somme', () => {
    expect(found('SIREN 732 829 320')[0]?.category).toBe('IDENTIFIANT');
    expect(found('SIRET 732 829 320 00074')[0]?.category).toBe('IDENTIFIANT');
    expect(found('SIREN 732 829 321').some((m) => m.category === 'IDENTIFIANT')).toBe(false);
  });

  it('immatriculation', () => {
    expect(found('Véhicule AB-123-CD garé')[0]).toEqual({ text: 'AB-123-CD', category: 'IDENTIFIANT' });
  });

  it('numéros de dossier', () => {
    expect(found('Dossier RG 24/01532')[0]).toEqual({ text: 'RG 24/01532', category: 'NUM_DOSSIER' });
    expect(found('Réf. EXP-2024-0417 jointe')[0]).toEqual({ text: 'EXP-2024-0417', category: 'NUM_DOSSIER' });
    expect(found('Parquet n° 23/4471')[0]).toEqual({ text: 'n° 23/4471', category: 'NUM_DOSSIER' });
  });

  it('date de naissance seulement avec indice de contexte', () => {
    expect(found('née le 14 avril 1981 à Dijon')[0]).toEqual({ text: '14 avril 1981', category: 'DATE_NAISSANCE' });
    expect(found('Date de naissance : 03/02/1975')[0]?.text).toBe('03/02/1975');
    expect(found('Les faits datent du 14 avril 1981.')).toEqual([]);
  });

  it('adresse avec code postal et ville', () => {
    expect(found('au 14 rue des Tilleuls, 69003 Lyon, joignable')[0]).toEqual({
      text: '14 rue des Tilleuls, 69003 Lyon',
      category: 'ADRESSE',
    });
    expect(found('8 avenue de la République, 21000 Dijon.')[0]?.text).toBe('8 avenue de la République, 21000 Dijon');
    expect(found('12 bis chemin du Moulin')[0]?.category).toBe('ADRESSE');
  });

  it('personne : civilité, prénom connu, initiale', () => {
    expect(found('en présence de M. Jean Garnier, maire')[0]).toEqual({ text: 'M. Jean Garnier', category: 'PERSONNE' });
    expect(found('Isabelle MOREAU demande')[0]).toEqual({ text: 'Isabelle MOREAU', category: 'PERSONNE' });
    expect(found('Fait le 2 mai. P. Lacombe')[0]).toEqual({ text: 'P. Lacombe', category: 'PERSONNE' });
    expect(found('Mme Sophie Renard, architecte')[0]?.text).toBe('Mme Sophie Renard');
  });

  it('personne : pas de faux nom devant une phrase ordinaire', () => {
    expect(found('Monsieur le maire a répondu')).toEqual([]);
    expect(found('Le rapport est terminé.')).toEqual([]);
  });

  it('organisation : forme juridique et mot-clé', () => {
    expect(found('La société BATIFRANCE SARL, représentée')[0]).toEqual({
      text: 'société BATIFRANCE SARL',
      category: 'ORGANISATION',
    });
    expect(found('Cabinet Rolland et Associés - 22 boulevard Gambetta')[0]?.text).toBe('Cabinet Rolland et Associés');
  });

  it('ne masque pas les dates de faits ni les juridictions publiques (B.3)', () => {
    expect(found('Le tribunal judiciaire de Dijon a statué le 12 mars 2024.')).toEqual([]);
  });
});
