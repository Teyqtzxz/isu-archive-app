import { useId, type CSSProperties } from "react";
import type { Thesis } from "../types";
import { countAddedByMonth, countByYear, topAdvisers, type MonthCount, type YearCount } from "../stats";

/**
 * Three read-only charts for the staff Statistics tab (errata #76): studies by
 * Academic Year, studies added per month (the last 12), and the top advisers.
 * Plain CSS bars in theme tokens, so dark mode works. Every value is printed
 * on its bar (phones have no hover), nothing is clickable or focusable, and
 * each chart has a hidden table for screen readers.
 */
export function LibraryCharts({ theses, now = new Date() }: {
  /** Every study in the e-library — never one department's. */
  theses: Thesis[];
  now?: Date;
}) {
  const years = countByYear(theses);
  const months = countAddedByMonth(theses, now);
  const advisers = topAdvisers(theses);
  const addedTotal = months.reduce((n, m) => n + m.count, 0);
  const first = months[0];
  const last = months[months.length - 1];
  const monthRange = `${first.label} ${first.year} – ${last.label} ${last.year}`;

  return (
    <div className="lc-layout">
      <div className="lc-stack">
        <ColumnChart
          title="Studies by year"
          meta="Academic Year"
          empty="No studies yet."
          head={["Academic Year", "Studies"]}
          cols={years.map(yearColumn)}
        />
        <ColumnChart
          title="Added per month"
          meta={monthRange}
          empty={theses.length === 0 ? "No studies yet." : "No study was added in the last 12 months."}
          head={["Month added", "Studies"]}
          cols={addedTotal === 0 ? [] : months.map((m, i) => monthColumn(m, i))}
          note="When each study was posted on the e-library, not its Academic Year."
        />
      </div>
      <BarChart
        title="Top advisers"
        meta={advisers.length > 0 ? `Top ${advisers.length}` : ""}
        empty={theses.length === 0 ? "No studies yet." : "No adviser recorded yet."}
        rows={advisers.map(a => ({ label: a.adviser, count: a.count }))}
      />
    </div>
  );
}

export default LibraryCharts;

/** One column. `label` / `short` are the lines under it on screen (`short` in
 *  a narrow chart); `name` is what the screen-reader table says. */
interface Column {
  key: string;
  label: string[];
  short: string[];
  name: string;
  count: number;
}

/** "’15": a 2-digit year that fits a narrow column. */
const shortYear = (y: number) => `’${String(y % 100).padStart(2, "0")}`;

function yearColumn(r: YearCount): Column {
  if (r.kind === "before") return { key: "before", label: ["Before", String(r.year)], short: [`<${shortYear(r.year!)}`], name: r.label, count: r.count };
  if (r.kind === "none") return { key: "none", label: ["No", "year"], short: ["n/a"], name: "No year recorded", count: r.count };
  return { key: r.label, label: [r.label], short: [shortYear(r.year!)], name: r.label, count: r.count };
}

/** The year is printed under the first month and under each January. */
function monthColumn(m: MonthCount, i: number): Column {
  const lines = i === 0 || m.month === 0 ? [m.label, shortYear(m.year)] : [m.label];
  return { key: `${m.year}-${m.month}`, label: lines, short: lines, name: `${m.label} ${m.year}`, count: m.count };
}

const studies = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "study" : "studies"}`;

/** Whole thousands, "1k" for 1,234: a 13th of a 320 px card is 20 px, which
 *  fits 3 characters of 10 px digits, not "1.2k". The exact number is in the
 *  screen-reader table and, below 10,000, on a wider card. */
function compact(n: number): string {
  return n < 1000 ? String(n) : `${Math.round(n / 1000)}k`;
}

function ColumnValue({ n }: { n: number }) {
  const full = n.toLocaleString("en-US");
  const short = compact(n);
  if (n < 1000) return <>{full}</>;
  if (n >= 10000) return <>{short}</>;
  return <><span className="lc-wide">{full}</span><span className="lc-narrow">{short}</span></>;
}

function ColumnChart({ title, meta, empty, head, cols, note }: {
  title: string;
  meta: string;
  empty: string;
  head: [string, string];
  cols: Column[];
  note?: string;
}) {
  const id = useId();
  // max ≥ 1, so a chart of zeros never divides by zero.
  const max = Math.max(1, ...cols.map(c => c.count));
  return (
    <section className="card lc-card" aria-labelledby={id}>
      <div className="card-title-row lc-title-row">
        <h2 className="card-title" id={id}>{title}</h2>
        <span className="card-meta">{meta}</span>
      </div>
      {cols.length === 0 ? (
        <p className="lc-empty">{empty}</p>
      ) : (
        <div className="lc-body">
          <div className="lc-plot" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
            {cols.map(c => (
              // --h: the column's height as a share of the tallest; the value sits on its cap.
              <div key={c.key} className="lc-col" style={{ "--h": `${(c.count / max) * 100}%` } as CSSProperties}>
                <span className="lc-track">
                  {c.count > 0 && <span className="lc-column" />}
                  <span className={`lc-value${c.count === 0 ? " lc-value--zero" : ""}`}><ColumnValue n={c.count} /></span>
                </span>
              </div>
            ))}
            {cols.map(c => (
              <div key={c.key} className="lc-xlabel">
                {c.label.map((l, i) => <span key={`w${i}`} className="lc-wide">{l}</span>)}
                {c.short.map((l, i) => <span key={`n${i}`} className="lc-narrow">{l}</span>)}
              </div>
            ))}
          </div>
          {note && <p className="lc-note">{note}</p>}
          {/* sr-only goes on a div, not the table: a table never shrinks below
              its content, so a long name made it wider than the page. */}
          <div className="sr-only">
            <table>
              <caption>{title}{meta ? `, ${meta}` : ""}</caption>
              <thead><tr><th scope="col">{head[0]}</th><th scope="col">{head[1]}</th></tr></thead>
              <tbody>
                {cols.map(c => <tr key={c.key}><th scope="row">{c.name}</th><td>{studies(c.count)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function BarChart({ title, meta, empty, rows }: {
  title: string;
  meta: string;
  empty: string;
  rows: { label: string; count: number }[];
}) {
  const id = useId();
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <section className="card lc-card" aria-labelledby={id}>
      <div className="card-title-row lc-title-row">
        <h2 className="card-title" id={id}>{title}</h2>
        {meta && <span className="card-meta">{meta}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="lc-empty">{empty}</p>
      ) : (
        <>
          <div className="lc-bars" aria-hidden="true">
            {rows.map(r => (
              <div key={r.label} className="lc-bar-row">
                <span className="lc-bar-label">{r.label}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} /></span>
                <span className="bar-count">{r.count.toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
          <div className="sr-only">
            <table>
              <caption>{title}</caption>
              <thead><tr><th scope="col">Adviser</th><th scope="col">Studies</th></tr></thead>
              <tbody>
                {rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{studies(r.count)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
