import { Document, Footer, Header, Packer, Paragraph, Table, TableCell, TableRow, TextRun, FootnoteReferenceRun } from 'docx';
import { zipSync, strToU8 } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractFile, ExtractError, detectKind } from '../src/main/extract/index.js';
import { xmlToText } from '../src/main/extract/docx.js';

const MAX = 5 * 1024 * 1024;

async function realisticDocx(): Promise<Uint8Array> {
  const doc = new Document({
    footnotes: { 1: { children: [new Paragraph('Note de bas de page fictive.')] } },
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph('En-tête : Cabinet Exemple')] }) },
        footers: { default: new Footer({ children: [new Paragraph('Pied de page : Dossier fictif')] }) },
        children: [
          new Paragraph({ children: [new TextRun('Corps du rapport avec '), new TextRun({ text: 'du gras', bold: true }), new FootnoteReferenceRun(1)] }),
          new Table({
            rows: [
              new TableRow({ children: ['Nom', 'Rôle'].map((t) => new TableCell({ children: [new Paragraph(t)] })) }),
              new TableRow({ children: ['Mme Fictive', 'Experte'].map((t) => new TableCell({ children: [new Paragraph(t)] })) }),
            ],
          }),
          new Paragraph('Dernier paragraphe & fin.'),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

function handDocx(body: string, extra: Record<string, string> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(`<w:document><w:body>${body}</w:body></w:document>`),
  };
  for (const [name, content] of Object.entries(extra)) files[name] = strToU8(content);
  return zipSync(files);
}

async function pdf(pages: (string | null)[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage();
    if (text) page.drawText(text, { x: 50, y: 700, size: 12, font });
  }
  return doc.save();
}

describe('extraction .docx', () => {
  it('lit corps, tableau, en-tête, pied de page et notes', async () => {
    const { text, warnings } = await extractFile('rapport.docx', await realisticDocx(), MAX);
    expect(text).toContain('Corps du rapport avec du gras');
    expect(text).toContain('| Nom | Rôle |');
    expect(text).toContain('| Mme Fictive | Experte |');
    expect(text).toContain('En-tête : Cabinet Exemple');
    expect(text).toContain('Pied de page : Dossier fictif');
    expect(text).toContain('Note de bas de page fictive.');
    expect(text).toContain('Dernier paragraphe & fin.');
    expect(warnings).toEqual([]);
  });

  it('ne lit pas les propriétés du document', async () => {
    const bytes = handDocx('<w:p><w:r><w:t>Texte</w:t></w:r></w:p>', {
      'docProps/core.xml': '<dc:creator>Auteur Fictif</dc:creator>',
    });
    const { text } = await extractFile('a.docx', bytes, MAX);
    expect(text).toBe('Texte');
  });

  it('avertit pour commentaires, révisions et images, sans lire leur contenu', async () => {
    const body =
      '<w:p><w:r><w:t>Visible</w:t></w:r><w:del><w:r><w:delText>Supprimé secret</w:delText></w:r></w:del><w:ins><w:r><w:t>Inséré</w:t></w:r></w:ins></w:p>';
    const bytes = handDocx(body, {
      'word/comments.xml': '<w:comments><w:comment w:id="0"><w:p><w:r><w:t>Commentaire secret</w:t></w:r></w:p></w:comment></w:comments>',
      'word/media/image1.png': 'x',
    });
    const { text, warnings } = await extractFile('a.docx', bytes, MAX);
    expect(text).toContain('Visible');
    expect(text).not.toContain('Supprimé secret');
    expect(text).not.toContain('Commentaire secret');
    expect(warnings.map((w) => w.code).sort()).toEqual(['docx_comments', 'docx_images', 'docx_revisions']);
  });

  it('décode les entités et conserve tabulations et sauts de ligne', () => {
    expect(xmlToText('<w:p><w:r><w:t>A &amp; B &lt;</w:t><w:tab/><w:t>C</w:t><w:br/><w:t>D</w:t></w:r></w:p>')).toBe('A & B <\tC\nD');
  });

  it('refuse une archive illisible', async () => {
    await expect(extractFile('a.docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), MAX)).rejects.toMatchObject({ code: 'file_unreadable' });
  });
});

describe('extraction PDF', () => {
  it('lit le texte des pages', async () => {
    const { text, warnings } = await extractFile('a.pdf', await pdf(['Premiere page fictive', 'Deuxieme page fictive']), MAX);
    expect(text).toContain('Premiere page fictive');
    expect(text).toContain('Deuxieme page fictive');
    expect(warnings).toEqual([]);
  });

  it('avertit des pages sans texte, avec leurs numéros', async () => {
    const { text, warnings } = await extractFile('a.pdf', await pdf(['Page un', null, 'Page trois']), MAX);
    expect(text).toContain('Page trois');
    expect(warnings).toEqual([{ code: 'pdf_pages_without_text', pages: [2] }]);
  });

  it('recolle un mot coupé en fin de ligne', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage();
    page.drawText('Le signataire est M. Jean Gar-', { x: 50, y: 700, size: 12, font });
    page.drawText('nier, expert.', { x: 50, y: 686, size: 12, font });
    const { text } = await extractFile('a.pdf', await doc.save(), MAX);
    expect(text).toContain('Garnier');
  });

  it('bloque un PDF sans aucune couche de texte', async () => {
    await expect(extractFile('scan.pdf', await pdf([null, null]), MAX)).rejects.toMatchObject({ code: 'file_scanned_pdf' });
  });

  it('refuse un PDF corrompu', async () => {
    await expect(extractFile('a.pdf', new TextEncoder().encode('%PDF-1.4 nimportequoi'), MAX)).rejects.toMatchObject({ code: 'file_unreadable' });
  });
});

describe('extraction .txt et refus', () => {
  it('lit UTF-8 avec ou sans BOM, et UTF-16', async () => {
    const enc = new TextEncoder();
    expect((await extractFile('a.txt', enc.encode('Élodie\r\nfictive'), MAX)).text).toBe('Élodie\nfictive');
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode('Avec BOM')]);
    expect((await extractFile('a.txt', bom, MAX)).text).toBe('Avec BOM');
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'Texte'].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect((await extractFile('a.txt', utf16, MAX)).text).toBe('Texte');
  });

  it('refuse un encodage non reconnu', async () => {
    await expect(extractFile('a.txt', new Uint8Array([0x41, 0xe9, 0x42]), MAX)).rejects.toMatchObject({ code: 'file_encoding' });
  });

  it('refuse les images, même renommées', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    for (const name of ['a.png', 'a.txt', 'a.pdf']) {
      await expect(extractFile(name, png, MAX)).rejects.toMatchObject({ code: 'file_image' });
    }
    expect(detectKind('a.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image');
  });

  it('refuse un fichier trop volumineux ou d\'un format inconnu', async () => {
    await expect(extractFile('a.txt', new Uint8Array(20), 10)).rejects.toMatchObject({ code: 'file_too_large' });
    await expect(extractFile('a.xlsx', new TextEncoder().encode('abc'), MAX)).rejects.toBeInstanceOf(ExtractError);
  });
});
