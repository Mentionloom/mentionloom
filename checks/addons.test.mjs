import test from "node:test";
import assert from "node:assert/strict";
import {
  ADDONS,
  normalizeAddons,
  setAddonState,
  addonCounts,
  recommendedAddon,
} from "../app/lib/addons.js";

test("add-ons have a distinct signal contract", () => {
  assert.equal(new Set(ADDONS.map((addon) => addon.id)).size, ADDONS.length);
  assert.ok(ADDONS.length >= 5);
  for (const addon of ADDONS) {
    assert.ok(addon.watches.length > 5);
    assert.ok(addon.creates.length > 5);
    assert.ok(addon.needs.length > 5);
    assert.ok(["available", "pilot"].includes(addon.access));
  }
});

test("activation respects available and pilot access", () => {
  const active = setAddonState({}, "brief-studio", "active", "2026-09-11T10:00:00.000Z");
  assert.equal(active["brief-studio"].state, "active");
  assert.equal(setAddonState(active, "crawler-guard", "active"), active);
  const pilot = setAddonState(active, "crawler-guard", "pilot", "2026-09-11T10:00:00.000Z");
  assert.equal(pilot["crawler-guard"].state, "pilot");
  assert.deepEqual(addonCounts(pilot), { active: 1, pilots: 1, available: 3 });
  assert.equal(recommendedAddon(pilot).id, "competitor-watch");
});

test("stored add-on state is normalized and removable", () => {
  const normalized = normalizeAddons({
    "brief-studio": { state: "active", addedAt: "2026-09-11T10:00:00.000Z" },
    "competitor-watch": { state: "pilot" },
    "crawler-guard": { state: "pilot", addedAt: "invalid" },
    unknown: { state: "active" },
  });
  assert.deepEqual(Object.keys(normalized), ["brief-studio", "crawler-guard"]);
  assert.equal(normalized["crawler-guard"].addedAt, null);
  assert.deepEqual(setAddonState(normalized, "brief-studio", null), {
    "crawler-guard": { state: "pilot", addedAt: null },
  });
});
