import { PanelRightClose, PanelRightOpen, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AppInfo, EntityView } from '../../shared/api.js';
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
  info: AppInfo;
}

export function ProtectionPanel(p: Props) {
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

      <h3 className="protection-section">{t.protection.tabElements}</h3>

      <div className="protection-body">
        {byFamily.length === 0 ? (
          <p className="text-2 small">{t.protection.empty}</p>
        ) : (
          byFamily.map(({ f, items }) => (
            <section key={f} className="family-group">
              <h3>
                {t.families[f]} ({items.length})
              </h3>
              <ul>
                {items.map((e) => {
                  const others = e.variants.filter((v) => v.toLowerCase() !== e.canonical.toLowerCase());
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        className={`entity-row${p.focusEntity === e.id ? ' entity-row-on' : ''}`}
                        onClick={() => p.onFocusEntity(p.focusEntity === e.id ? null : e.id)}
                        data-testid="entity-row"
                      >
                        <span className={`dot fam-${f}`} aria-hidden />
                        <span className="entity-name">{e.canonical}</span>
                      </button>
                      {others.length > 0 && (
                        <ul className="entity-sub" data-testid="entity-sub">
                          {others.map((v) => (
                            <li key={v} className="text-2">
                              {v}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <footer className="protection-foot">
        <p className={llmReady ? 'analysis analysis-on' : 'analysis analysis-basic'} data-testid="analysis-status">
          {llmReady ? null : <span className="pill pill-amber">{t.protection.basic}</span>}{' '}
          {llmReady ? deepLine : null}
        </p>
        {!llmReady && <p className="small text-2">{t.protection.basicExplain}</p>}
      </footer>
    </aside>
  );
}
