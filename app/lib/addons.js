const catalogue = [
  {
    id: "brief-studio",
    name: "Brief Studio",
    icon: "file",
    access: "available",
    description: "Turn a visibility gap into a source-backed content brief.",
    watches: "Missing mentions and cited sources",
    creates: "A structured brief for one buyer question",
    needs: "Answer sampling",
  },
  {
    id: "competitor-watch",
    name: "Competitor Watch",
    icon: "eye",
    access: "available",
    description: "Know when another brand gains ground on questions you track.",
    watches: "Brand rankings by buyer question",
    creates: "A focused change alert with evidence",
    needs: "Answer sampling",
  },
  {
    id: "weekly-brief",
    name: "Weekly Brief",
    icon: "mail",
    access: "available",
    description: "Give your team one quiet summary of progress and next moves.",
    watches: "Visibility, traffic and shipped work",
    creates: "A Monday workspace digest",
    needs: "At least one active signal",
  },
  {
    id: "crawler-guard",
    name: "Crawler Guard",
    icon: "lock",
    access: "pilot",
    description: "Catch changes that block AI search crawlers from your site.",
    watches: "Verified crawler requests and access rules",
    creates: "An access-change alert",
    needs: "Server or CDN logs",
  },
  {
    id: "revenue-match",
    name: "Revenue Match",
    icon: "target",
    access: "pilot",
    description: "Connect attributed AI visits to qualified pipeline.",
    watches: "AI referral sessions and CRM outcomes",
    creates: "Pipeline by AI source and landing page",
    needs: "Analytics, conversions and CRM",
  },
];

const offers = {
  "brief-studio": { price: 19, category: "Content", headline: "Turn a missing mention into your next brief.", allowance: "10 briefs per month", benefits: ["Start with a buyer question where you are missing.", "Build an outline around the answers buyers need.", "Keep supporting sources beside each recommendation."], before: "Collect answer samples, copy sources, then piece together an outline.", after: "Open the question and review one brief with an outline and source map.", workflow: ["Choose a visibility gap", "Review the suggested outline", "Share the brief with your writer"] },
  "competitor-watch": { price: 29, category: "Monitoring", headline: "Catch a competitor gaining ground.", allowance: "5 competitors · 25 tracked questions", benefits: ["Follow changes across the questions you care about.", "Compare the same engines and sampling periods.", "Open the answer evidence behind a change."], before: "Recheck rankings and compare separate reports by hand.", after: "Review the changed questions together, with the answer evidence attached.", workflow: ["Choose competitors and questions", "Set a change threshold", "Review a focused alert"] },
  "weekly-brief": { price: 9, category: "Reporting", headline: "Bring the week’s changes to your team.", allowance: "1 workspace · 5 recipients", benefits: ["Bring visibility, visits and shipped work into one digest.", "Give each number a comparison with the previous week.", "Keep a clear next action beside the results."], before: "Pull metrics from different views and write the same update every Monday.", after: "Review a prepared digest and share the changes worth discussing.", workflow: ["Choose the signals to include", "Set recipients and delivery day", "Review the weekly digest"] },
  "crawler-guard": { price: 19, category: "Monitoring", headline: "Find access problems before they stay unnoticed.", allowance: "1 website · daily access checks", benefits: ["Review crawler access alongside your visibility data.", "Spot changed rules and blocked requests.", "Give your developer the affected route and evidence."], before: "Search logs after a visibility drop to find a possible access problem.", after: "Review an access-change alert with the affected crawler and route.", workflow: ["Connect server or CDN logs", "Choose the crawlers to monitor", "Review access changes"] },
  "revenue-match": { price: 39, category: "Attribution", headline: "See which AI visits turn into pipeline.", allowance: "1 workspace · 1 CRM connection", benefits: ["Match attributed sessions to known CRM outcomes.", "Compare qualified leads by AI source and landing page.", "Keep unmatched visits visible instead of guessing their value."], before: "Compare analytics exports with CRM records in a spreadsheet.", after: "Review matched leads by source, with the original visit attached.", workflow: ["Connect analytics and your CRM", "Define a qualified lead", "Review matched outcomes"] },
};
// Sample offers until commercial terms are approved. Supply a Stripe Payment Link
// only together with its matching price/allowance; then set samplePricing to false.
export const ADDONS = catalogue.map(addon => ({ ...addon, ...offers[addon.id], samplePricing: true, paymentLink: null }));
export const addonURL = id => `/app/addons/${encodeURIComponent(id)}/`;
export const addonFromPath = pathname => ADDONS.find(a => pathname === addonURL(a.id) || pathname === addonURL(a.id).slice(0, -1));
export function checkoutURL(addon) {
  if (!addon || addon.samplePricing || addon.access !== "available" || !addon.paymentLink) return null;
  try {
    const url = new URL(addon.paymentLink);
    return url.protocol === "https:" && url.hostname === "buy.stripe.com" && !url.username && !url.password && url.pathname.length > 1 ? url.href : null;
  } catch { return null; }
}

export function normalizeAddons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const addon of ADDONS) {
    const item = value[addon.id];
    if (!item || typeof item !== "object") continue;
    const state = ["active", "pilot"].includes(item.state) ? item.state : null;
    if (
      !state ||
      (addon.access === "available" && state !== "active") ||
      (addon.access === "pilot" && state !== "pilot")
    )
      continue;
    result[addon.id] = {
      state,
      addedAt:
        typeof item.addedAt === "string" &&
        Number.isFinite(Date.parse(item.addedAt))
          ? item.addedAt
          : null,
    };
  }
  return result;
}

export function setAddonState(
  current,
  id,
  state,
  now = new Date().toISOString(),
) {
  const addon = ADDONS.find((item) => item.id === id);
  if (!addon) return current;
  if (state === null) {
    const next = { ...current };
    delete next[id];
    return next;
  }
  const expected = addon.access === "pilot" ? "pilot" : "active";
  if (state !== expected) return current;
  return { ...current, [id]: { state, addedAt: now } };
}

export function addonCounts(state) {
  return ADDONS.reduce(
    (counts, addon) => {
      if (state[addon.id]?.state === "active") counts.active += 1;
      if (state[addon.id]?.state === "pilot") counts.pilots += 1;
      return counts;
    },
    {
      active: 0,
      pilots: 0,
      available: ADDONS.filter((addon) => addon.access === "available").length,
    },
  );
}

export function recommendedAddon(state) {
  return (
    ADDONS.find((addon) => addon.access === "available" && !state[addon.id]) ||
    ADDONS.find((addon) => !state[addon.id]) ||
    ADDONS[0]
  );
}
