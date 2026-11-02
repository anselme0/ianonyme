import { PanelRightClose, PanelRightOpen, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { AppInfo, EntityView, PreviewView } from '../../shared/api.js';
import { FAMILY_ORDER, familyOf } from '../families.js';
import { t } from '../messages.js';

interface Props {
  collapsed: boolean;
  onToggle(): void;
  entities: EntityView[];
  toReview: number;
  onOpenReview(): void;
  focusEntity: string | null;
  onFocusEntity(id: string | null): void;
  preview: PreviewView | null;
  info: AppInfo;
  deepAnalysis: boolean;
  onToggleDeep(value: boolean): void;
}

export function ProtectionPanel(p: Props) {
  const [tab, setTab] = useState<'elements' | 'received'>('elements');
  const [history, setHistory] = useState(false);

  if (p.collapsed) {
    return (
      <aside className="protection protection-collapsed" aria-label={t.protection.title}>
        <button type="button" className="icon-btn" aria-label={t.protection.expand} title={t.protection.expand} onClick={p.onToggle} data-testid="panel-expand">
          <PanelRightOpen size={18} aria-hidden />
        </button>
      </aside>
    );
  }

  const llmReady = p.info.localAnalysis === 'ready';
  const deepLine = llmReady
    ? p.info.localAnalysisSimulated
      ? t.protection.deepActiveSimulated
      : t.protection.deepActive
    : p.info.localAnalysis === 'loading'
      ? t.protection.deepLoading
      : t.protection.basic;

  const byFamily = FAMILY_ORDER.map((f) => ({ f, items: p.entities.filter((e) => familyOf(e.category) === f) })).filter((g) => g.items.length > 0);
  const maskedLines =
    p.preview === null
      ? []
      : history
        ? p.preview.maskedPayload
        : p.preview.maskedPayload.slice(-1);

  return (
    <aside className="protection" aria-label={t.protection.title} data-testid="protection-panel">
      <header className="protection-head">
        <h2>{t.protection.title}</h2>
        <button type="button" className="icon-btn" aria-label={t.protection.collapse} title={t.protection.collapse} onClick={p.onToggle}>
          <PanelRightClose size={18} aria-hidden />
        </button>
      </header>

      <div className="protection-state">
        {p.toReview > 0 ? (
          <button type="button" className="state state-amber" onClick={p.onOpenReview} data-testid="state-review">
            <TriangleAlert size={16} aria-hidden /> {t.protection.toReview(p.toReview)}
          </button>
        ) : (
          <div className="state state-green" data-testid="state-protected">
            <ShieldCheck size={16} aria-hidden /> {t.protection.protectedCount(p.entities.length)}
          </div>
        )}
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'elements'} className={tab === 'elements' ? 'tab tab-on' : 'tab'} onClick={() => setTab('elements')}>
          {t.protection.tabElements}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'received'} className={tab === 'received' ? 'tab tab-on' : 'tab'} onClick={() => setTab('received')} data-testid="tab-received">
          {t.protection.tabReceived}
        </button>
      </div>

      <div className="protection-body" role="tabpanel">
        {tab === 'elements' ? (
          byFamily.length === 0 ? (
            <p className="text-2 small">{t.protection.empty}</p>
          ) : (
            byFamily.map(({ f, items }) => (
              <section key={f} className="family-group">
                <h3>
                  {t.families[f]} ({items.length})
                </h3>
                <ul>
                  {items.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={`entity-row${p.focusEntity === e.id ? ' entity-row-on' : ''}`}
                        onClick={() => p.onFocusEntity(p.focusEntity === e.id ? null : e.id)}
                        data-testid="entity-row"
                      >
                        <span className={`dot fam-${f}`} aria-hidden />
                        <span className="entity-name">{e.canonical}</span>
                        <code className="placeholder">{e.placeholder}</code>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )
        ) : (
          <div data-testid="received-view">
            {maskedLines.length === 0 || p.preview === null ? (
              <p className="text-2 small">{t.protection.receivedEmpty}</p>
            ) : (
              <>
                <pre className="received-text" data-testid="received-text">
                  {maskedLines.map((m) => m.content).join('\n\n— — —\n\n')}
                </pre>
                <button type="button" className="link-btn" onClick={() => setHistory(!history)}>
                  {history ? t.protection.hideHistory : t.protection.showHistory}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="protection-foot">
        <p className={llmReady ? 'analysis analysis-on' : 'analysis analysis-basic'} data-testid="analysis-status">
          {llmReady ? null : <span className="pill pill-amber">{t.protection.basic}</span>}{' '}
          {llmReady ? deepLine : null}
        </p>
        {!llmReady && <p className="small text-2">{t.protection.basicExplain}</p>}
        <label className={`switch${llmReady ? '' : ' switch-off'}`}>
          <input
            type="checkbox"
            checked={llmReady && p.deepAnalysis}
            disabled={!llmReady}
            onChange={(e) => p.onToggleDeep(e.target.checked)}
            data-testid="deep-toggle"
          />
          <span>{t.protection.toggleLabel}</span>
        </label>
        <p className="small text-2">{t.protection.toggleHelp}</p>
      </footer>
    </aside>
  );
}
