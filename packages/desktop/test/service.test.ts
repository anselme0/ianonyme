import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/main/config.js';
import type { LocalLlm } from '../src/main/localllm.js';
import { Harness, spyProvider } from './helpers.js';

const REPORT = [
  'RAPPORT D\'EXPERTISE - Dossier n° RG 24/01532',
  'Je soussigné, Philippe Lacombe, expert, domicilié 14 rue des Tilleuls, 69003 Lyon, joignable au 04 72 33 18 45 ou p.lacombe@expertises-lacombe.fr.',
  'Les opérations se sont déroulées en présence de M. Jean Garnier, maire de Valmont-sur-Aure. Le maire de la commune a précisé que les travaux avaient été commandés le 5 juin 2022.',
  'Mme Sophie Renard, architecte, a indiqué que son beau-frère avait réalisé la charpente. Garnier a confirmé la réception le 12 mars 2024.',
].join('\n');

const absentLlm: LocalLlm = {
  simulated: false,
  status: () => 'absent',
  propose: () => Promise.reject(new Error('absent')),
  warmUp: () => {},
};

describe('envoi et restitution', () => {
  it('ne transmet que du texte masqué et restitue la réponse', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, `Fais la chronologie des faits.\n\n${REPORT}`);
    expect(h.errors).toEqual([]);
    const sent = JSON.stringify(h.spy.calls[0]);
    for (const secret of ['Lacombe', 'Garnier', 'Renard', '04 72 33 18 45', 'expertises-lacombe', 'Tilleuls', 'RG 24/01532']) {
      expect(sent, secret).not.toContain(secret);
    }
    expect(h.spy.calls[0]?.messages[0]?.content).toContain('[PRENOM_');
    expect(h.spy.calls[0]?.system).toContain('Conservez les repères');
    const reply = h.done[0]!.message;
    expect(reply.text).not.toMatch(/\[(?:PRENOM|NOM)_\d+\]/);
    expect(reply.segments?.some((s) => s.restoredFrom)).toBe(true);
    expect(reply.text).toContain('12 mars 2024');
  });

  it('garde les mêmes repères sur cinq tours', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const turns = [
      'Mme Sophie Renard a appelé hier.',
      'Sophie Renard confirme le rendez-vous.',
      'Renard demande un délai.',
      'Mme Renard et M. Jean Garnier se rencontrent.',
      'Garnier rappelle Sophie Renard.',
    ];
    for (const t of turns) await h.send(conv.id, t);
    expect(h.errors).toEqual([]);
    expect(h.spy.calls).toHaveLength(5);
    const last = h.spy.calls[4]!.messages.filter((m) => m.role === 'user').map((m) => m.content);
    expect(last[0]).toBe('[PRENOM_1] [NOM_1] a appelé hier.');
    expect(last[4]).toBe('[NOM_2] rappelle [PRENOM_1] [NOM_1].');
    expect(JSON.stringify(h.spy.calls[4])).not.toMatch(/Renard|Garnier/);
  });

  it('deux personnes qui se confondent restent à trancher : pas de repère attribué au hasard', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, 'Jean Dupuis et Jacques Dupuis sont frères.');
    expect(h.errors).toEqual([]);
    const p = h.service.preview(conv.id, 'J. Dupuis a signé.', [], 0);
    expect(p.conflicts).toHaveLength(1);
    expect(p.requiresReview).toBe(true);
  });

  it('signale les repères altérés par l\'assistant', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, 'Mme Sophie Renard demande une anomalie.');
    const done = h.done[0]!;
    expect(done.anomalies.map((a) => a.kind).sort()).toEqual(['malformed_placeholder', 'unknown_placeholder']);
    expect(done.message.anomalyCount).toBe(2);
  });

  it('renvoie assistant_unreachable en cas de panne, sans perdre le message', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, 'Simule une panne pour Mme Sophie Renard.');
    expect(h.errors[0]?.code).toBe('assistant_unreachable');
    expect(h.service.getView(conv.id).messages.map((m) => m.role)).toEqual(['user']);
  });

  it('régénère la dernière réponse', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, 'Bonjour, M. Jean Garnier est là.');
    const wait = new Promise<void>((r) => h.waiters.push(r));
    h.service.send({ convId: conv.id, userText: '', fileIds: [], regenerate: true });
    await wait;
    expect(h.spy.calls).toHaveLength(2);
    expect(h.service.getView(conv.id).messages.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('arrête la génération et conserve le texte déjà reçu, sans repère incomplet', async () => {
    const spy = spyProvider(3);
    const h = new Harness(spy);
    const conv = h.service.create();
    const wait = new Promise<void>((r) => h.waiters.push(r));
    h.service.send({ convId: conv.id, userText: 'Bonjour M. Jean Garnier, merci de répondre.', fileIds: [] });
    h.service.stop(conv.id);
    await wait;
    expect(h.errors).toEqual([]);
    const text = h.done[0]!.message.text;
    expect(text).not.toMatch(/\[[A-Z_]*$/);
  });

  it('ignore un envoi vide', async () => {
    const h = new Harness();
    const conv = h.service.create();
    h.service.send({ convId: conv.id, userText: '   ', fileIds: [] });
    await new Promise((r) => setTimeout(r, 20));
    expect(h.spy.calls).toEqual([]);
  });
});

