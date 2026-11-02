// Extraction PDF : texte des pages ayant une couche de texte.
// Aucune couche de texte : blocage (PDF scanné). Pages isolées sans texte : avertissement avec les numéros.

import { extractText, getDocumentProxy } from 'unpdf';
import type { FileWarning } from '../../shared/api.js';
import { ExtractError } from './types.js';
import type { Extracted } from './types.js';

export async function extractPdf(bytes: Uint8Array): Promise<Extracted> {
  let pages: string[];
  try {
    // pdf.js prend possession du tampon : on lui donne une copie.
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(doc, { mergePages: false });
    pages = result.text;
  } catch {
    throw new ExtractError('file_unreadable');
  }
  const clean = pages.map((p) => p.replace(/[ \t]+\n/g, '\n').trim());
  const withText = clean.filter((p) => p.length > 0);
  if (withText.length === 0) throw new ExtractError('file_scanned_pdf');
  const warnings: FileWarning[] = [];
  const empty = clean.map((p, i) => (p.length === 0 ? i + 1 : 0)).filter((n) => n > 0);
  if (empty.length > 0) warnings.push({ code: 'pdf_pages_without_text', pages: empty });
  return { text: withText.join('\n\n'), warnings };
}
