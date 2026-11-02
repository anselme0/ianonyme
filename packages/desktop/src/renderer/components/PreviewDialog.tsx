import { Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { PreviewView } from '../../shared/api.js';
import { marksFrom } from '../marks.js';
import { t } from '../messages.js';
import { Marked } from './Marked.js';

/** Texte protégé dont les repères sont mis en évidence, en police mono. */
export function ProtectedText({ text }: { text: string }) {
  const parts = text.split(/(\[[A-Z][A-Z_]*_\d+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[A-Z][A-Z_]*_\d+\]$/.test(part) ? (
          <code key={i} className="placeholder">
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

interface Props {
  preview: PreviewView;
  originalText: string;
  sending: boolean;
  onSend(): void;
  onBack(): void;
}

export function PreviewDialog({ preview, originalText, sending, onSend, onBack }: Props) {
  const [view, setView] = useState<'received' | 'compare'>('received');
  const marks = marksFrom(preview.mentions, preview.conflicts);
  const blocked = !preview.leak.ok;
  return (
    <div className="modal-backdrop">
      <div className="modal preview-dialog" role="dialog" aria-modal="true" aria-label={t.receivedView.title} data-testid="preview-dialog">
        <header className="modal-head">
          <h2>{t.receivedView.title}</h2>
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={view === 'received'} className={view === 'received' ? 'seg seg-on' : 'seg'} onClick={() => setView('received')}>
              {t.receivedView.received}
            </button>
            <button type="button" role="tab" aria-selected={view === 'compare'} className={view === 'compare' ? 'seg seg-on' : 'seg'} onClick={() => setView('compare')} data-testid="view-compare">
              {t.receivedView.compare}
            </button>
          </div>
        </header>
        <div className="modal-body">
          {blocked && (
            <p className="banner banner-red" role="alert">
              <TriangleAlert size={16} aria-hidden /> {t.blocked.bannerGeneric}
            </p>
          )}
          {view === 'received' ? (
            <pre className="received-text" data-testid="preview-masked">
              <ProtectedText text={preview.maskedCurrent} />
            </pre>
          ) : (
            <div className="compare">
              <div>
                <h3>{t.receivedView.original}</h3>
                <pre className="received-text">
                  <Marked text={originalText} marks={marks.filter((m) => m.kind === 'protected')} />
                </pre>
              </div>
              <div>
                <h3>{t.receivedView.protectedText}</h3>
                <pre className="received-text">
                  <ProtectedText text={preview.maskedCurrent} />
                </pre>
              </div>
            </div>
          )}
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onBack} data-testid="preview-back">
            {t.receivedView.back}
          </button>
          <button type="button" className="btn btn-primary" disabled={blocked || sending} onClick={onSend} data-testid="preview-send">
            <Send size={16} aria-hidden /> {t.receivedView.send}
          </button>
        </footer>
      </div>
    </div>
  );
}
