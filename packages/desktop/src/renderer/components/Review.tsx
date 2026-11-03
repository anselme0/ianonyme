import { Check, ChevronDown, ChevronRight, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Mention } from 'engine';
import type { AnalysisView, EntityView } from '../../shared/api.js';
import { DEFAULT_CATEGORY, FAMILY_ORDER, familyOf } from '../families.js';
import type { FamilyId } from '../families.js';
import { marksFrom } from '../marks.js';
import { t } from '../messages.js';
import { Marked } from './Marked.js';

export interface ReviewProps {
  title: string;
  text: string;
  analysis: AnalysisView | null;
  suggestions: Mention[];
  entities: EntityView[];
  total: number;
  running: boolean;
  degraded: 'absent' | 'timeout' | 'error' | null;
  onProtect(mention: Mention, entityId?: string): void;
  onIgnore(mention: Mention): void;
  onLink(mention: Mention, entityId: string): void;
  onAddManual(text: string, category: Category): void;
  onCancel(): void;
  onContinue(): void;
  onSeeReceived(): void;
}

interface Item {
  key: string;
  kind: 'suggestion' | 'conflict';
  mention: Mention;
  candidates: EntityView[];
}

export function Review(p: ReviewProps) {
  const [selected, setSelected] = useState(0);
  const [linkOpen, setLinkOpen] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [family, setFamily] = useState<FamilyId>('personnes');
  const doc = useRef<HTMLDivElement>(null);

  const items: Item[] = useMemo(() => {
    const conflicts = p.analysis?.conflicts ?? [];
    const out: Item[] = [];
    for (const c of conflicts) {
      const mention = p.analysis?.mentions.find((m) => m.id === c.mentionId);
      if (!mention) continue;
      out.push({
        key: `c-${mention.id}`,
        kind: 'conflict',
        mention,
        candidates: c.candidateEntityIds.map((id) => p.entities.find((e) => e.id === id)).filter((e): e is EntityView => e !== undefined),
      });
    }
    for (const s of p.suggestions) out.push({ key: `s-${s.id}`, kind: 'suggestion', mention: s, candidates: [] });
    return out.sort((a, b) => a.mention.span.start - b.mention.span.start);
  }, [p.analysis, p.suggestions, p.entities]);

  const remaining = items.length;
  const done = Math.max(0, p.total - remaining);
  const canContinue = remaining === 0 && !p.running;
  const current = items[Math.min(selected, Math.max(0, items.length - 1))];

  const marks = useMemo(() => {
    const base = p.analysis ? marksFrom(p.analysis.mentions, p.analysis.conflicts) : [];
    const sug = marksFrom(p.suggestions, []);
    // Une suggestion ne remplace pas ce qui est déjà protégé.
    const free = sug.filter((s) => !base.some((b) => s.start < b.end && b.start < s.end));
    return [...base, ...free];
  }, [p.analysis, p.suggestions]);

  useEffect(() => {
    if (selected >= items.length) setSelected(Math.max(0, items.length - 1));
  }, [items.length, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, Math.max(0, items.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (current && current.kind === 'suggestion' && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        p.onProtect(current.mention, current.mention.entityId);
      } else if (current && (e.key === 'i' || e.key === 'I') && current.kind === 'suggestion') {
        e.preventDefault();
        p.onIgnore(current.mention);
      } else if (e.key === 'Escape') {
        p.onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!current) return;
    doc.current?.querySelector(`[data-mark-id="${CSS.escape(current.mention.id)}"]`)?.scrollIntoView?.({ block: 'center' });
  }, [current?.key]);

  const onMouseUp = (): void => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !doc.current || sel.rangeCount === 0) return setSelection(null);
    const range = sel.getRangeAt(0);
    const startEl = (range.startContainer.parentElement as HTMLElement | null)?.closest('[data-off]') as HTMLElement | null;
    const endEl = (range.endContainer.parentElement as HTMLElement | null)?.closest('[data-off]') as HTMLElement | null;
    if (!startEl || !endEl || !doc.current.contains(startEl) || !doc.current.contains(endEl)) return setSelection(null);
    const start = Number(startEl.dataset.off) + range.startOffset;
    const end = Number(endEl.dataset.off) + range.endOffset;
    const value = p.text.slice(Math.min(start, end), Math.max(start, end)).trim();
    if (value.length === 0) return setSelection(null);
    const rect = range.getBoundingClientRect();
    setSelection({ text: value, x: rect.left, y: rect.bottom + 6 });
  };

  const autoGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups = new Map<FamilyId, { text: string; label: string; mention: Mention }[]>();
    for (const m of p.analysis?.mentions ?? []) {
      if (m.status !== 'accepted') continue;
      const key = m.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const f = familyOf(m.category);
      const owner = p.entities.find((e) => e.id === m.entityId);
      const label =
        m.source === 'variant' && owner ? t.review.sourceVariant(owner.canonical) : m.source === 'regex' ? t.review.sourceRegex : t.review.sourceVariantGeneric;
      groups.set(f, [...(groups.get(f) ?? []), { text: m.text, label, mention: m }]);
    }
    return groups;
  }, [p.analysis, p.entities]);

  const sourceLabel = (it: Item): string => {
    if (it.kind === 'conflict') return t.review.conflict;
    if (it.mention.source === 'llm') return t.review.sourceLlm;
    return t.review.sourceRegex;
  };

  return (
    <div className="review" role="dialog" aria-modal="true" aria-label={t.review.title} data-testid="review">
      <header className="review-head">
        <h2>
          {t.review.title} — <span className="review-file">{p.title}</span>
        </h2>
        <span className="review-progress" data-testid="review-progress" role="status">
          {t.review.progress(done, p.total)}
        </span>
      </header>

      <div className="review-body">
        <section className="review-doc" aria-label={t.review.document}>
          <div className="doc-text" ref={doc} onMouseUp={onMouseUp} data-testid="review-doc">
            <Marked
              text={p.text}
              marks={marks}
              selectedId={current?.mention.id ?? null}
              onMarkClick={(m) => {
                const index = items.findIndex((it) => it.mention.id === m.id);
                if (index >= 0) setSelected(index);
              }}
            />
          </div>
          {selection && (
            <div className="selection-menu" style={{ left: selection.x, top: selection.y }} role="menu" data-testid="selection-menu">
              <select aria-label={t.review.selectionFamily} value={family} onChange={(e) => setFamily(e.target.value as FamilyId)}>
                {FAMILY_ORDER.map((f) => (
                  <option key={f} value={f}>
                    {t.families[f]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  p.onAddManual(selection.text, DEFAULT_CATEGORY[family]);
                  setSelection(null);
                  window.getSelection()?.removeAllRanges();
                }}
                data-testid="protect-selection"
              >
                {t.review.protectSelection}
              </button>
            </div>
          )}
        </section>

        <aside className="review-side">
          <h3 className="side-title">
            {t.review.toVerify} ({remaining})
            {p.running && <Loader2 size={14} className="spin" aria-label={t.review.deepRunning} />}
          </h3>
          {p.degraded && (
            <p className="pill pill-amber" role="status">
              <TriangleAlert size={14} aria-hidden /> {p.degraded === 'absent' ? t.review.basicNotice : t.review.deepSkipped}
            </p>
          )}
          {remaining === 0 && !p.running && <p className="text-2 small">{t.review.nothingToVerify}</p>}
          <ul className="verify-list">
            {items.map((it, index) => (
              <li
                key={it.key}
                className={`verify-item${index === selected ? ' verify-on' : ''}${it.kind === 'conflict' ? ' verify-conflict' : ''}`}
                onClick={() => setSelected(index)}
                data-testid="verify-item"
              >
                <div className="verify-text">
                  <span className={`dot fam-${familyOf(it.mention.category)}`} aria-hidden />
                  <strong>« {it.mention.text} »</strong>
                </div>
                <div className="verify-source">{sourceLabel(it)}</div>
                {it.kind === 'suggestion' && it.mention.entityId && (
                  <div className="verify-source" data-testid="verify-link">
                    {t.review.designates(p.entities.find((e) => e.id === it.mention.entityId)?.canonical ?? '')}
                  </div>
                )}
                {it.kind === 'conflict' ? (
                  <div className="verify-actions">
                    {it.candidates.map((c) => (
                      <button key={c.id} type="button" className="btn btn-secondary btn-sm" onClick={() => p.onLink(it.mention, c.id)} data-testid="choose-candidate">
                        {t.review.chooseCandidate(c.canonical)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="verify-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => p.onProtect(it.mention, it.mention.entityId)} data-testid="protect">
                      {t.review.protect}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => p.onIgnore(it.mention)} data-testid="ignore">
                      {t.review.ignore}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLinkOpen(linkOpen === it.key ? null : it.key)} aria-expanded={linkOpen === it.key} data-testid="link">
                      {t.review.linkTo}
                    </button>
                  </div>
                )}
                {linkOpen === it.key && it.kind === 'suggestion' && (
                  <select
                    className="link-select"
                    aria-label={t.review.linkChoose}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        p.onLink(it.mention, e.target.value);
                        setLinkOpen(null);
                      }
                    }}
                    data-testid="link-select"
                  >
                    <option value="" disabled>
                      {t.review.linkChoose}
                    </option>
                    {p.entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.canonical}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>

          <h3 className="side-title">
            <ShieldCheck size={14} aria-hidden /> {t.review.autoProtected}
          </h3>
          {FAMILY_ORDER.filter((f) => autoGroups.has(f)).map((f) => {
            const list = autoGroups.get(f) ?? [];
            const open = openGroups[f] ?? true;
            return (
              <div key={f} className="auto-group">
                <button type="button" className="group-toggle" aria-expanded={open} onClick={() => setOpenGroups({ ...openGroups, [f]: !open })}>
                  {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  <span className={`dot fam-${f}`} aria-hidden /> {t.families[f]} ({list.length})
                </button>
                {open && (
                  <ul className="auto-list">
                    {list.map((a) => (
                      <li key={a.text}>
                        <span>{a.text}</span> <span className="text-2 small">{a.label}</span>{' '}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => p.onIgnore(a.mention)} data-testid="unprotect">
                          {t.review.unprotect}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </aside>
      </div>

      <footer className="review-foot">
        <button type="button" className="btn btn-secondary" onClick={p.onCancel} data-testid="review-cancel">
          {t.review.cancel}
        </button>
        <span className="text-2 small keys">{t.review.keys}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-secondary" onClick={p.onSeeReceived} data-testid="review-see-received">
          {t.review.seeReceived}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canContinue}
          title={canContinue ? undefined : t.review.continueDisabled}
          onClick={p.onContinue}
          data-testid="review-continue"
        >
          <Check size={16} aria-hidden /> {t.review.continue}
        </button>
      </footer>
    </div>
  );
}
