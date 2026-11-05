import { Paperclip, SearchCheck, SendHorizontal, Square, X, FileText, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import type { FileChip } from '../../shared/api.js';
import type { Mark } from '../marks.js';
import { t } from '../messages.js';
import { Marked } from './Marked.js';

export interface ComposerFile {
  chip: FileChip | null;
  name: string;
  stage: 'reading' | 'detecting' | 'deep' | 'ready' | 'failed';
  error?: string;
}

interface Props {
  value: string;
  marks: Mark[];
  files: ComposerFile[];
  protectedCount: number;
  /** « Envoyer » attend la fin de l'analyse : l'envoi partira tout seul. */
  queued: boolean;
  generating: boolean;
  /** Analyse approfondie en arrière-plan pendant la frappe. */
  analysing: boolean;
  blockedMarkIds?: string[];
  onChange(value: string): void;
  onSend(): void;
  onVerify(): void;
  onStop(): void;
  onCancelQueued(): void;
  onPickFiles(files: File[]): void;
  onRemoveFile(index: number): void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const MAX_HEIGHT = 220;

export function Composer(p: Props) {
  const mirror = useRef<HTMLDivElement>(null);
  const local = useRef<HTMLTextAreaElement>(null);
  const area = p.inputRef ?? local;
  const fileInput = useRef<HTMLInputElement>(null);

  // Hauteur adaptée au contenu ; le texte en miroir reprend exactement la même.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !mirror.current) return;
    el.style.height = 'auto';
    const h = Math.min(Math.max(el.scrollHeight, 52), MAX_HEIGHT);
    el.style.height = `${h}px`;
    mirror.current.style.height = `${h}px`;
    mirror.current.scrollTop = el.scrollTop;
  }, [p.value, area]);

  useEffect(() => {
    area.current?.focus();
  }, [area]);

  const syncScroll = (): void => {
    if (mirror.current && area.current) mirror.current.scrollTop = area.current.scrollTop;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!p.queued && !p.generating) p.onSend();
    }
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    const dropped = [...e.dataTransfer.files];
    if (dropped.length > 0) p.onPickFiles(dropped);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>): void => {
    const picked = [...(e.target.files ?? [])];
    e.target.value = '';
    if (picked.length > 0) p.onPickFiles(picked);
  };

  // Un document encore en cours d'analyse compte déjà : on peut cliquer, le volet ou l'envoi attend la fin.
  const canSend = (p.value.trim().length > 0 || p.files.some((f) => f.stage !== 'failed')) && !p.generating;

  return (
    <div className="composer" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {p.files.length > 0 && (
        <ul className="file-tiles" aria-label={t.conversation.attachedFile}>
          {p.files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={`file-tile file-${f.stage}`} data-testid="file-chip" title={f.name}>
              <span className="file-tile-icon">
                {f.stage === 'failed' ? <TriangleAlert size={18} aria-hidden /> : f.stage === 'ready' ? <FileText size={18} aria-hidden /> : <Loader2 size={18} className="spin" aria-hidden />}
              </span>
              <span className="file-tile-name">{f.name}</span>
              <span className="file-tile-stage">{f.stage === 'failed' ? (f.error ?? t.fileSteps.failed) : t.fileSteps[f.stage]}</span>
              <button type="button" className="icon-btn file-tile-remove" aria-label={t.composer.removeFile} onClick={() => p.onRemoveFile(i)}>
                <X size={12} aria-hidden />
              </button>
              {f.chip?.warnings.map((w, k) => (
                <span key={k} className="file-warning" role="status">
                  <TriangleAlert size={12} aria-hidden /> {t.file.warning(w)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
      <div className="composer-box">
        <div className="field">
          <div className="mirror" ref={mirror} aria-hidden="true">
            <Marked text={p.value} marks={p.marks} selectedId={null} />
            {'\n'}
          </div>
          <textarea
            ref={area}
            className="input"
            data-testid="composer-input"
            aria-label={t.composer.placeholder}
            placeholder={t.composer.placeholder}
            value={p.value}
            spellCheck={false}
            rows={1}
            onChange={(e) => p.onChange(e.target.value)}
            onKeyDown={onKey}
            onScroll={syncScroll}
          />
        </div>
        <div className="composer-actions">
          <button type="button" className="icon-btn" aria-label={t.composer.attach} title={t.composer.attach} onClick={() => fileInput.current?.click()}>
            <Paperclip size={18} aria-hidden />
          </button>
          <input ref={fileInput} type="file" hidden multiple accept=".txt,.docx,.pdf,.png,.jpg,.jpeg" onChange={onPick} data-testid="file-input" />
          <span className="composer-count" data-testid="protect-count" role="status">
            {t.composer.willProtect(p.protectedCount)}
          </span>
          {(p.analysing || p.queued) && (
            <span className="composer-analysing" role="status">
              <Loader2 size={14} className="spin" aria-hidden /> {p.queued ? t.composer.queuedSend : t.composer.analysing}
              {p.queued && (
                <button type="button" className="link-btn" onClick={p.onCancelQueued} data-testid="cancel-queued">
                  {t.composer.cancelQueued}
                </button>
              )}
            </span>
          )}
          <span className="spacer" />
          {p.generating ? (
            <button type="button" className="btn btn-secondary" onClick={p.onStop} data-testid="stop">
              <Square size={14} aria-hidden /> {t.conversation.stop}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" disabled={!canSend} onClick={p.onVerify} data-testid="verify">
                <SearchCheck size={16} aria-hidden /> {t.composer.verify}
              </button>
              <button type="button" className="btn btn-primary" disabled={!canSend || p.queued} onClick={p.onSend} data-testid="send">
                <SendHorizontal size={16} aria-hidden /> {t.composer.send}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
