import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, ENGINES } from "../app/lib/data.js";
import { select } from "../app/lib/model.js";
import {
  priorities,
  baselineFor,
  normalizeWork,
  startWork,
  checkStep,
  canShip,
  growthContext,
} from "../app/lib/growth.js";
const state = { days: 30, engine: "", topic: "", metric: "visibility" };
const data = select(state);
test("recommendations rank observed gaps, respect scope and retain started work", () => {
  const ranked = priorities(data);
  assert.equal(ranked[0].id, "a4");
  for (const item of ranked)
    assert.equal(
      item.missing,
      item.questionData.rows.filter((r) => !r.mention).length,
    );
  assert.ok(ranked[0].missing >= ranked[1].missing);
  const scoped = select({ ...state, topic: "Pricing", engine: "claude" });
  assert.ok(
    priorities(scoped).every((a) => a.questionData.topic === "Pricing"),
  );
  assert.equal(
    priorities(data, { a3: { startedAt: "2026-09-11" } }, [])[0].id,
    "a3",
  );
  assert.equal(
    priorities(data, { a3: { startedAt: "2026-09-11" } }, ["a3"])[0].id,
    "a4",
  );
  assert.ok(
    priorities(
      data,
      {},
      ACTIONS.map((a) => a.id),
    ).every((a) => a.completed),
  );
  assert.deepEqual(priorities(select({ ...state, topic: "Comparison" })), []);
  for (const question of growthContext(data).gaps)
    assert.ok(
      ACTIONS.some((action) => action.question === question.id),
      `${question.id} should lead to a concrete plan`,
    );
});
test("a saved baseline survives resuming under a different reporting scope", () => {
  const a = ACTIONS.find((a) => a.id === "a1"),
    baseline = baselineFor(a, data, state);
  const work = startWork({}, a, baseline, "2026-09-11T09:00:00Z");
  const filtered = { ...state, days: 7, engine: "gemini" };
  const resumed = startWork(
    work,
    a,
    baselineFor(a, select(filtered), filtered),
  );
  assert.equal(resumed, work);
  assert.equal(resumed.a1.baseline.samples, 30 * ENGINES.length);
  assert.equal(resumed.a1.baseline.engine, "");
  assert.equal(resumed.a1.baseline.start, data.start);
});
test("checklist completion gates shipping, supports undo and persists safely", () => {
  const a = ACTIONS.find((a) => a.id === "a1");
  let work = startWork(
    {},
    a,
    baselineFor(a, data, state),
    "2026-09-11T09:00:00Z",
  );
  assert.equal(canShip(a, work), false);
  work = checkStep(work, a, 0, true);
  work = checkStep(work, a, 0, true);
  assert.equal(work.a1.checked.length, 1);
  work = checkStep(work, a, 1, true);
  work = checkStep(work, a, 2, true);
  assert.equal(canShip(a, work), true);
  work = checkStep(work, a, 1, false);
  assert.equal(canShip(a, work), false);
  assert.deepEqual(normalizeWork(JSON.parse(JSON.stringify(work))), work);
  assert.deepEqual(normalizeWork(null), {});
  assert.deepEqual(
    normalizeWork({ a1: { startedAt: "invalid", checked: [0, 1, 2] } }),
    {},
  );
  assert.deepEqual(checkStep(work, a, 999, true), work);
});
test("overview rank and conversion use matching denominators and handle ties", () => {
  const c = growthContext(data);
  assert.equal(
    c.conversion,
    (data.current.leads / data.current.referrals) * 100,
  );
  assert.equal(
    c.rank,
    1 +
      data.competitors.filter((b) => b.share > data.current.visibility).length,
  );
  const tied = {
    ...data,
    competitors: [
      { name: "Acme", self: true, share: 50 },
      { name: "Other", share: 50 },
    ],
  };
  assert.equal(growthContext(tied).rank, 1);
});
