// Extraction du texte des fichiers importés (docs/DOCUMENTATION.md, §6).
// Seul le texte extrait est analysé, masqué et envoyé. Les métadonnées et les images ne partent jamais.
// Les fichiers ne sont pas copiés sur le disque : tout reste en mémoire.

import { extractDocx } from './docx.js';
import { extractPdf } from './pdf.js';
import { extractTxt } from './txt.js';
import { ExtractError } from './types.js';
import type { Extracted } from './types.js';

export { ExtractError } from './types.js';
export type { Extracted } from './types.js';

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

export type Detected = 'pdf' | 'docx' | 'image' | 'txt' | 'unsupported';

/** Type réel d'après le contenu, pas d'après l'extension. */
export function detectKind(name: string, bytes: Uint8Array): Detected {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    startsWith(bytes, [0xff, 0xd8, 0xff]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    startsWith(bytes, [0x42, 0x4d]) ||
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]) ||
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45)
  ) {
    return 'image';
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return /\.docx$/i.test(name) ? 'docx' : 'unsupported';
  }
  if (/\.(txt|text|md)$/i.test(name) || !/\.[a-z0-9]{1,5}$/i.test(name)) return 'txt';
  return 'unsupported';
}

export async function extractFile(name: string, bytes: Uint8Array, maxBytes: number): Promise<Extracted> {
  if (bytes.byteLength === 0) throw new ExtractError('file_unreadable');
  if (bytes.byteLength > maxBytes) throw new ExtractError('file_too_large');
  switch (detectKind(name, bytes)) {
    case 'pdf':
      return extractPdf(bytes);
    case 'docx':
      return extractDocx(bytes, maxBytes);
    case 'image':
      throw new ExtractError('file_image');
    case 'txt':
      return extractTxt(bytes);
    default:
      throw new ExtractError('file_unsupported');
  }
}
