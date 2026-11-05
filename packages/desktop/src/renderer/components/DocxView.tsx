import { renderAsync } from 'docx-preview';
import { useEffect, useRef, useState } from 'react';
import { findOccurrences, makeHaystack } from 'engine';
import type { FamilyId } from '../families.js';
import type { MarkKind } from '../marks.js';

/** Une valeur à surligner dans le document, quelle que soit la façon dont Word a découpé le texte. */
export interface DocxTerm {
  id: string;
  text: string;
  family: FamilyId;
  kind: MarkKind;
  /** Repère affiché à la place de la valeur dans la vue « ce que l'IA va recevoir ». */
  label?: string;
}

interface Props {
  buffer: ArrayBuffer;
  terms: DocxTerm[];
  sent: boolean;
  selectedId: string | null;
  removeLabel: string;
  onMarkClick(id: string): void;
  onRemove(id: string): void;
  onSelectText(text: string, x: number, y: number): void;
}

const CROSS =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** Retire les surlignages posés par `highlight` et rétablit le texte d'origine. */
function clear(root: HTMLElement): void {
  for (const mark of [...root.querySelectorAll<HTMLElement>('mark.dx-mark')]) {
    mark.replaceWith(document.createTextNode(mark.dataset.original ?? ''));
  }
  root.normalize();
}

interface Piece {
  node: Text;
  start: number;
  end: number;
}

/** Surligne chaque valeur dans les paragraphes : le texte d'un paragraphe est recollé avant la recherche. */
function highlight(root: HTMLElement, terms: DocxTerm[], sent: boolean, removeLabel: string, handlers: { onMarkClick(id: string): void; onRemove(id: string): void }): void {
  const ordered = [...terms].sort((a, b) => b.text.length - a.text.length);
  for (const block of root.querySelectorAll('p')) {
    const pieces: Piece[] = [];
    let full = '';
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n as Text;
      pieces.push({ node: text, start: full.length, end: full.length + text.data.length });
      full += text.data;
    }
    if (full.length === 0) continue;
    const hay = makeHaystack(full);
    const taken: { start: number; end: number; term: DocxTerm }[] = [];
    for (const term of ordered) {
      for (const occ of findOccurrences(hay, term.text)) {
        if (!taken.some((t) => occ.start < t.end && t.start < occ.end)) taken.push({ ...occ, term });
      }
    }
    // De la fin vers le début : couper un nœud ne décale pas les positions restantes.
    taken.sort((a, b) => b.start - a.start);
    for (const occ of taken) {
      const segments = pieces.filter((p) => p.start < occ.end && occ.start < p.end);
      segments.reverse().forEach((p, i, all) => {
        const first = i === all.length - 1;
        const range = document.createRange();
        range.setStart(p.node, Math.max(0, occ.start - p.start));
        range.setEnd(p.node, Math.min(p.node.data.length, occ.end - p.start));
        const original = range.toString();
        const mark = document.createElement('mark');
        mark.className = `dx-mark mark fam-${occ.term.family} mark-${occ.term.kind}`;
        mark.dataset.markId = occ.term.id;
        mark.dataset.original = original;
        mark.textContent = original;
        range.deleteContents();
        range.insertNode(mark);
        if (sent && occ.term.label) {
          mark.classList.add('mark-sent');
          mark.textContent = first ? occ.term.label : '';
          if (first) mark.title = original;
        }
        mark.addEventListener('click', () => handlers.onMarkClick(occ.term.id));
        if (first && !sent && occ.term.kind === 'protected') {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mark-x';
          button.contentEditable = 'false';
          button.title = removeLabel;
          button.setAttribute('aria-label', removeLabel);
          button.dataset.testid = 'mark-unprotect';
          button.innerHTML = CROSS;
          button.addEventListener('mousedown', (e) => e.preventDefault());
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            handlers.onRemove(occ.term.id);
          });
          mark.append(button);
        }
      });
    }
  }
}

/** Document Word affiché comme dans Word (pages, mise en forme, tableaux), avec les informations surlignées. */
export function DocxView(p: Props) {
  const body = useRef<HTMLDivElement>(null);
  const style = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(0);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    let cancelled = false;
    if (!body.current || !style.current) return;
    body.current.innerHTML = '';
    void renderAsync(p.buffer.slice(0), body.current, style.current, {
      className: 'docx',
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      useBase64URL: true,
    }).then(() => {
      if (!cancelled) setRendered((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [p.buffer]);

  useEffect(() => {
    const root = body.current;
    if (!root || rendered === 0) return;
    clear(root);
    highlight(root, p.terms, p.sent, p.removeLabel, {
      onMarkClick: (id) => latest.current.onMarkClick(id),
      onRemove: (id) => latest.current.onRemove(id),
    });
  }, [rendered, p.terms, p.sent, p.removeLabel]);

  useEffect(() => {
    const root = body.current;
    if (!root) return;
    for (const m of root.querySelectorAll('.mark-selected')) m.classList.remove('mark-selected');
    if (!p.selectedId) return;
    const hits = root.querySelectorAll<HTMLElement>(`[data-mark-id="${CSS.escape(p.selectedId)}"]`);
    for (const h of hits) h.classList.add('mark-selected');
    hits[0]?.scrollIntoView?.({ block: 'center' });
  }, [p.selectedId, rendered, p.terms, p.sent]);

  const onMouseUp = (): void => {
    const sel = window.getSelection();
    const value = sel?.toString().trim() ?? '';
    if (!sel || sel.isCollapsed || value.length === 0 || !body.current?.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    p.onSelectText(value, rect.left, rect.bottom + 6);
  };

  return (
    <div className="docx-view" onMouseUp={onMouseUp} data-testid="docx-view">
      <div ref={style} />
      <div ref={body} />
    </div>
  );
}
