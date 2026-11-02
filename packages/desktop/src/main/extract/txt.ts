import { ExtractError } from './types.js';
import type { Extracted } from './types.js';

/** Texte brut : UTF-8 (BOM détecté) ou UTF-16 avec BOM. Tout autre encodage est refusé. */
export function extractTxt(bytes: Uint8Array): Extracted {
  let view = bytes;
  let label: 'utf-8' | 'utf-16le' | 'utf-16be' = 'utf-8';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) view = bytes.subarray(3);
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    label = 'utf-16le';
    view = bytes.subarray(2);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    label = 'utf-16be';
    view = bytes.subarray(2);
  }
  let text: string;
  try {
    text = new TextDecoder(label, { fatal: true }).decode(view);
  } catch {
    throw new ExtractError('file_encoding');
  }
  if (text.includes('\u0000')) throw new ExtractError('file_unsupported');
  return { text: text.replace(/\r\n?/g, '\n'), warnings: [] };
}