describe('aperçu et détection', () => {
  it('prévisualise le texte exact et la revue obligatoire pour un fichier', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const file = await h.service.importFile(conv.id, 'rapport_Jean_Garnier.txt', new TextEncoder().encode(REPORT));
    expect(file.ok).toBe(true);
    expect(file.file?.maskedName).not.toContain('Garnier');
    const p = h.service.preview(conv.id, 'Résume ce dossier.', [file.file!.id], 0);
    expect(p.requiresReview).toBe(true);
    expect(p.leak.ok).toBe(true);
    expect(p.maskedCurrent).not.toMatch(/Garnier|Lacombe|Renard/);
    expect(p.maskedCurrent).toContain('Document « rapport [PRENOM_');
  });

  it('un message court sans suggestion ni conflit ne demande pas de revue', () => {
    const h = new Harness();
    const conv = h.service.create();
    const p = h.service.preview(conv.id, 'Bonjour, M. Jean Garnier.', [], 0);
    expect(p.requiresReview).toBe(false);
    expect(p.protectedInMessage).toBe(1);
  });

  it('la détection instantanée n\'enregistre rien', () => {
    const h = new Harness();
    const conv = h.service.create();
    const a = h.service.analyze(conv.id, 'Mme Sophie Renard');
    expect(a.protectedInText).toBe(1);
    expect(h.service.getView(conv.id).entities).toEqual([]);
  });

  it('rejette un fichier piégé ou illisible sans citer son contenu', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const png = await h.service.importFile(conv.id, 'photo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    expect(png.blocked?.reason).toBe('file_image');
    const empty = await h.service.importFile(conv.id, 'vide.txt', new Uint8Array());
    expect(empty.blocked?.reason).toBe('file_unreadable');
  });
});

