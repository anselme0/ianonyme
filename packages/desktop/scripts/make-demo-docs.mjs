// Génère le rapport d'expertise fictif de la démonstration, en .docx et en PDF (dossier demo/).
// Tout est inventé : personnes, société, commune, numéros. Les numéros de téléphone sont dans les plages
// réservées à la fiction ; l'IBAN et le SIREN sont des exemples de la documentation publique.
// Usage : node scripts/make-demo-docs.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Document,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const out = resolve(import.meta.dirname, '../../../demo');
mkdirSync(out, { recursive: true });

const HEADER = 'Cabinet Barraud Expertises - Rapport d’expertise judiciaire';
const FOOTER = 'Cabinet Barraud Expertises - 7 allée des Mûriers, 38000 Grenoble';
const FOOTNOTE = 'Les photographies citées sont conservées dans le dossier de l’expert et ne sont pas reproduites ici.';

/** Blocs communs : [type, contenu]. */
const blocks = [
  ['title', 'RAPPORT D’EXPERTISE JUDICIAIRE'],
  ['p', 'Dossier n° RG 25/00873 - Référence d’expertise : EXP-2025-0231'],
  ['p', 'Objet : désordres affectant l’école communale de la commune de Saint-Aubrac.'],
  ['h', '1. Désignation et mission'],
  [
    'p',
    'Je soussignée, Hélène Barraud, expert près la cour d’appel de Grenoble, domiciliée 7 allée des Mûriers, 38000 Grenoble, joignable au 01 99 00 67 45 ou à l’adresse h.barraud@expertises-barraud.example, ai été désignée par ordonnance du 21 novembre 2024 pour examiner les désordres d’humidité et de fissuration apparus dans l’école communale.',
  ],
  ['h', '2. Opérations d’expertise'],
  [
    'p',
    'La première réunion s’est tenue sur place le 14 janvier 2025, en présence de M. Louis Cordier, maire de Saint-Aubrac, assisté de Me Claire Perrin, avocate de la commune. La société BÂTIRAVEL SAS, entreprise chargée des travaux, était représentée par M. Étienne Vasseur, gérant. M. Paul-Henri Delmas, architecte de l’opération, a également été entendu.',
  ],
  [
    'p',
    'Une seconde réunion a eu lieu le 3 février 2025. Le maire de la commune a indiqué que les travaux avaient été commandés le 12 mars 2024 et que la réception avait été prononcée le 18 octobre 2024. Le gérant de la société a contesté cette chronologie et soutenu que la commande datait du 2 avril 2024.',
  ],
  ['table', null],
  ['h', '3. Constats'],
  [
    'p',
    'Les premiers désordres sont apparus le 6 décembre 2024, selon les déclarations de Mme Odile Marchand, adjointe au maire. Mme Marchand précise que la directrice de l’école a signalé des traces d’humidité dans la classe du premier étage. Le gérant de la société a répondu par courriel (e.vasseur@batiravel.example) que les enduits avaient été posés conformément au devis.',
  ],
  [
    'p',
    'M. Vasseur a ajouté que son beau-frère, qui a réalisé les enduits, n’avait été informé d’aucune réserve à la réception. Cette affirmation n’a pas été confirmée par M. Delmas, qui indique avoir émis des réserves écrites le jour de la réception.',
  ],
  ['fn', null],
  ['h', '4. Analyse'],
  [
    'p',
    'Les mesures d’hygrométrie réalisées le 20 février 2025 montrent une humidité anormale en pied de mur nord. L’absence de drainage périphérique, relevée dès le 14 janvier 2025, explique l’essentiel des désordres. Les fissures observées en façade sont postérieures à la réception.',
  ],
  [
    'p',
    'La société BÂTIRAVEL SAS (SIREN 732 829 320) a remis un devis d’un montant de 48 600 euros. Le règlement du solde est attendu sur le compte indiqué par la commune : IBAN FR76 3000 6000 0112 3456 7890 189.',
  ],
  ['h', '5. Conclusions'],
  [
    'p',
    'Les désordres relèvent d’un défaut d’exécution du drainage et des enduits. Les contradictions entre les déclarations de M. Cordier et de M. Vasseur sur la date de commande devront être tranchées par le juge. Fait à Grenoble, le 28 février 2025. H. Barraud',
  ],
];

const tableRows = [
  ['Participant', 'Qualité', 'Contact'],
  ['M. Louis Cordier', 'maire de la commune', '01 99 00 12 08'],
  ['M. Étienne Vasseur', 'gérant de la société', '06 39 98 21 40'],
  ['Mme Odile Marchand', 'adjointe au maire', 'o.marchand@saint-aubrac.example'],
];

async function makeDocx() {
  const children = [];
  for (const [type, text] of blocks) {
    if (type === 'title') children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(text)] }));
    else if (type === 'h') children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }));
    else if (type === 'p') children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun(text)] }));
    else if (type === 'fn') children.push(new Paragraph({ children: [new TextRun('Voir la note de bas de page.'), new FootnoteReferenceRun(1)] }));
    else if (type === 'table') {
      children.push(
        new Table({
          rows: tableRows.map(
            (r) => new TableRow({ children: r.map((c) => new TableCell({ children: [new Paragraph(c)] })) }),
          ),
        }),
      );
    }
  }
  const doc = new Document({
    title: 'Rapport fictif',
    creator: 'Document fictif',
    footnotes: { 1: { children: [new Paragraph(FOOTNOTE)] } },
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph(HEADER)] }) },
        footers: { default: new Footer({ children: [new Paragraph(FOOTER)] }) },
        children,
      },
    ],
  });
  writeFileSync(resolve(out, 'rapport-expertise-fictif.docx'), await Packer.toBuffer(doc));
}

function wrap(text, font, size, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function makePdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Rapport fictif');
  pdf.setAuthor('Document fictif');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 56;
  let page;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawText(HEADER, { x: M, y: H - 30, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(FOOTER, { x: M, y: 28, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y = H - 70;
  };
  newPage();
  const put = (text, f, size, gap) => {
    for (const line of wrap(text, f, size, W - 2 * M)) {
      if (y < 60) newPage();
      page.drawText(line, { x: M, y, size, font: f });
      y -= size * 1.45;
    }
    y -= gap;
  };
  for (const [type, text] of blocks) {
    if (type === 'title') put(text, bold, 16, 10);
    else if (type === 'h') put(text, bold, 12, 4);
    else if (type === 'p') put(text, font, 11, 6);
    else if (type === 'fn') put(`Voir la note : ${FOOTNOTE}`, font, 9, 6);
    else if (type === 'table') for (const r of tableRows) put(r.join('  |  '), font, 10, 0);
  }
  writeFileSync(resolve(out, 'rapport-expertise-fictif.pdf'), await pdf.save());
}

await makeDocx();
await makePdf();
console.log('documents de démonstration écrits dans demo/');
