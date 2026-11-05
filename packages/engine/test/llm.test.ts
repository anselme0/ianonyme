import { describe, expect, it } from 'vitest';
import {
  acceptMention,
  addManualMention,
  applyLlmMentions,
  buildLlmPrompt,
  checkLeak,
  chunkText,
  createState,
  ingestText,
  mask,
  mergeLlmMentions,
  parseLlmOutput,
  rejectMention,
  restore,
} from '../src/index.js';

const TEXT = 'M. Jean Garnier, maire de la commune, a signé. Le maire de la commune a précisé que son beau-frère est venu.';

function base() {
  return ingestText(createState(), TEXT).state;
}

describe('mentions proposées par le LLM local', () => {
  it('retient une mention littérale et la rattache à une entité connue', () => {
    const r = mergeLlmMentions(
      [{ text: 'Le maire de la commune', category: 'FONCTION', linkedTo: 'Jean Garnier' }],
      TEXT,
      base(),
    );
    expect(r.mentions).toHaveLength(1);
    expect(r.mentions[0]).toMatchObject({ source: 'llm', status: 'suggested', category: 'FONCTION' });
    expect(r.mentions[0]?.entityId).toBeDefined();
    expect(r.stats.retained).toBe(1);
  });

  it('écarte une proposition absente du texte (hallucination)', () => {
    const r = mergeLlmMentions([{ text: 'le préfet du département', category: 'FONCTION', linkedTo: null }], TEXT, base());
    expect(r.mentions).toEqual([]);
    expect(r.stats.hallucinated).toBe(1);
  });

  it('accepte une copie dont seules la casse et les accents diffèrent', () => {
    const r = mergeLlmMentions([{ text: 'SON BEAU-FRERE', category: 'LIEN_PARENTE', linkedTo: null }], TEXT, base());
    expect(r.mentions).toHaveLength(1);
    expect(r.mentions[0]?.text).toBe('son beau-frère');
  });

  it('ignore une catégorie hors liste et les entrées mal formées', () => {
    const r = mergeLlmMentions(
      [
        { text: 'son beau-frère', category: 'MONSTRE', linkedTo: null },
        'chaîne',
        null,
        { category: 'LIEU' },
      ],
      TEXT,
      base(),
    );
    expect(r.mentions).toEqual([]);
    expect(r.stats.invalidCategory).toBe(4);
  });

  it('écarte ce qui est déjà couvert ou rejeté', () => {
    const s = base();
    const dup = mergeLlmMentions([{ text: 'Jean Garnier', category: 'PERSONNE', linkedTo: null }], TEXT, s);
    expect(dup.mentions).toEqual([]);
    expect(dup.stats.duplicates).toBe(1);
    const rejected = rejectMention(s, {
      id: 'x', text: 'son beau-frère', span: { start: 0, end: 1 }, category: 'LIEN_PARENTE', source: 'llm', status: 'suggested',
    });
    const r = mergeLlmMentions([{ text: 'son beau-frère', category: 'LIEN_PARENTE', linkedTo: null }], TEXT, rejected);
    expect(r.mentions).toEqual([]);
  });

  it('met linkedTo à null si l\'entité n\'existe pas', () => {
    const r = mergeLlmMentions([{ text: 'son beau-frère', category: 'LIEN_PARENTE', linkedTo: 'Inconnu Total' }], TEXT, base());
    expect(r.mentions[0]?.entityId).toBeUndefined();
  });

  it('signale un rattachement ambigu comme conflit, sans le résoudre', () => {
    const s = ingestText(createState(), 'Pierre Dupuis et Jacques Dupuis.').state;
    const r = mergeLlmMentions(
      [{ text: 'le frère', category: 'LIEN_PARENTE', linkedTo: 'Dupuis' }],
      'Pierre Dupuis et Jacques Dupuis. Le frère est absent.',
      s,
    );
    expect(r.conflicts).toHaveLength(1);
    expect(r.mentions[0]?.entityId).toBeUndefined();
  });

  it('plafonne le nombre de suggestions', () => {
    const items = ['un', 'deux', 'trois'].map((w) => ({ text: w, category: 'LIEU' as const, linkedTo: null }));
    const r = mergeLlmMentions(items, 'un deux trois', createState(), { maxMentions: 2 });
    expect(r.mentions).toHaveLength(2);
    expect(r.stats.capped).toBe(1);
  });

  it('une suggestion acceptée est masquée ; en attente, elle ne l\'est pas', () => {
    const s = base();
    const r = mergeLlmMentions([{ text: 'son beau-frère', category: 'LIEN_PARENTE', linkedTo: null }], TEXT, s);
    expect(mask(TEXT, s).masked).toContain('son beau-frère');
    const accepted = acceptMention(s, r.mentions[0]!);
    expect(mask(TEXT, accepted).masked).toContain('[LIEN_PARENTE_1]');
  });
});

