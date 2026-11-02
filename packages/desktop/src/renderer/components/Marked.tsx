import { splitByMarks } from '../marks.js';
import type { Mark } from '../marks.js';

interface Props {
  text: string;
  marks: Mark[];
  onMarkClick?: (mark: Mark) => void;
  selectedId?: string | null;
}

/** Texte avec ses informations surlignées par famille. `data-off` donne le décalage de chaque morceau. */
export function Marked({ text, marks, onMarkClick, selectedId }: Props) {
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
        return (
          <mark
            key={`${mark.id}-${i}`}
            data-mark-id={mark.id}
            data-off={off}
            className={`mark fam-${mark.family} mark-${mark.kind}${selectedId === mark.id ? ' mark-selected' : ''}`}
            onClick={onMarkClick ? () => onMarkClick(mark) : undefined}
          >
            {piece.text}
          </mark>
        );
      })}
    </>
  );
}
