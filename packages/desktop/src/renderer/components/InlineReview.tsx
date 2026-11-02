import { Check } from 'lucide-react';
import type { Mention } from 'engine';
import type { AnalysisView, EntityView } from '../../shared/api.js';
import { familyOf } from '../families.js';
import { t } from '../messages.js';

interface Props {
  analysis: AnalysisView | null;
  suggestions: Mention[];
  entities: EntityView[];
  onProtect(mention: Mention, entityId?: string): void;
  onIgnore(mention: Mention): void;
  onLink(mention: Mention, entityId: string): void;
  onCancel(): void;
  onContinue(): void;
}

/** Revue courte, dans le fil, pour un message court avec une ou deux suggestions (docs/UI_UX.md, §5.3). */
export function InlineReview(p: Props) {
  const conflicts = (p.analysis?.conflicts ?? [])
    .map((c) => ({
      mention: p.analysis?.mentions.find((m) => m.id === c.mentionId),
      candidates: c.candidateEntityIds.map((id) => p.entities.find((e) => e.id === id)).filter((e): e is EntityView => e !== undefined),
    }))
    .filter((c): c is { mention: Mention; candidates: EntityView[] } => c.mention !== undefined);
  const remaining = conflicts.length + p.suggestions.length;

  return (
    <section className="inline-review" aria-label={t.review.title} data-testid="inline-review">
      <h3>{t.review.toVerify}</h3>
      <ul>
        {conflicts.map(({ mention, candidates }) => (
          <li key={`c-${mention.id}`} className="verify-item verify-conflict" data-testid="inline-item">
            <span className={`dot fam-${familyOf(mention.category)}`} aria-hidden />
            <strong>« {mention.text} »</strong>
            <span className="verify-source">{t.review.conflict}</span>
            <span className="verify-actions">
              {candidates.map((c) => (
                <button key={c.id} type="button" className="btn btn-secondary btn-sm" onClick={() => p.onLink(mention, c.id)} data-testid="choose-candidate">
                  {t.review.chooseCandidate(c.canonical)}
                </button>
              ))}
            </span>
          </li>
        ))}
        {p.suggestions.map((m) => (
          <li key={`s-${m.id}`} className="verify-item" data-testid="inline-item">
            <span className={`dot fam-${familyOf(m.category)}`} aria-hidden />
            <strong>« {m.text} »</strong>
            <span className="verify-source">
              {t.review.sourceLlm}
              {m.entityId ? ` — ${t.review.designates(p.entities.find((e) => e.id === m.entityId)?.canonical ?? '')}` : ''}
            </span>
            <span className="verify-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => p.onProtect(m, m.entityId)} data-testid="protect">
                {t.review.protect}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => p.onIgnore(m)} data-testid="ignore">
                {t.review.ignore}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="row-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={p.onCancel} data-testid="inline-cancel">
          {t.review.cancel}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={remaining > 0}
          title={remaining > 0 ? t.review.continueDisabled : undefined}
          onClick={p.onContinue}
          data-testid="inline-continue"
        >
          <Check size={14} aria-hidden /> {t.review.continue}
        </button>
      </div>
    </section>
  );
}
