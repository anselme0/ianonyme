// Mesure du rappel sur le corpus fictif (docs/DOCUMENTATION.md, §12).
// Réutilise le moteur sans passer par l'interface. Les documents `eval-*` ne servent qu'à mesurer :
// on n'ajuste jamais une règle ni la consigne en les regardant.
//
// Usage : pnpm measure [--llm chemin/vers/module.ts]
// Le module doit exporter `proposeMentions(chunk: string, state): Promise<unknown[]>`.
// Sans module, la mesure porte sur les règles et variantes seules (« analyse de base »).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  acceptMention,
  chunkText,
  createState,
  detect,
  findOccurrences,
  ingestText,
  mask,
  mergeLlmMentions,
  normalizeText,
} from '../src/index.js';
import type { ConversationState, Mention } from '../src/index.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const CORPUS = resolve(ROOT, 'corpus');
const OUT = resolve(ROOT, 'reports/measure.json');

type Kind = 'direct' | 'indirect';
type Source = 'regex' | 'variant' | 'llm';

interface Annotation {
  entities: { category: string; mentions: { text: string; kind: Kind }[] }[];
}

interface Counter {
  total: number;
  detected: number;
  bySource: Record<Source, number>;
}

const newCounter = (): Counter => ({ total: 0, detected: 0, bySource: { regex: 0, variant: 0, llm: 0 } });

export type LlmProposer = (chunk: string, state: ConversationState) => Promise<unknown[]>;

interface DocResult {
  document: string;
  set: 'ajust' | 'eval';
  characters: number;
  mentions: { category: string; kind: Kind; detected: boolean; source: Source | null; occurrences: number }[];
  directValues: number;
  directValuesLeft: number;
  falseAutomatic: number;
  falseSuggestions: number;
  conflicts: number;
  llm: { proposed: number; retained: number; invalidJson: number; hallucinated: number; durationMs: number } | null;
}

function overlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

async function measureDocument(
  name: string,
  text: string,
  ann: Annotation,
  proposer: LlmProposer | null,
): Promise<DocResult> {
  const nt = normalizeText(text);
  let { state } = ingestText(createState(), text);
  let falseSuggestions = 0;
  let llm: DocResult['llm'] = null;

  if (proposer) {
    llm = { proposed: 0, retained: 0, invalidJson: 0, hallucinated: 0, durationMs: 0 };
    const started = Date.now();
    for (const chunk of chunkText(text, 2000)) {
      const raw = await proposer(chunk, state);
      const merged = mergeLlmMentions(raw, chunk, state);
      llm.proposed += merged.stats.proposed;
      llm.retained += merged.stats.retained;
      llm.invalidJson += merged.stats.invalidJson;
      llm.hallucinated += merged.stats.hallucinated;
      // Meilleur cas : l'utilisateur accepte les suggestions qui correspondent à une mention annotée.
      for (const m of merged.mentions) {
        const hits = ann.entities.some((e) => e.mentions.some((x) => findOccurrences(normalizeText(chunk), x.text).some((o) => overlap(o, m.span))));
        if (hits) state = acceptMention(state, m);
        else falseSuggestions++;
      }
    }
    llm.durationMs = Date.now() - started;
  }

  const final = detect(text, state);
  const conflicts = final.conflicts.length;
  const { masked, replacements } = mask(text, state);
  const sourceAt = (span: { start: number; end: number }): Source | null => {
    const m: Mention | undefined = final.mentions.find((x) => x.status === 'accepted' && overlap(x.span, span));
    if (m) return m.source === 'manual' ? 'regex' : m.source;
    // Les mentions du LLM acceptées sont masquées via les variantes de leur entité.
    return replacements.some((r) => overlap(r.span, span)) ? (proposer ? 'llm' : 'variant') : null;
  };

  const mentions: DocResult['mentions'] = [];
  const annotated: { start: number; end: number }[] = [];
  const ntMasked = normalizeText(masked);
  let directValues = 0;
  let directValuesLeft = 0;
  for (const e of ann.entities) {
    for (const m of e.mentions) {
      const occ = findOccurrences(nt, m.text);
      annotated.push(...occ);
      const covered = occ.map((o) => ({
        o,
        ok: replacements.some((r) => r.span.start <= o.start && r.span.end >= o.end),
      }));
      const detected = occ.length > 0 && covered.every((c) => c.ok);
      const first = covered[0];
      mentions.push({
        category: e.category,
        kind: m.kind,
        detected,
        source: detected && first ? sourceAt(first.o) : null,
        occurrences: occ.length,
      });
      if (m.kind === 'direct') {
        directValues++;
        if (findOccurrences(ntMasked, m.text).length > 0) directValuesLeft++;
      }
    }
  }
  const falseAutomatic = final.mentions.filter(
    (m) => m.status === 'accepted' && !annotated.some((a) => overlap(a, m.span)),
  ).length;

  return {
    document: name,
    set: name.startsWith('eval-') ? 'eval' : 'ajust',
    characters: text.length,
    mentions,
    directValues,
    directValuesLeft,
    falseAutomatic,
    falseSuggestions,
    conflicts,
    llm,
  };
}

