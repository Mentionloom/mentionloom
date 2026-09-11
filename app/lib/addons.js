export const ADDONS = [
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
    icon: "shield",
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
