// Génère le dossier d'expertise fictif du parcours de démonstration (demo/expertise-affaire-moreau.docx).
// Document mis en page comme un vrai rapport : en-tête, pied de page numéroté, bloc de titre, tableaux,
// liste, note de bas de page, signature. Tout est inventé : personnes, société, communes, numéros.
// Numéros de téléphone dans les plages réservées à la fiction ; IBAN et SIREN repris d'exemples publics.
// Les cas difficiles de la démonstration (désignations indirectes, nom de famille partagé, lien de parenté,
// prédécesseur distinct du maire) sont décrits dans docs/DEMO_SCRIPT.md.
// Usage : node scripts/make-demo-expertise.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const out = resolve(import.meta.dirname, '../../../demo');
mkdirSync(out, { recursive: true });

const FONT = 'Calibri';
const NAVY = '1F3A5F';
const GREY = '5B6770';

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: 22, ...o });
const para = (parts, o = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 140, line: 300 },
    ...o,
    children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? run(p) : p)),
  });
const heading = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    keepNext: true,
    children: [run(text, { bold: true, size: 26, color: NAVY })],
  });

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'B8C2CC' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function table(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (r, i) =>
        new TableRow({
          tableHeader: i === 0,
          children: r.map(
            (c, k) =>
              new TableCell({
                borders,
                width: { size: widths[k], type: WidthType.PERCENTAGE },
                margins: { top: 70, bottom: 70, left: 110, right: 110 },
                shading:
                  i === 0
                    ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY }
                    : i % 2 === 0
                      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F5F8' }
                      : undefined,
                children: [
                  new Paragraph({
                    children: [run(c, { size: 20, bold: i === 0, color: i === 0 ? 'FFFFFF' : undefined })],
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

const parties = [
  ['Participant', 'Qualité', 'Contact'],
  ['Mme Isabelle Moreau', 'demanderesse, propriétaire', '06 39 98 20 15'],
  ['M. Patrick Moreau', 'demandeur, propriétaire', '06 39 98 20 16'],
  ['Me Claire Perrin', 'avocate de la famille', 'claire.perrin@perrin-avocats.example'],
  ['M. Étienne Vasseur', 'gérant de la société BÂTIRAVEL SAS', '06 39 98 21 40'],
  ['M. Marc Delorme', 'sous-traitant (enduits)', '06 39 98 21 77'],
  ['M. Jean Garnier', 'maire de Valmont-sur-Aure', '01 99 00 12 08'],
  ['M. Paul-Henri Delmas', 'architecte de l’opération', 'ph.delmas@delmas-archi.example'],
];

const chrono = [
  ['Date', 'Événement'],
  ['5 avril 2024', 'Délivrance du permis de construire de l’extension, signé par M. Bernard Rousseau.'],
  ['12 juin 2024', 'Acceptation du devis de BÂTIRAVEL SAS : 64 200 euros.'],
  ['15 novembre 2024', 'Réception des travaux, sans réserve de la part des propriétaires.'],
  ['6 décembre 2025', 'Premières traces d’humidité dans la chambre de l’étage.'],
  ['20 décembre 2025', 'Fissures constatées en façade nord.'],
  ['8 janvier 2026', 'Réclamation adressée à la société par courrier recommandé.'],
  ['12 janvier 2026', 'Première réunion d’expertise sur place.'],
  ['9 février 2026', 'Seconde réunion d’expertise.'],
];

const body = [
  // Bloc de titre
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [run('Tribunal judiciaire - Juge des référés', { bold: true, size: 20, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 80 },
    children: [run('RAPPORT D’EXPERTISE JUDICIAIRE', { bold: true, size: 40, color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
    children: [run('Affaire Moreau c/ BÂTIRAVEL SAS', { size: 28, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 40 },
    children: [run('Dossier n° RG 26/00417 - Référence d’expertise : EXP-2026-0114', { size: 20 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      run('Objet : désordres affectant l’extension d’une maison d’habitation, 4 chemin des Vignes, 26400 Valmont-sur-Aure.', {
        size: 20,
        italics: true,
      }),
    ],
  }),

  heading('1. Désignation et mission'),
  para(
    'Je soussignée, Sylvie Maurel, expert près la cour d’appel de Grenoble, domiciliée 12 rue des Tilleuls, 38000 Grenoble, joignable au 01 99 00 41 17 ou à l’adresse s.maurel@maurel-expertises.example, ai été désignée par ordonnance du 18 novembre 2025 afin d’examiner les désordres d’humidité et de fissuration apparus dans l’extension de la maison des époux Moreau, construite par la société BÂTIRAVEL SAS (SIREN 732 829 320).',
  ),
  para('Les pièces suivantes m’ont été remises et ont été examinées :'),
  ...['le permis de construire et le dossier de la commune ;', 'le devis et les factures de la société ;', 'les courriers échangés entre les parties ;', 'les relevés d’hygrométrie réalisés pendant les opérations.'].map(
    (t) =>
      new Paragraph({
        numbering: { reference: 'puces', level: 0 },
        spacing: { after: 60 },
        children: [run(t)],
      }),
  ),

  heading('2. Participants'),
  table(parties, [30, 38, 32]),

  heading('3. Déroulement des opérations'),
  para(
    'La première réunion s’est tenue sur place le 12 janvier 2026, en présence de Mme Isabelle Moreau et de M. Patrick Moreau, assistés de Me Claire Perrin. La société BÂTIRAVEL SAS était représentée par M. Étienne Vasseur, gérant. M. Jean Garnier, maire de Valmont-sur-Aure, commune où le permis de construire a été délivré, avait souhaité y assister.',
  ),
  para(
    'Une seconde réunion a eu lieu le 9 février 2026. Le premier magistrat de la commune a rappelé que le permis avait été accordé le 5 avril 2024 sous la mandature de son prédécesseur, et que la commune n’avait formulé aucune réserve. L’édile a ajouté que les services municipaux n’avaient jamais été informés de problèmes d’écoulement des eaux avant la réclamation des propriétaires.',
  ),

  heading('4. Constats'),
  para(
    'Mme Moreau, née le 14 mars 1981, déclare que les premières traces d’humidité sont apparues le 6 décembre 2025 dans la chambre de l’étage. M. Moreau a constaté des fissures en façade nord le 20 décembre 2025. Les époux ont adressé leur réclamation par courrier recommandé le 8 janvier 2026.',
  ),
  para(
    'Le gérant de la société a répondu par courriel (e.vasseur@batiravel.example) que les enduits avaient été posés conformément au devis. Il a précisé que ces travaux avaient été réalisés par son beau-frère, M. Marc Delorme, sous-traitant de la société, qui n’aurait reçu aucune consigne de drainage. Cette affirmation n’a pas été confirmée par l’architecte, qui indique avoir émis des réserves écrites le jour de la réception.',
  ),
  new Paragraph({
    spacing: { after: 140 },
    children: [run('Les relevés complets sont consignés dans l’annexe technique.'), new FootnoteReferenceRun(1)],
  }),
  para(
    'Dans l’affaire Moreau, la question centrale posée à l’expert est celle de l’origine des désordres : défaut de conception, défaut d’exécution, ou les deux. Les propriétaires demandent la reprise des enduits et la création d’un drainage périphérique.',
  ),

  heading('5. Chronologie'),
  table(chrono, [26, 74]),

  heading('6. Analyse et chiffrage'),
  para(
    'Les mesures d’hygrométrie réalisées le 9 février 2026 montrent une humidité anormale en pied de mur nord. L’absence de drainage périphérique, relevée dès la première réunion, explique l’essentiel des désordres. Les fissures observées en façade sont cohérentes avec un défaut de reprise des charges au droit de l’extension.',
  ),
  para(
    'Le devis accepté s’élevait à 64 200 euros. Le solde de 12 840 euros reste à régler et doit être versé sur le compte de la société : IBAN FR76 3000 6000 0112 3456 7890 189. La remise en état est estimée à 18 500 euros hors taxes.',
  ),

  heading('7. Conclusions'),
  para(
    'Les désordres relèvent d’un défaut d’exécution du drainage et des enduits. Les déclarations de M. Vasseur sur la responsabilité de son sous-traitant devront être rapprochées de celles de M. Delmas, qui affirme avoir alerté la société par écrit. Il appartiendra au juge de répartir les responsabilités.',
  ),
  new Paragraph({
    spacing: { before: 360, after: 0 },
    children: [run('Fait à Grenoble, le 27 février 2026.')],
  }),
  new Paragraph({
    spacing: { before: 480, after: 0 },
    children: [run('Sylvie Maurel', { bold: true })],
  }),
  new Paragraph({ children: [run('Expert près la cour d’appel de Grenoble', { color: GREY, size: 20 })] }),
];

const doc = new Document({
  title: 'Rapport d’expertise fictif',
  creator: 'Document fictif',
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  numbering: {
    config: [
      {
        reference: 'puces',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }],
      },
    ],
  },
  footnotes: {
    1: { children: [new Paragraph({ children: [run('Les photographies citées sont conservées dans le dossier de l’expert et ne sont pas reproduites ici.', { size: 18 })] })] },
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1300, left: 1300, right: 1300 } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B8C2CC', space: 4 } },
              children: [run('Cabinet Maurel Expertises - Dossier RG 26/00417 - Confidentiel', { size: 18, color: GREY })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                run('12 rue des Tilleuls, 38000 Grenoble - page ', { size: 18, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: GREY }),
                run(' sur ', { size: 18, color: GREY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: GREY }),
              ],
            }),
          ],
        }),
      },
      children: body,
    },
  ],
});

writeFileSync(resolve(out, 'expertise-affaire-moreau.docx'), await Packer.toBuffer(doc));
console.log('demo/expertise-affaire-moreau.docx écrit');
