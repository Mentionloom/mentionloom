import { ACTIONS } from "./data.js";

// Recommendations use observed missing answers, never invented traffic upside.
export function priorities(data, work = {}, shipped = []) {
  return ACTIONS.map((action) => {
    const question = data.questions.find((q) => q.id === action.question);
    if (!question) return null;
    return {
      ...action,
      questionData: question,
      missing: question.samples - question.mentions,
      inProgress: Boolean(work[action.id]?.startedAt),
      completed: shipped.includes(action.id),
    };
  })
    .filter(Boolean)
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        Number(b.inProgress) - Number(a.inProgress) ||
        b.missing - a.missing ||
        a.id.localeCompare(b.id),
    );
}

export function baselineFor(action, data, state) {
  const question = data.questions.find((q) => q.id === action.question);
  return {
    start: data.start,
    end: data.end,
    engine: state.engine,
    topic: state.topic,
    samples: question?.samples || 0,
    mentions: question?.mentions || 0,
    visibility: question?.visibility || 0,
    referrals: data.v.filter((v) => v.page === action.path).length,
  };
}

export function normalizeWork(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const action of ACTIONS) {
    const item = value[action.id];
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.startedAt !== "string" ||
      !Number.isFinite(Date.parse(item.startedAt))
    )
      continue;
    const checked = [
      ...new Set(Array.isArray(item.checked) ? item.checked : []),
    ].filter((n) => Number.isInteger(n) && n >= 0 && n < action.steps.length);
    const baseline = item.baseline;
    const validBaseline =
      baseline &&
      typeof baseline.start === "string" &&
      typeof baseline.end === "string" &&
      [
        baseline.samples,
        baseline.mentions,
        baseline.visibility,
        baseline.referrals,
      ].every((v) => Number.isFinite(v) && v >= 0) &&
      baseline.mentions <= baseline.samples &&
      baseline.visibility <= 100;
    result[action.id] = {
      startedAt: item.startedAt,
      checked,
      baseline: validBaseline ? baseline : null,
      shippedAt:
        typeof item.shippedAt === "string" &&
        Number.isFinite(Date.parse(item.shippedAt))
          ? item.shippedAt
          : null,
    };
  }
  return result;
}

export function startWork(
  work,
  action,
  baseline,
  now = new Date().toISOString(),
) {
  if (work[action.id]) return work;
  return {
    ...work,
    [action.id]: { startedAt: now, checked: [], baseline, shippedAt: null },
  };
}
export function checkStep(work, action, index, checked) {
  if (
    !work[action.id] ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= action.steps.length
  )
    return work;
  const values = new Set(work[action.id].checked);
  checked ? values.add(index) : values.delete(index);
  return {
    ...work,
    [action.id]: { ...work[action.id], checked: [...values].sort() },
  };
}
export function canShip(action, work) {
  return action.steps.every((_, i) => work[action.id]?.checked.includes(i));
}

export function growthContext(data) {
  const delta = data.current.visibility - data.previous.visibility;
  const leader = data.competitors[0];
  const self = data.competitors.find((c) => c.self);
  // Tied brands share the same rank.
  const rank =
    1 + data.competitors.filter((c) => c.share > (self?.share || 0)).length;
  return {
    delta,
    rank,
    leader,
    gaps: data.questions.filter((q) => q.samples > 0 && q.visibility < 40),
    conversion: data.current.referrals
      ? (data.current.leads / data.current.referrals) * 100
      : 0,
    summary:
      delta >= 0.5
        ? "Your visibility is growing."
        : delta <= -0.5
          ? "Your visibility has slipped."
          : "Your visibility is holding steady.",
  };
}