interface Table {
  [category: string]: { direct: Counter; indirect: Counter };
}

function aggregate(docs: DocResult[]) {
  const table: Table = {};
  const total = { direct: newCounter(), indirect: newCounter() };
  for (const d of docs) {
    for (const m of d.mentions) {
      const row = (table[m.category] ??= { direct: newCounter(), indirect: newCounter() });
      for (const c of [row[m.kind], total[m.kind]]) {
        c.total++;
        if (m.detected) {
          c.detected++;
          if (m.source) c.bySource[m.source]++;
        }
      }
    }
  }
  const sum = (f: (d: DocResult) => number): number => docs.reduce((n, d) => n + f(d), 0);
  return {
    documents: docs.length,
    table,
    total,
    directValues: sum((d) => d.directValues),
    directValuesLeft: sum((d) => d.directValuesLeft),
    falseAutomaticPerDocument: docs.length ? sum((d) => d.falseAutomatic) / docs.length : 0,
    falseSuggestionsPerDocument: docs.length ? sum((d) => d.falseSuggestions) / docs.length : 0,
    conflictsPerDocument: docs.length ? sum((d) => d.conflicts) / docs.length : 0,
  };
}

function pct(c: Counter): string {
  return c.total === 0 ? '-' : `${Math.round((100 * c.detected) / c.total)} % (${c.detected}/${c.total})`;
}

async function main(): Promise<void> {
  const llmArg = process.argv.indexOf('--llm');
  let proposer: LlmProposer | null = null;
  if (llmArg >= 0 && process.argv[llmArg + 1]) {
    const mod = (await import(pathToFileURL(resolve(process.argv[llmArg + 1] as string)).href)) as {
      proposeMentions: LlmProposer;
    };
    proposer = mod.proposeMentions;
  }
  const names = readdirSync(CORPUS)
    .filter((f) => f.endsWith('.annotations.json'))
    .map((f) => f.replace('.annotations.json', ''))
    .sort();
  const docs: DocResult[] = [];
  for (const name of names) {
    const text = readFileSync(resolve(CORPUS, `${name}.txt`), 'utf8');
    const ann = JSON.parse(readFileSync(resolve(CORPUS, `${name}.annotations.json`), 'utf8')) as Annotation;
    docs.push(await measureDocument(name, text, ann, proposer));
  }
  const ajust = docs.filter((d) => d.set === 'ajust');
  const evalDocs = docs.filter((d) => d.set === 'eval');
  const report = {
    generatedBy: 'pnpm measure',
    mode: proposer ? 'regles_variantes_et_analyse_approfondie' : 'regles_variantes_seules',
    note:
      "Corpus fictif de très petite taille : aucun pourcentage n'est représentatif d'un usage réel. " +
      'Le gain de l\'analyse approfondie n\'est pas mesuré tant qu\'aucun modèle local n\'est choisi.',
    corpusDocuments: docs.length,
    sets: { ajust: aggregate(ajust), eval: aggregate(evalDocs) },
    all: aggregate(docs),
    perDocument: ajust.map((d) => ({
      document: d.document,
      characters: d.characters,
      directValues: d.directValues,
      directValuesLeft: d.directValuesLeft,
      falseAutomatic: d.falseAutomatic,
      conflicts: d.conflicts,
    })),
    llm: proposer
      ? docs.map((d) => ({ document: d.document, ...d.llm }))
      : null,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`Mode : ${report.mode}`);
  for (const [label, agg] of [
    ['Documents d\'ajustement', report.sets.ajust],
    ['Documents d\'évaluation', report.sets.eval],
  ] as const) {
    console.log(`\n${label} (${agg.documents} documents)`);
    console.log('Catégorie'.padEnd(16), 'direct'.padEnd(18), 'indirect');
    for (const [cat, row] of Object.entries(agg.table)) {
      console.log(cat.padEnd(16), pct(row.direct).padEnd(18), pct(row.indirect));
    }
    console.log('TOTAL'.padEnd(16), pct(agg.total.direct).padEnd(18), pct(agg.total.indirect));
    console.log(`Valeurs directes restées visibles : ${agg.directValuesLeft}/${agg.directValues}`);
    console.log(`Éléments protégés à tort, par document : ${agg.falseAutomaticPerDocument.toFixed(1)}`);
  }
  console.log(`\nRapport écrit : ${OUT}`);
}

main().catch((e: unknown) => {
  console.error('Échec de la mesure :', e instanceof Error ? e.name : 'erreur');
  process.exit(1);
});