describe('sortie brute du modèle', () => {
  it('analyse un objet, un tableau, ou un objet entouré de texte', () => {
    expect(parseLlmOutput('{"mentions": []}')).toEqual([]);
    expect(parseLlmOutput('[{"text":"a"}]')).toHaveLength(1);
    expect(parseLlmOutput('Voici : {"mentions":[{"text":"a"}]} merci')).toHaveLength(1);
  });
  it('renvoie null pour un JSON inutilisable', () => {
    expect(parseLlmOutput('pas du json')).toBeNull();
    expect(parseLlmOutput('{"mentions": ')).toBeNull();
    expect(parseLlmOutput('{"autre": 1}')).toBeNull();
  });
});

describe('consigne et découpage', () => {
  it('liste les entités connues par nom de référence', () => {
    const prompt = buildLlmPrompt('Un texte.', base());
    expect(prompt).toContain('Jean Garnier (PERSONNE)');
    expect(prompt).toContain('Un texte.');
    expect(prompt).not.toContain('{{');
  });
  it('découpe par paragraphes avec chevauchement', () => {
    const text = ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30), 'd'.repeat(30)].join('\n');
    const chunks = chunkText(text, 70);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('\n')).toContain('d'.repeat(30));
    expect(chunks[1]?.startsWith(chunks[0]!.split('\n').slice(-1)[0]!)).toBe(true);
  });
});

describe('application d’office des propositions', () => {
  it('protège les mentions, relie une mention à une autre proposée, laisse les cas ambigus', () => {
    const text = 'Paul Martin est architecte. Le maire de Saint-Cloud a parlé. Son voisin du dessus a contredit.';
    const r = mergeLlmMentions(
      [
        { text: 'Le maire de Saint-Cloud', category: 'FONCTION', linkedTo: 'Son voisin du dessus' },
        { text: 'Son voisin du dessus', category: 'LIEN_PARENTE', linkedTo: null },
      ],
      text,
      createState(),
    );
    expect(r.peerLinks).toEqual({ 'le maire de saint cloud': 'son voisin du dessus' });
    const applied = applyLlmMentions(createState(), r.mentions, r.conflicts, r.peerLinks);
    expect(applied.remaining).toEqual([]);
    expect(Object.keys(applied.state.entities)).toHaveLength(1);
    const { masked } = mask(text, applied.state);
    expect(masked).not.toContain('voisin');
    expect(masked).not.toContain('Saint-Cloud');
    expect(masked).toContain('architecte');
  });
});

