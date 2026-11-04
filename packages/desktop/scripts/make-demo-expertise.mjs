// Génère le dossier d'expertise fictif du parcours de démonstration (demo/expertise-affaire-brunet.docx).
// Document court (environ une page et demie) mais mis en page comme un vrai rapport : en-tête, pied de page
// numéroté, bloc de titre, tableau, note de bas de page, signature. Tout est inventé : personnes, société,
// communes, numéros. Téléphones dans les plages réservées à la fiction ; IBAN et SIREN repris d'exemples publics.
// Les cas difficiles de la démonstration (désignations indirectes, nom de famille partagé, lien de parenté)
// sont décrits dans docs/DEMO_SCRIPT.md. Les dates sont cohérentes : désordres, réclamation, ordonnance, réunions.
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

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: 21, ...o });
const para = (parts, o = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 100, line: 264 },
    ...o,
    children: (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? run(p) : p)),
  });
const heading = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    keepNext: true,
    children: [run(text, { bold: true, size: 24, color: NAVY })],
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
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
                shading:
                  i === 0
                    ? { type: ShadingType.CLEAR, color: 'auto', fill: NAVY }
                    : i % 2 === 0
                      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F5F8' }
                      : undefined,
                children: [
                  new Paragraph({
                    children: [run(c, { size: 19, bold: i === 0, color: i === 0 ? 'FFFFFF' : undefined })],
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
  ['Mme Isabelle Brunet', 'demanderesse, propriétaire', '06 39 98 20 15'],
  ['M. Patrick Brunet', 'demandeur, propriétaire', '06 39 98 20 16'],
  ['M. Étienne Vasseur', 'gérant de la société BÂTIRAVEL SAS', '06 39 98 21 40'],
  ['M. Marc Delorme', 'sous-traitant (enduits)', '06 39 98 21 77'],
  ['M. Jean Garnier', 'maire de Valmont-sur-Aure', '01 99 00 12 08'],
];

const body = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [run('Tribunal judiciaire - Juge des référés', { bold: true, size: 19, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [run('RAPPORT D’EXPERTISE JUDICIAIRE', { bold: true, size: 36, color: NAVY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 6 } },
    children: [run('Affaire Brunet c/ BÂTIRAVEL SAS', { size: 26, color: GREY })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 160 },
    children: [run('Dossier n° RG 26/00417 - Référence d’expertise : EXP-2026-0114', { size: 19 })],
  }),

  heading('1. Mission'),
  para(
    'Je soussignée, Sylvie Maurel, expert près la cour d’appel de Grenoble, domiciliée 12 rue des Tilleuls, 38000 Grenoble, joignable au 01 99 00 41 17 ou à l’adresse s.maurel@maurel-expertises.example, ai été désignée par ordonnance du 3 février 2026 afin d’examiner les désordres d’humidité et de fissuration affectant l’extension de la maison des époux Brunet, 4 chemin des Vignes, 26400 Valmont-sur-Aure, construite par la société BÂTIRAVEL SAS (SIREN 732 829 320).',
  ),

  heading('2. Participants'),
  table(parties, [32, 40, 28]),

  heading('3. Opérations d’expertise'),
  para(
    'La première réunion s’est tenue sur place le 2 mars 2026, en présence de Mme Isabelle Brunet et de M. Patrick Brunet, de M. Étienne Vasseur, gérant, et de M. Jean Garnier, maire de Valmont-sur-Aure, commune où le permis de construire a été délivré le 5 avril 2024. Le devis de 64 200 euros avait été accepté le 12 juin 2024 et les travaux réceptionnés le 15 novembre 2024.',
  ),
  para(
    'Lors de la seconde réunion, le 30 mars 2026, le premier magistrat de la commune a confirmé qu’aucune réserve n’avait été formulée. L’édile a ajouté que les services municipaux n’avaient jamais été alertés avant la réclamation adressée par courrier recommandé le 8 janvier 2026.',
  ),

  heading('4. Constats'),
  para(
    'Mme Brunet, née le 14 mars 1981, déclare que les premières traces d’humidité sont apparues le 6 décembre 2025, et M. Brunet a constaté des fissures en façade nord le 20 décembre 2025. Le gérant a répondu par courriel (e.vasseur@batiravel.example) que les enduits avaient été posés conformément au devis par son beau-frère, M. Marc Delorme, sous-traitant de la société. L’architecte, M. Paul-Henri Delmas, indique avoir émis des réserves écrites le jour de la réception.',
  ),
  new Paragraph({
    spacing: { after: 100 },
    children: [run('Les relevés d’hygrométrie du 30 mars 2026 figurent en annexe.'), new FootnoteReferenceRun(1)],
  }),

  heading('5. Conclusions'),
  para(
    'Les désordres relèvent de l’absence de drainage périphérique et d’un défaut d’exécution des enduits. Le solde de 12 840 euros reste à régler sur le compte de la société : IBAN FR76 3000 6000 0112 3456 7890 189. La remise en état est estimée à 18 500 euros hors taxes. Il appartiendra au juge de répartir les responsabilités.',
  ),
  new Paragraph({
    spacing: { before: 200, after: 0 },
    children: [run('Fait à Grenoble, le 27 avril 2026.   '), run('Sylvie Maurel', { bold: true })],
  }),
];

const doc = new Document({
  title: 'Rapport d’expertise fictif',
  creator: 'Document fictif',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  footnotes: {
    1: { children: [new Paragraph({ children: [run('Les photographies citées sont conservées dans le dossier de l’expert et ne sont pas reproduites ici.', { size: 17 })] })] },
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1100, left: 1300, right: 1300 } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B8C2CC', space: 4 } },
              children: [run('Cabinet Maurel Expertises - Dossier RG 26/00417 - Confidentiel', { size: 17, color: GREY })],
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
                run('12 rue des Tilleuls, 38000 Grenoble - page ', { size: 17, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 17, color: GREY }),
                run(' sur ', { size: 17, color: GREY }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 17, color: GREY }),
              ],
            }),
          ],
        }),
      },
      children: body,
    },
  ],
});

writeFileSync(resolve(out, 'expertise-affaire-brunet.docx'), await Packer.toBuffer(doc));
console.log('demo/expertise-affaire-brunet.docx écrit');
