import { X } from 'lucide-react';
import { splitByMarks } from '../marks.js';
import type { Mark } from '../marks.js';

interface Props {
  text: string;
  marks: Mark[];
  onMarkClick?: (mark: Mark) => void;
  selectedId?: string | null;
  /** Repère affiché à la place du texte d'origine, par identifiant de surlignage (vue « ce que l'IA reçoit »). */
  labels?: Record<string, string>;
  /** Petite croix au survol d'un élément protégé. */
  onRemove?: (mark: Mark) => void;
  removeLabel?: string;
}

/** Texte avec ses informations surlignées par famille. `data-off` donne le décalage de chaque morceau. */
export function Marked({ text, marks, onMarkClick, selectedId, labels, onRemove, removeLabel }: Props) {
  let offset = 0;
  return (
    <>
      {splitByMarks(text, marks).map((piece, i) => {
        const off = offset;
        offset += piece.text.length;
        const mark = piece.mark;
        if (!mark) {
          return (
            <span key={i} data-off={off}>
              {piece.text}
            </span>
          );
        }
        const label = labels?.[mark.id];
        return (
          <mark
            key={`${mark.id}-${i}`}
            data-mark-id={mark.id}
            data-off={off}
            className={`mark fam-${mark.family} mark-${mark.kind}${selectedId === mark.id ? ' mark-selected' : ''}${label ? ' mark-sent' : ''}`}
            title={label ? piece.text : undefined}
            onClick={onMarkClick ? () => onMarkClick(mark) : undefined}
          >
            {label ?? piece.text}
            {onRemove && mark.kind === 'protected' && (
              <button
                type="button"
                className="mark-x"
                contentEditable={false}
                aria-label={removeLabel}
                title={removeLabel}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(mark);
                }}
                data-testid="mark-unprotect"
              >
                <X size={10} aria-hidden />
              </button>
            )}
          </mark>
        );
      })}
    </>
  );
}