describe('analyse approfondie', () => {
  it('protège d’office les mentions indirectes proposées', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const r = await h.service.propose(conv.id, REPORT);
    expect(r.degraded).toBe(false);
    // L'analyse protège d'office : rien ne reste à vérifier hors cas ambigus.
    expect(r.mentions).toEqual([]);
    const a = h.service.analyze(conv.id, 'Le maire de la commune a signé.');
    expect(a.maskedText).toMatch(/^\[PRENOM_\d\] \[NOM_\d\] a signé\.$/);
  });

  it('bascule en analyse de base quand le modèle est absent', async () => {
    const h = new Harness(spyProvider(), absentLlm);
    const conv = h.service.create();
    const r = await h.service.propose(conv.id, REPORT);
    expect(r.degraded).toBe(true);
    expect(r.degradedReason).toBe('absent');
    expect(r.mentions).toEqual([]);
  });

  it('bascule en analyse de base sur délai dépassé', async () => {
    const slow: LocalLlm = {
      simulated: true,
      status: () => 'ready',
      warmUp: () => {},
      propose: (_c, _s, signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    };
    const cfg = defaultConfig();
    cfg.localModel = {
      engine: 'fake',
      active: 'x',
      registry: [{ id: 'x', file: 'x', downloadUrl: '', sha256: '', contextSize: 0, chunkChars: 2000, timeoutMs: 30 }],
    };
    const h = new Harness(spyProvider(), slow, cfg);
    const conv = h.service.create();
    const r = await h.service.propose(conv.id, REPORT);
    expect(r.degraded).toBe(true);
    expect(r.degradedReason).toBe('timeout');
  });

  it('gère une sortie JSON invalide du modèle (une relance, puis abandon du morceau)', async () => {
    let calls = 0;
    const bad: LocalLlm = {
      simulated: true,
      status: () => 'ready',
      warmUp: () => {},
      propose: () => {
        calls++;
        return Promise.resolve('pas du json');
      },
    };
    const h = new Harness(spyProvider(), bad);
    const conv = h.service.create();
    const r = await h.service.propose(conv.id, 'Un texte court sans rien.');
    expect(calls).toBe(2);
    expect(r.stats.invalidJson).toBe(1);
    expect(r.mentions).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it('écarte une hallucination du modèle', async () => {
    const liar: LocalLlm = {
      simulated: true,
      status: () => 'ready',
      warmUp: () => {},
      propose: () => Promise.resolve(JSON.stringify({ mentions: [{ text: 'le préfet inventé', category: 'FONCTION', linkedTo: null }] })),
    };
    const h = new Harness(spyProvider(), liar);
    const conv = h.service.create();
    const r = await h.service.propose(conv.id, REPORT);
    expect(r.mentions).toEqual([]);
    expect(r.stats.hallucinated).toBe(1);
  });
});

describe('conversations et réglages', () => {
  it('crée, renomme, efface et supprime', async () => {
    const h = new Harness();
    const a = h.service.create();
    h.service.create();
    expect(h.service.list()).toHaveLength(2);
    h.service.rename(a.id, 'Dossier fictif');
    expect(h.service.getView(a.id).title).toBe('Dossier fictif');
    await h.send(a.id, 'M. Jean Garnier écrit.');
    expect(h.service.getView(a.id).entities.length).toBeGreaterThan(0);
    const cleared = h.service.clear(a.id);
    expect(cleared.entities).toEqual([]);
    expect(cleared.messages).toEqual([]);
    expect(h.service.remove(a.id)).toHaveLength(1);
    expect(() => h.service.getView(a.id)).toThrow('conversation_not_found');
  });

  it('chaque conversation a ses propres correspondances', async () => {
    const h = new Harness();
    const a = h.service.create();
    const b = h.service.create();
    await h.send(a.id, 'M. Jean Garnier écrit.');
    expect(h.service.getView(b.id).entities).toEqual([]);
  });

  it('ne retient qu\'un fournisseur configuré', () => {
    const h = new Harness();
    const conv = h.service.create();
    const v = h.service.updateSettings({ convId: conv.id, assistantId: 'inconnu', deepAnalysisOnMessages: false });
    expect(v.settings).toEqual({ assistantId: 'demo-fake', deepAnalysisOnMessages: false });
  });

  it('décisions : rejeter une détection retire la protection', async () => {
    const h = new Harness();
    const conv = h.service.create();
    await h.send(conv.id, 'Écrire à fictif@exemple.org');
    const a = h.service.analyze(conv.id, 'Écrire à fictif@exemple.org');
    const email = a.mentions.find((m) => m.category === 'EMAIL')!;
    h.service.decide({ convId: conv.id, action: 'reject', mention: email });
    expect(h.service.analyze(conv.id, 'Écrire à fictif@exemple.org').maskedText).toContain('fictif@exemple.org');
  });

  it('refuse une décision mal formée sans citer de valeur', () => {
    const h = new Harness();
    const conv = h.service.create();
    expect(() => h.service.decide({ convId: conv.id, action: 'accept', mention: { text: 'x' } as never })).toThrow('internal');
  });
});

describe('nom de fichier', () => {
  it('un nom que les règles ne connaissent pas ne part pas en clair', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const file = await h.service.importFile(conv.id, 'rapport garnier_v2.txt', new TextEncoder().encode('Contenu banal.'));
    expect(file.file?.maskedName).toBe('rapport … v2.txt');
    await h.send(conv.id, 'Résume.', [file.file!.id]);
    expect(JSON.stringify(h.spy.calls[0])).not.toMatch(/garnier/i);
    expect(h.spy.calls[0]?.messages[0]?.content).toContain('Document « rapport … v2.txt »');
  });

  it('les mots courants et les numéros sont conservés, les valeurs protégées sont masquées', async () => {
    const h = new Harness();
    const conv = h.service.create();
    const file = await h.service.importFile(conv.id, 'Compte rendu réunion M. Jean Garnier 2025.txt', new TextEncoder().encode('Contenu.'));
    expect(file.file?.maskedName).toMatch(/^Compte rendu réunion \[PRENOM_\d+\] \[NOM_\d+\] 2025\.txt$/);
  });
});
