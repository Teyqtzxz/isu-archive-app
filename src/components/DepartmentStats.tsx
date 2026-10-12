import { useState } from "react";
import type { Thesis } from "../types";
import { DEPARTMENTS } from "../types";
import { countByDepartment, topKeywords } from "../stats";
import { Icon } from "./shared";

/**
 * "Studies by department" bars and "Top keywords" chips. Shared by the staff
 * Statistics tab and the student dashboard; each passes its own click
 * handlers, so the component never decides where a click goes.
 */
export function DepartmentStats({ theses, highlightDept, onSelectDepartment, onSelectKeyword }: {
  /** Every thesis the viewer can see — not one department's, or there is nothing to compare. */
  theses: Thesis[];
  /** The staff member's own department, marked "(mine)". */
  highlightDept?: string;
  onSelectDepartment: (department: string) => void;
  /** department is the one picked in the keyword box, "" for all of them. */
  onSelectKeyword: (keyword: string, department: string) => void;
}) {
  // "" = keywords across all departments.
  const [keywordDept, setKeywordDept] = useState("");

  const rows = countByDepartment(theses);
  // Bars are relative to the biggest department; max 1 so an empty archive
  // draws empty bars instead of dividing by zero.
  const max = Math.max(1, ...rows.map(r => r.count));
  const keywords = topKeywords(keywordDept ? theses.filter(t => t.department === keywordDept) : theses);

  return (
    <div className="stats-layout">
      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Studies by department</h2>
          <span className="card-meta">{theses.length} total</span>
        </div>
        <div className="bar-list">
          {rows.map(r => {
            const mine = !!highlightDept && r.department === highlightDept;
            return (
              <button
                key={r.department}
                // "Other" is not a search filter value, so it is not clickable.
                disabled={r.department === "Other"}
                onClick={() => onSelectDepartment(r.department)}
                className={`bar-row${mine ? " bar-row--mine" : ""}`}
                aria-label={`${r.department}: ${r.count} ${r.count === 1 ? "study" : "studies"}`}
              >
                <span className="bar-label">{r.department}{mine && <span className="bar-mine"> (mine)</span>}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
                </span>
                <span className="bar-count">{r.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Top keywords</h2>
          <select value={keywordDept} onChange={e => setKeywordDept(e.target.value)}
            aria-label="Keywords from department"
            className={`select-pill${keywordDept ? " select-pill-active" : ""}`}>
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {keywords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="search" size={22} /></div>
            <div className="empty-state-title">No keywords yet</div>
            <div className="empty-state-text">
              {keywordDept ? `No ${keywordDept} study has keywords.` : "Keywords appear once studies are registered."}
            </div>
          </div>
        ) : (
          <div className="keyword-list">
            {keywords.map(k => (
              <button key={k.keyword} onClick={() => onSelectKeyword(k.keyword, keywordDept)} className="keyword-chip"
                aria-label={`Search for ${k.keyword}, used in ${k.count} ${k.count === 1 ? "study" : "studies"}`}>
                {k.keyword}
                <span className="keyword-count">{k.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
