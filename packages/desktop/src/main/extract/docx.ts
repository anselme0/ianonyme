// Extraction `.docx` : corps, tableaux, en-têtes, pieds de page, notes de bas de page et de fin.
// Commentaires et révisions ne sont pas lus (avertissement). Les images sont ignorées (avertissement).
// Les propriétés du document (auteur, société…) ne sont jamais lues.

import { unzipSync } from 'fflate';
import type { FileWarning } from '../../shared/api.js';
import { ExtractError } from './types.js';
import type { Extracted } from './types.js';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Texte d'une partie du document, paragraphe par paragraphe, cellules séparées par « | ». */
export function xmlToText(xml: string): string {
  const out: string[] = [];
  let paragraph = '';
  let cellCount = 0;
  let rowParts: string[] = [];
  let inTable = 0;
  const token = /<(\/?)w:(p|tbl|tr|tc|t|tab|br|cr|delText|instrText|noBreakHyphen)\b([^>]*?)(\/?)>|([^<]+)/g;
  let inText = false;
  let skipText = false;
  for (const m of xml.matchAll(token)) {
    const [, close, tag, , selfClose, chars] = m;
    if (chars !== undefined) {
      if (inText && !skipText) paragraph += decodeEntities(chars);
      continue;
    }
    if (tag === 't') {
      inText = close !== '/' && selfClose !== '/';
      skipText = false;
    } else if (tag === 'delText' || tag === 'instrText') {
      inText = close !== '/' && selfClose !== '/';
      skipText = true;
    } else if (tag === 'tab' && close !== '/') paragraph += '\t';
    else if ((tag === 'br' || tag === 'cr') && close !== '/') paragraph += '\n';
    else if (tag === 'noBreakHyphen' && close !== '/') paragraph += '-';
    else if (tag === 'tbl') inTable += close === '/' ? -1 : 1;
    else if (tag === 'tr' && close !== '/') {
      rowParts = [];
      cellCount = 0;
    } else if (tag === 'tr' && close === '/') {
      if (rowParts.some((p) => p.trim().length > 0)) out.push(`| ${rowParts.join(' | ')} |`);
    } else if (tag === 'tc' && close !== '/') {
      paragraph = '';
      cellCount++;
    } else if (tag === 'tc' && close === '/') {
      rowParts.push(paragraph.replace(/\s*\n\s*/g, ' ').trim());
      paragraph = '';
    } else if (tag === 'p' && close === '/') {
      if (inTable > 0) {
        paragraph += cellCount > 0 && paragraph.length > 0 ? ' ' : '';
      } else {
        out.push(paragraph);
        paragraph = '';
      }
    } else if (tag === 'p' && close !== '/' && inTable === 0) {
      paragraph = '';
    }
  }
  return out.join('\n');
}

function countOf(xml: string, re: RegExp): number {
  return (xml.match(re) ?? []).length;
}

export function extractDocx(bytes: Uint8Array, maxBytes: number): Extracted {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Protège d'une archive piégée : on refuse toute entrée plus grosse que la limite de fichier.
      filter: (f) => f.originalSize <= Math.max(maxBytes, 1) * 4 && /^(word\/|\[Content_Types\])/.test(f.name),
    });
  } catch {
    throw new ExtractError('file_unreadable');
  }
  const decoder = new TextDecoder('utf-8');
  const read = (name: string): string => (files[name] ? decoder.decode(files[name]) : '');
  if (!files['word/document.xml']) throw new ExtractError('file_unreadable');

  const names = Object.keys(files);
  const headers = names.filter((n) => /^word\/header\d*\.xml$/.test(n)).sort();
  const footers = names.filter((n) => /^word\/footer\d*\.xml$/.test(n)).sort();
  const body = read('word/document.xml');

  const parts: string[] = [];
  for (const h of headers) parts.push(xmlToText(read(h)));
  parts.push(xmlToText(body));
  parts.push(xmlToText(read('word/footnotes.xml')));
  parts.push(xmlToText(read('word/endnotes.xml')));
  for (const f of footers) parts.push(xmlToText(read(f)));

  const warnings: FileWarning[] = [];
  const comments = read('word/comments.xml');
  if (comments && countOf(comments, /<w:comment\b/g) > 0) warnings.push({ code: 'docx_comments' });
  if (/<w:(ins|del)\b/.test(body)) warnings.push({ code: 'docx_revisions' });
  if (names.some((n) => n.startsWith('word/media/')) || /<w:drawing\b|<w:pict\b/.test(body)) {
    warnings.push({ code: 'docx_images' });
  }
  const text = parts
    .map((p) => p.replace(/\n{3,}/g, '\n\n').trim())
    .filter((p) => p.length > 0)
    .join('\n\n');
  return { text, warnings };
}
