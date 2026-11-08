import { useEffect, useMemo, useState } from "react";
import type { Thesis } from "../types";
import { KEYWORD_MODEL, evaluateKeywordModel, findNearCopies, trainKeywordModel, type KeywordEvaluation } from "../keywordModel";
import { Icon } from "./shared";

const percent = (x: number) => `${Math.round(x * 100)}%`;

/**
 * "Keyword model" card, staff Statistics tab only: what the keyword predictor
 * (keywordModel.ts, docs/15) has learned and how it scores in leave-one-out
 * cross-validation with near-copies hidden, next to the most-common-keywords
 * baseline. The test retrains the model once per study (about 2 s at 300
 * studies), so it runs after the tab has drawn, once per data change. It
 * tests the learned model even below KEYWORD_MODEL.reliableFrom studies (the
 * Register form then shows no learned keyword). Near-copies count once, in
 * the numbers and in training; the search for them is shared by both.
 */
export function KeywordModelCard({ theses }: { theses: Thesis[] }) {
  const nearCopies = useMemo(() => findNearCopies(theses), [theses]);
  const model = useMemo(() => trainKeywordModel(theses, { nearCopies }), [theses, nearCopies]);
  const [result, setResult] = useState<{ source: Thesis[]; evaluation: KeywordEvaluation } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setResult({ source: theses, evaluation: evaluateKeywordModel(theses, { nearCopies }) }), 50);
    return () => clearTimeout(timer);
  }, [theses, nearCopies]);
  const evaluation = result?.source === theses ? result.evaluation : null;

  const rows: { label: string; key: keyof KeywordEvaluation["model"] }[] = [
    { label: "At least one correct keyword", key: "hitRate" },
    { label: "Precision (correct ÷ suggested)", key: "precision" },
    { label: "Recall (real keywords found)", key: "recall" },
  ];

  return (
    <section className="card km-card">
      <div className="card-title-row">
        <h2 className="card-title">Keyword model</h2>
        <span className="card-meta">Naive Bayes + TF-IDF phrases</span>
      </div>
      <div className="km-body">
        <div className="km-stats">
          <div className="km-stat">
            <span className="km-stat-value">{model.n}</span>
            <span className="km-stat-label">
              training {model.n === 1 ? "study" : "studies"} (with keywords
              {model.copiesMerged > 0 && `; ${model.copiesMerged} near-${model.copiesMerged === 1 ? "copy" : "copies"} counted with ${model.copiesMerged === 1 ? "its original" : "their originals"}`})
            </span>
          </div>
          <div className="km-stat">
            <span className="km-stat-value">{model.labels.length}</span>
            <span className="km-stat-label">known {model.labels.length === 1 ? "keyword" : "keywords"}</span>
          </div>
        </div>

        {model.n < KEYWORD_MODEL.reliableFrom && (
          <div className="km-warn" role="note">
            <Icon name="alert" size={16} />
            Fewer than {KEYWORD_MODEL.reliableFrom} studies with keywords — not reliable yet.
          </div>
        )}

        <span className="overline-label km-overline">Leave-one-out test</span>
        {!evaluation ? (
          <p className="hint" aria-live="polite">Testing the model…</p>
        ) : evaluation.tested === 0 ? (
          <p className="hint">No study has keywords yet — nothing to test.</p>
        ) : (
          <>
            <p className="km-meta">
              {evaluation.tested} {evaluation.tested === 1 ? "study" : "studies"} tested, {evaluation.copiesHidden} {evaluation.copiesHidden === 1 ? "copy" : "copies"} hidden
            </p>
            <table className="km-table">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Model</th>
                  <th scope="col">Baseline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td className="km-model">{percent(evaluation.model[r.key])}</td>
                    <td>{percent(evaluation.baseline[r.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              Each study's keywords are hidden in turn; a new model trained on the other studies (its near-copies left
              out too) suggests up to {KEYWORD_MODEL.maxSuggestions}, compared with its real keywords. Baseline: always
              the {KEYWORD_MODEL.maxSuggestions} most used keywords.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
