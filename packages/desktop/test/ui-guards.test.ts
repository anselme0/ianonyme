// Garde-fous de l'interface : vocabulaire (docs/UI_UX.md, §6.1), source unique des textes, contrastes (§2.2, §12).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_WORDS, t } from '../src/renderer/messages.js';

const RENDERER = resolve(import.meta.dirname, '../src/renderer');

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    for (const sample of [[0], [1], [2], ['Nom'], [{ code: 'docx_comments' }], [{ code: 'pdf_pages_without_text', pages: [1, 2] }], ['file_scanned_pdf']]) {
      try {
        const r = (value as (...a: unknown[]) => unknown)(...sample);
        if (typeof r === 'string') out.push(r);
      } catch {
        /* échantillon non adapté */
      }
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

function files(dir: string, ext: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) files(p, ext, acc);
    else if (p.endsWith(ext)) acc.push(p);
  }
  return acc;
}

describe('vocabulaire', () => {
  const all = collectStrings(t);

  it('le fichier de messages contient des textes', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN_WORDS)('n’affiche jamais « %s »', (word) => {
    const re = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu');
    for (const s of all) expect(s, s).not.toMatch(re);
  });

  it('ne promet ni conformité ni anonymat', () => {
    for (const s of all) {
      expect(s.replaceAll('IAnonyme', ''), s).not.toMatch(/RGPD|conforme|garanti|secret professionnel|anonymes?\b/i);
    }
  });
});

describe('source unique des textes', () => {
  it('aucun texte écrit en dur dans les composants', () => {
    const offenders: string[] = [];
    for (const file of files(RENDERER, '.tsx')) {
      const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node): void => {
        if (ts.isJsxText(node) && /[\p{L}]{2,}/u.test(node.text)) {
          offenders.push(`${file}: ${node.text.trim().slice(0, 40)}`);
        }
        if (
          ts.isJsxAttribute(node) &&
          ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.getText()) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /[\p{L}]{2,}/u.test(node.initializer.text)
        ) {
          offenders.push(`${file}: ${node.name.getText()}="${node.initializer.text}"`);
        }
        ts.forEachChild(node, visit);
      };
      visit(src);
    }
    expect(offenders).toEqual([]);
  });
});

// ---- Contrastes ----

function parseTokens(css: string, selector: RegExp): Record<string, string> {
  const block = selector.exec(css)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1] as string] = m[2] as string;
  return out;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrastes des jetons (AA : 4,5 minimum)', () => {
  const css = readFileSync(join(RENDERER, 'styles/tokens.css'), 'utf8');
  const themes: [string, Record<string, string>][] = [
    ['clair', parseTokens(css, /:root\s*\{([^}]*)\}/)],
    ['sombre', parseTokens(css, /:root\[data-theme='dark'\]\s*\{([^}]*)\}/)],
  ];
  const pairs: [string, string][] = [
    ['text', 'bg'],
    ['text', 'panel'],
    ['text', 'surface'],
    ['text-2', 'bg'],
    ['text-2', 'panel'],
    ['text-2', 'surface'],
    ['on-accent', 'accent'],
    ['accent-text', 'accent-soft'],
    ['accent-text', 'bg'],
    ['amber-fg', 'amber-bg'],
    ['red-fg', 'red-bg'],
    ['fam-personnes-fg', 'fam-personnes-bg'],
    ['fam-organisations-fg', 'fam-organisations-bg'],
    ['fam-lieux-fg', 'fam-lieux-bg'],
    ['fam-coordonnees-fg', 'fam-coordonnees-bg'],
    ['fam-numeros-fg', 'fam-numeros-bg'],
    ['text', 'fam-personnes-bg'],
  ];

  for (const [name, tokens] of themes) {
    it(`thème ${name} : toutes les valeurs sont définies`, () => {
      for (const [a, b] of pairs) {
        expect(tokens[a], a).toBeDefined();
        expect(tokens[b], b).toBeDefined();
      }
    });
    it.each(pairs)(`thème ${name} : %s sur %s`, (a, b) => {
      expect(ratio(tokens[a] as string, tokens[b] as string)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('les vingt couleurs de surlignage restent lisibles sur le fond de l’application', () => {
    // Le surlignage porte son propre fond : on vérifie aussi qu'il se distingue du fond de page (3:1 non requis, 1,1 minimum).
    for (const [, tokens] of themes) {
      for (const f of ['personnes', 'organisations', 'lieux', 'coordonnees', 'numeros']) {
        expect(ratio(tokens[`fam-${f}-bg`] as string, tokens['bg'] as string)).toBeGreaterThan(1.05);
      }
    }
  });
});
