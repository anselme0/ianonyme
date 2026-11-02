import { describe, expect, it } from 'vitest';
import {
  acceptMention,
  addManualMention,
  buildApiPayload,
  createState,
  detect,
  ingestText,
  linkMention,
  mask,
  protectFileName,
  rejectMention,
  requiresReview,
  restore,
} from '../src/index.js';
import { conv, protect, stateWith } from './helpers.js';

describe('historique et re-masquage', () => {
  it('re-masque le tour 1 quand une entité est ajoutée au tour 4', () => {
    const turns = [
      'Le dossier de Zoé Quenelle avance.',
      'Réponse sur le dossier.',
      'Merci.',
      'Que pense Quenelle de cela ?',
    ];
    const state0 = createState();
    expect(buildApiPayload(conv(state0, ...turns)).messages[0]?.content).toContain('Quenelle');
    const state = addManualMention(state0, 'Zoé Quenelle', 'PERSONNE');
    const payload = buildApiPayload(conv(state, ...turns));
    expect(payload.leak.ok).toBe(true);
    expect(payload.messages[0]?.content).toBe('Le dossier de [PERSONNE_1] avance.');
    expect(payload.messages[3]?.content).toBe('Que pense [PERSONNE_1] de cela ?');
  });

  it('bloque quand une valeur reste dans l\'historique et indique le message', () => {
    const state = stateWith(['Jean Garnier']);
    const c = conv(state, 'Bonjour Jean Garnier', 'Oui', 'Mail : fictif.test@exemple.org');
    const payload = buildApiPayload(c);
    expect(payload.leak.ok).toBe(false);
    expect(payload.leak.leaks.map((l) => l.messageIndex)).toEqual([2]);
  });

  it('garde les mêmes repères sur cinq tours', () => {
    let state = createState();
    const turns: string[] = [];
    const inputs = [
      'Mme Sophie Renard a appelé.',
      'Sophie Renard confirme.',
      'Renard demande un délai.',
      'Mme Renard et M. Jean Garnier se rencontrent.',
      'Garnier rappelle Sophie Renard.',
    ];
    for (const t of inputs) {
      state = ingestText(state, t).state;
      turns.push(t);
    }
    const payload = buildApiPayload(conv(state, ...turns));
    expect(payload.leak.ok).toBe(true);
    const placeholders = payload.messages.flatMap((m) => m.content.match(/\[PERSONNE_\d+\]/g) ?? []);
    expect(new Set(placeholders)).toEqual(new Set(['[PERSONNE_1]', '[PERSONNE_2]']));
    expect(payload.messages[0]?.content).toBe('[PERSONNE_1] a appelé.');
    expect(payload.messages[4]?.content).toBe('[PERSONNE_2] rappelle [PERSONNE_1].');
  });
});

describe('conflits', () => {
  it('signale deux personnes de même nom de famille, sans fusion', () => {
    const state = ingestText(createState(), 'Pierre Dupuis et Jacques Dupuis sont frères.').state;
    expect(Object.keys(state.entities)).toHaveLength(2);
    const r = detect('Dupuis a signé.', state);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]?.candidateEntityIds).toHaveLength(2);
    expect(r.mentions[0]?.status).toBe('suggested');
    // L'ambiguïté non tranchée n'est pas masquée : la vérification de sécurité la bloque.
    const masked = mask('Dupuis a signé.', state).masked;
    expect(masked).toBe('Dupuis a signé.');
    expect(buildApiPayload(conv(state, 'Dupuis a signé.')).leak.ok).toBe(false);
  });

  it('se résout par le choix explicite de l\'utilisateur', () => {
    const base = ingestText(createState(), 'Pierre Dupuis et Jacques Dupuis sont frères.').state;
    const r = detect('Dupuis a signé.', base);
    const mention = r.mentions[0]!;
    const target = r.conflicts[0]!.candidateEntityIds[0]!;
    const state = linkMention(base, mention, target);
    expect(detect('Dupuis a signé.', state).conflicts).toHaveLength(0);
    expect(mask('Dupuis a signé.', state).masked).toMatch(/^\[PERSONNE_\d\] a signé\.$/);
  });

  it('n\'attribue pas Marc Moreau à Isabelle Moreau', () => {
    const state = ingestText(createState(), 'Isabelle Moreau et Marc Moreau.').state;
    expect(Object.values(state.entities).map((e) => e.canonical).sort()).toEqual([
      'Isabelle Moreau',
      'Marc Moreau',
    ]);
  });
});

describe('décisions de l\'utilisateur', () => {
  it('rejeter retire la valeur et ne la suggère plus', () => {
    const { state, mentions } = protect('Contact : fictif@exemple.org');
    const email = mentions.find((m) => m.category === 'EMAIL')!;
    const next = rejectMention(state, email);
    expect(mask('Contact : fictif@exemple.org', next).masked).toBe('Contact : fictif@exemple.org');
    expect(detect('fictif@exemple.org', next).mentions).toEqual([]);
    expect(Object.keys(next.entities)).toHaveLength(0);
  });

  it('accepter avec entityId rattache la valeur à l\'entité', () => {
    let state = ingestText(createState(), 'Philippe Lacombe est expert.').state;
    const id = Object.keys(state.entities)[0]!;
    state = acceptMention(
      state,
      { id: 'x', text: 'le président de l\'association', span: { start: 0, end: 5 }, category: 'FONCTION', source: 'llm', status: 'suggested' },
      id,
    );
    expect(mask('Le président de l\'association parle.', state).masked).toBe('[PERSONNE_1] parle.');
  });

  it('ajout manuel d\'une catégorie sans variantes', () => {
    const state = addManualMention(createState(), 'Valmont-sur-Aure', 'LIEU');
    expect(mask('à Valmont sur Aure', state).masked).toBe('à [LIEU_1]');
  });
});

describe('revue obligatoire', () => {
  it.each([
    [{ isFile: true, pendingLlmSuggestions: 0, conflicts: 0 }, true],
    [{ isFile: false, pendingLlmSuggestions: 1, conflicts: 0 }, true],
    [{ isFile: false, pendingLlmSuggestions: 0, conflicts: 2 }, true],
    [{ isFile: false, pendingLlmSuggestions: 0, conflicts: 0 }, false],
  ])('requiresReview %j', (input, expected) => {
    expect(requiresReview(input)).toBe(expected);
  });
});

describe('nom de fichier', () => {
  it('est traité comme une entrée et masqué', () => {
    const { maskedName, state } = protectFileName(createState(), 'rapport_Jean_Garnier_final.docx');
    expect(maskedName.endsWith('.docx')).toBe(true);
    expect(maskedName).not.toContain('Garnier');
    expect(Object.values(state.entities).some((e) => e.canonical === 'Jean Garnier')).toBe(true);
  });
});

describe('allers-retours', () => {
  it('restitue ce qui a été masqué', () => {
    const text = 'M. Jean Garnier a écrit à fictif@exemple.org le 12 mars 2024.';
    const { state, masked } = protect(text);
    expect(masked).not.toContain('Garnier');
    const back = restore(masked, state).restored;
    expect(back).toContain('Jean Garnier');
    expect(back).toContain('fictif@exemple.org');
  });
});
