import {
  END,
  DAY,
  answers,
  visits,
  QUESTIONS,
  ENGINES,
  COMPETITORS,
} from "./data.js";
export const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
export const pct = (n) => `${n.toFixed(1)}%`;
export function dates(days, previous = false) {
  const end = Date.parse(END + "T00:00:00Z") - (previous ? days * DAY : 0);
  return {
    start: new Date(end - (days - 1) * DAY).toISOString().slice(0, 10),
    end: new Date(end).toISOString().slice(0, 10),
  };
}
export function filterRecords(records, state, previous = false) {
  const { start, end } = dates(state.days, previous);
  return records.filter(
    (r) =>
      r.date >= start &&
      r.date <= end &&
      (!state.engine || r.engine === state.engine) &&
      (!state.topic || r.topic === state.topic),
  );
}
export function metrics(a, v) {
  return {
    visibility: a.length
      ? (a.filter((r) => r.mention).length / a.length) * 100
      : 0,
    citations: a.filter((r) => r.cited).length,
    referrals: v.length,
    leads: v.filter((r) => r.lead).length,
    samples: a.length,
    mentions: a.filter((r) => r.mention).length,
    engaged: v.filter((r) => r.engaged).length,
  };
}
export function citationSummary(records) {
  const summarize = (rows, sourceKey) => ({
    citations: rows.length,
    pages: new Set(rows.map((row) => row[sourceKey])).size,
    questions: new Set(rows.map((row) => row.question)).size,
    engines: new Set(rows.map((row) => row.engine)).size,
  });
  const own = summarize(records.filter((row) => row.cited && row.page), "page"),
    external = summarize(records.filter((row) => row.external), "external"),
    total = own.citations + external.citations;
  return {
    own,
    external,
    total,
    websiteShare: total ? own.citations / total * 100 : 0,
    questions: new Set(records.map((row) => row.question)).size,
    engines: new Set(records.map((row) => row.engine)).size,
  };
}
export function select(state) {
  const a = filterRecords(answers, state),
    v = filterRecords(visits, state),
    previous = metrics(
      filterRecords(answers, state, true),
      filterRecords(visits, state, true),
    );
  const { start, end } = dates(state.days);
  const series = [];
  for (
    let d = Date.parse(start + "T00:00:00Z");
    d <= Date.parse(end + "T00:00:00Z");
    d += DAY
  ) {
    const date = new Date(d).toISOString().slice(0, 10);
    const prevdate = new Date(d - state.days * DAY).toISOString().slice(0, 10);
    series.push({
      date,
      ...metrics(
        a.filter((r) => r.date === date),
        v.filter((r) => r.date === date),
      ),
      previous: metrics(
        answers.filter(
          (r) =>
            r.date === prevdate &&
            (!state.engine || r.engine === state.engine) &&
            (!state.topic || r.topic === state.topic),
        ),
        visits.filter(
          (r) =>
            r.date === prevdate &&
            (!state.engine || r.engine === state.engine) &&
            (!state.topic || r.topic === state.topic),
        ),
      ),
    });
  }
  const questions = QUESTIONS.filter(
    (q) => !state.topic || q.topic === state.topic,
  )
    .map((q) => {
      const rows = a.filter((r) => r.question === q.id);
      return { ...q, ...metrics(rows, []), rows };
    })
    .sort((x, y) => x.visibility - y.visibility);
  const engines = ENGINES.filter((e) => !state.engine || state.engine === e.id)
    .map((e) => ({
      ...e,
      ...metrics(
        a.filter((r) => r.engine === e.id),
        v.filter((r) => r.engine === e.id),
      ),
    }))
    .sort((x, y) => y.visibility - x.visibility);
  const competitors = [
    { name: "Acme", self: true, count: a.filter((r) => r.mention).length },
    ...COMPETITORS.map((name) => ({
      name,
      count: a.filter((r) => r.competitors.includes(name)).length,
    })),
  ]
    .map((c) => ({ ...c, share: a.length ? (c.count / a.length) * 100 : 0 }))
    .sort((x, y) => y.share - x.share);
  const pageMap = new Map();
  a.filter((r) => r.cited).forEach((r) => {
    const p = pageMap.get(r.page) || { path: r.page, citations: 0 };
    p.citations++;
    pageMap.set(r.page, p);
  });
  const pages = [...pageMap.values()]
    .map((p) => ({
      ...p,
      referrals: v.filter((r) => r.page === p.path).length,
    }))
    .sort((x, y) => y.citations - x.citations);
  const external = [...new Set(a.map((r) => r.external))]
    .map((path) => ({
      path,
      citations: a.filter((r) => r.external === path).length,
    }))
    .sort((x, y) => y.citations - x.citations);
  return {
    a,
    v,
    current: metrics(a, v),
    previous,
    series,
    questions,
    engines,
    competitors,
    pages,
    external,
    citationSummary: citationSummary(a),
    start,
    end,
  };
}
export function parseState(search) {
  const p = new URLSearchParams(search);
  return {
    days: [7, 30, 90].includes(Number(p.get("days")))
      ? Number(p.get("days"))
      : 30,
    engine: ENGINES.some((e) => e.id === p.get("engine"))
      ? p.get("engine")
      : "",
    topic: QUESTIONS.some((q) => q.topic === p.get("topic"))
      ? p.get("topic")
      : "",
    metric: ["visibility", "citations", "referrals", "leads", "visitors", "pageviews"].includes(
      p.get("metric"),
    )
      ? p.get("metric")
      : "visibility",
  };
}
export function csv(rows) {
  const quote = (value) =>
    '"' + String(value ?? "").replaceAll('"', '""') + '"';
  return rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