describe('fonction rattachée à une personne : le repère est ajouté, la fonction reste lisible', () => {
  const role = (text: string, category: 'FONCTION' | 'LIEN_PARENTE' = 'FONCTION') => ({
    id: 'x',
    text,
    span: { start: 0, end: 1 },
    category,
    source: 'llm' as const,
    status: 'suggested' as const,
  });

  function stateWithGerant() {
    let s = ingestText(createState(), 'M. Étienne Vasseur est le gérant de BÂTIRAVEL SAS.').state;
    const id = Object.values(s.entities).find((e) => e.category === 'PERSONNE')!.id;
    s = acceptMention(s, role('gérant'), id);
    s = acceptMention(s, role('Le gérant'), id);
    return s;
  }

  it('ajoute le repère de la personne devant la fonction seule', () => {
    const s = stateWithGerant();
    expect(mask('Le gérant a répondu.', s).masked).toBe('[PRENOM_1] [NOM_1] (Le gérant) a répondu.');
  });

  it('ne répète pas le repère quand le nom est juste à côté', () => {
    const s = stateWithGerant();
    expect(mask('M. Étienne Vasseur, gérant, a répondu.', s).masked).toBe('[PRENOM_1] [NOM_1], gérant, a répondu.');
    expect(mask('Le gérant, M. Vasseur, a répondu.', s).masked).toBe('Le gérant, [NOM_1], a répondu.'.replace('[NOM_1]', 'M. [NOM_1]'));
  });

  it('une fonction qui contient une valeur protégée voit cette valeur masquée', () => {
    let s = ingestText(createState(), 'Jean Garnier, maire de Valmont-sur-Aure.').state;
    s = addManualMention(s, 'Valmont-sur-Aure', 'LIEU');
    const id = Object.values(s.entities).find((e) => e.category === 'PERSONNE')!.id;
    s = acceptMention(s, role('maire de Valmont-sur-Aure'), id);
    const out = mask('Le maire de Valmont-sur-Aure a parlé.', s).masked;
    expect(out).toBe('Le [PRENOM_1] [NOM_1] (maire de [LIEU_1]) a parlé.');
    expect(checkLeak(out, s).ok).toBe(true);
  });

  it('une fonction dont un mot identifiant n’est pas protégé est remplacée en entier', () => {
    let s = ingestText(createState(), 'Jean Garnier, maire de Valmont-sur-Aure.').state;
    const id = Object.values(s.entities).find((e) => e.category === 'PERSONNE')!.id;
    s = acceptMention(s, role('maire de Valmont-sur-Aure'), id);
    expect(mask('Le maire de Valmont-sur-Aure a parlé.', s).masked).toBe('Le [PRENOM_1] [NOM_1] a parlé.');
  });

  it('une fonction générique laissée visible n’est pas une fuite', () => {
    const s = stateWithGerant();
    const { masked } = mask('Le gérant a répondu.', s);
    expect(checkLeak(masked, s).ok).toBe(true);
  });

  it('la restitution remet le nom devant la fonction', () => {
    const s = stateWithGerant();
    expect(restore('[PRENOM_1] [NOM_1] (Le gérant) a répondu.', s).restored).toBe('Étienne Vasseur (Le gérant) a répondu.');
  });
});

describe('propositions écartées : contexte ordinaire et institutions publiques', () => {
  const TEXTE = 'Le gérant de la société BÂTIRAVEL SAS a répondu. Le juge des référés du tribunal judiciaire a statué. Le maire de Valmont-sur-Aure a parlé.';

  it('écarte une fonction ordinaire, une juridiction et leurs variantes', () => {
    const r = mergeLlmMentions(
      [
        { text: 'Le gérant de la société BÂTIRAVEL SAS', category: 'FONCTION', linkedTo: null },
        { text: 'gérant', category: 'FONCTION', linkedTo: null },
        { text: 'Juge des référés', category: 'FONCTION', linkedTo: null },
        { text: 'Tribunal judiciaire', category: 'ORGANISATION', linkedTo: null },
        { text: 'services municipaux', category: 'ORGANISATION', linkedTo: null },
      ],
      TEXTE,
      createState(),
    );
    expect(r.mentions).toEqual([]);
    expect(r.stats.generic).toBe(5);
  });

  it('écarte une date de fait proposée comme identifiant', () => {
    const r = mergeLlmMentions(
      [
        { text: '6 décembre 2025', category: 'IDENTIFIANT', linkedTo: null },
        { text: '12/03/2024', category: 'IDENTIFIANT', linkedTo: null },
      ],
      'Les désordres sont apparus le 6 décembre 2025 puis le 12/03/2024.',
      createState(),
    );
    expect(r.mentions).toEqual([]);
    expect(r.stats.generic).toBe(2);
  });

  it('garde une désignation qui identifie : « le maire de Valmont-sur-Aure »', () => {
    const r = mergeLlmMentions([{ text: 'Le maire de Valmont-sur-Aure', category: 'FONCTION', linkedTo: null }], TEXTE, createState());
    expect(r.mentions).toHaveLength(1);
    expect(r.stats.generic).toBe(0);
  });
});

describe('organisation : le mot « société » ou « cabinet » reste lisible', () => {
  it('seul le nom propre est remplacé, y compris en minuscules dans un message', () => {
    const s = ingestText(createState(), 'La société BÂTIRAVEL SAS a livré. Cabinet Maurel Expertises - Dossier.').state;
    expect(mask('Qui est le gérant de la société batiravel ?', s).masked).toMatch(/^Qui est le gérant de la société \[ORGANISATION_\d\] \?$/);
    expect(mask('Cabinet Maurel Expertises', s).masked).toMatch(/^Cabinet \[ORGANISATION_\d\]$/);
  });
});
