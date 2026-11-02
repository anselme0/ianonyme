import { ArrowLeft } from 'lucide-react';
import type { Category } from 'engine';
import type { MeasureAggregate, MeasureCounter, MeasureReport } from '../../shared/api.js';
import { FAMILY_ORDER, familyOf } from '../families.js';
import type { FamilyId } from '../families.js';
import { t } from '../messages.js';

const empty = (): MeasureCounter => ({ total: 0, detected: 0, bySource: { regex: 0, variant: 0, llm: 0 } });

function byFamily(agg: MeasureAggregate): Record<FamilyId, { direct: MeasureCounter; indirect: MeasureCounter }> {
  const out = Object.fromEntries(FAMILY_ORDER.map((f) => [f, { direct: empty(), indirect: empty() }])) as Record<
    FamilyId,
    { direct: MeasureCounter; indirect: MeasureCounter }
  >;
  for (const [cat, row] of Object.entries(agg.table)) {
    const slot = out[familyOf(cat as Category)];
    for (const kind of ['direct', 'indirect'] as const) {
      slot[kind].total += row[kind].total;
      slot[kind].detected += row[kind].detected;
      slot[kind].bySource.regex += row[kind].bySource.regex;
      slot[kind].bySource.variant += row[kind].bySource.variant;
      slot[kind].bySource.llm += row[kind].bySource.llm;
    }
  }
  return out;
}

function cell(c: MeasureCounter): string {
  if (c.total === 0) return t.reliability.noItems;
  return `${Math.round((100 * c.detected) / c.total)} % (${t.reliability.ofTotal(c.detected, c.total)})`;
}

function Table({ agg, deepMeasured }: { agg: MeasureAggregate; deepMeasured: boolean }) {
  const rows = byFamily(agg);
  return (
    <>
      <table className="table" data-testid="reliability-table">
        <thead>
          <tr>
            <th rowSpan={2}>{t.reliability.family}</th>
            <th colSpan={2}>{t.reliability.direct}</th>
            <th colSpan={2}>{t.reliability.indirect}</th>
          </tr>
          <tr>
            <th>{t.reliability.autoPart}</th>
            <th>{t.reliability.deepPart}</th>
            <th>{t.reliability.autoPart}</th>
            <th>{t.reliability.deepPart}</th>
          </tr>
        </thead>
        <tbody>
          {FAMILY_ORDER.map((f) => (
            <tr key={f}>
              <th scope="row">{t.families[f]}</th>
              <td>{cell(rows[f].direct)}</td>
              <td className="text-2">{deepMeasured ? cell(rows[f].direct) : t.reliability.deepNotMeasured}</td>
              <td>{cell(rows[f].indirect)}</td>
              <td className="text-2">{deepMeasured ? cell(rows[f].indirect) : t.reliability.deepNotMeasured}</td>
            </tr>
          ))}
          <tr className="row-total">
            <th scope="row">{t.reliability.total}</th>
            <td>{cell(agg.total.direct)}</td>
            <td className="text-2">{deepMeasured ? cell(agg.total.direct) : t.reliability.deepNotMeasured}</td>
            <td>{cell(agg.total.indirect)}</td>
            <td className="text-2">{deepMeasured ? cell(agg.total.indirect) : t.reliability.deepNotMeasured}</td>
          </tr>
        </tbody>
      </table>
      <ul className="indicators">
        <li>
          {t.reliability.visibleLeft} : <strong>{t.reliability.ofTotal(agg.directValuesLeft, agg.directValues)}</strong>
        </li>
        <li>
          {t.reliability.falseProtected} : <strong>{agg.falseAutomaticPerDocument.toFixed(1)}</strong>
        </li>
        <li>
          {t.reliability.falseSuggestions} : <strong>{deepMeasured ? agg.falseSuggestionsPerDocument.toFixed(1) : t.reliability.noItems}</strong>
        </li>
      </ul>
    </>
  );
}

export function Reliability({ report, onBack }: { report: MeasureReport | null; onBack(): void }) {
  const deepMeasured = report?.mode === 'regles_variantes_et_analyse_approfondie';
  return (
    <main className="screen reliability" data-testid="reliability">
      <button type="button" className="link-btn back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> {t.reliability.back}
      </button>
      <h1>{t.reliability.title}</h1>
      {report === null ? (
        <p>{t.reliability.none}</p>
      ) : (
        <>
          <p className="measured" data-testid="measured-on">
            {t.reliability.measuredOn(report.corpusDocuments)}
          </p>
          <p className="notice">{t.reliability.smallCorpus}</p>
          {(['ajust', 'eval'] as const).map((set) =>
            report.sets[set] ? (
              <section key={set}>
                <h2>
                  {set === 'ajust' ? t.reliability.adjustSet : t.reliability.evalSet} ({report.sets[set].documents})
                </h2>
                <Table agg={report.sets[set]} deepMeasured={deepMeasured} />
              </section>
            ) : null,
          )}
          <p className="small text-2">{t.reliability.exactLeakNote}</p>
        </>
      )}
    </main>
  );
}
