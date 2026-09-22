export const VIEWS = {
  overview: "Overview",
  visibility: "Visibility",
  traffic: "Traffic",
  questions: "Questions",
  opportunities: "Opportunities",
};
export function resolveView({ pathname = "/app/", hash = "", search = "" }) {
  if (/^\/app\/sources\/?$/.test(pathname) || hash === "#sources") return "overview";
  if (/^\/app\/addons(?:\/.*)?$/.test(pathname)) return "overview";
  const page = pathname.match(/^\/app\/([^/]+)\/?$/)?.[1];
  if (Object.hasOwn(VIEWS, page)) return page;
  const legacy = {
    overview: "overview",
    questions: "questions",
    actions: "opportunities",
  }[hash.slice(1)];
  if (legacy) return legacy;
  return ["referrals", "leads"].includes(
    new URLSearchParams(search).get("metric"),
  )
    ? "traffic"
    : "overview";
}
export function metricForView(view, metric) {
  if (view === "traffic" && !["referrals", "visitors", "pageviews", "leads"].includes(metric))
    return "referrals";
  if (view === "visibility" && !["visibility", "citations"].includes(metric))
    return "visibility";
  if (view !== "traffic" && ["visitors", "pageviews"].includes(metric)) return "visibility";
  return metric;
}
export function pageURL(view, state = {}) {
  if (!Object.hasOwn(VIEWS, view)) view = "overview";
  const query = new URLSearchParams();
  if (state.days && state.days !== 30) query.set("days", state.days);
  if (view === 'traffic') {
    const source = state.source ?? state.engine;
    if (source) query.set('source', source);
    if (state.country) query.set('country', state.country);
    if (state.device) query.set('device', state.device);
  } else {
    if (state.engine) query.set('engine', state.engine);
    if (state.topic) query.set('topic', state.topic);
  }
  const metric = metricForView(view, state.metric || "visibility");
  if (metric !== "visibility") query.set("metric", metric);
  return `/app/${view}/${query.size ? "?" + query : ""}`;
}
