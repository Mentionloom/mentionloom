import test from "node:test";
import assert from "node:assert/strict";
import {
  select,
  parseState,
  filterRecords,
  csv,
  dates,
} from "../app/lib/model.js";
import { answers, visits, QUESTIONS, ENGINES } from "../app/lib/data.js";
const base = { days: 30, engine: "", topic: "", metric: "visibility" };
test("periods contain complete, distinct comparison windows", () => {
  for (const days of [7, 30, 90]) {
    const d = select({ ...base, days });
    assert.equal(d.series.length, days);
    assert.equal(d.current.samples, days * QUESTIONS.length * ENGINES.length);
    assert.equal(d.series[0].date, dates(days).start);
    assert.equal(d.series.at(-1).date, dates(days).end);
    assert.ok(dates(days, true).end < dates(days).start);
    assert.equal(d.previous.samples, d.current.samples);
  }
});
test("engine and topic filters compose across answers, referrals and breakdowns", () => {
  const state = { ...base, engine: "claude", topic: "Pricing" },
    d = select(state);
  assert.equal(d.current.samples, 30 * 3);
  assert.ok(d.a.every((a) => a.engine === "claude" && a.topic === "Pricing"));
  assert.ok(d.v.every((v) => v.engine === "claude" && v.topic === "Pricing"));
  assert.equal(d.engines.length, 1);
  assert.equal(d.questions.length, 3);
  assert.equal(d.engines[0].referrals, d.current.referrals);
  assert.equal(d.engines[0].visibility, d.current.visibility);
});
test("totals equal daily records and denominators are honest", () => {
  for (const days of [7, 30, 90]) {
    const d = select({ ...base, days });
    for (const key of [
      "citations",
      "referrals",
      "leads",
      "mentions",
      "samples",
    ])
      assert.equal(
        d.series.reduce((s, r) => s + r[key], 0),
        d.current[key],
      );
    assert.equal(
      d.current.visibility,
      (d.current.mentions / d.current.samples) * 100,
    );
    assert.equal(
      d.pages.reduce((s, r) => s + r.citations, 0),
      d.current.citations,
    );
    assert.equal(
      d.engines.reduce((s, r) => s + r.referrals, 0),
      d.current.referrals,
    );
    assert.ok(
      d.current.leads <= d.current.engaged &&
        d.current.engaged <= d.current.referrals,
    );
  }
});
test("answer citations require a mention and lead events require engagement", () => {
  assert.ok(answers.every((a) => !a.cited || a.mention));
  assert.ok(visits.every((v) => !v.lead || v.engaged));
});
test("filtered previous period is distinct and applies the same scope", () => {
  const s = { ...base, engine: "chatgpt", topic: "Alternatives" },
    a = filterRecords(answers, s),
    p = filterRecords(answers, s, true);
  assert.equal(a.length, p.length);
  const ids = new Set(a.map((r) => r.id));
  assert.ok(
    p.every(
      (r) => !ids.has(r.id) && r.engine === s.engine && r.topic === s.topic,
    ),
  );
});
test("invalid URL parameters fall back to safe, supported values", () => {
  assert.deepEqual(
    parseState("?days=9000&engine=foo&topic=bar&metric=baz"),
    base,
  );
  assert.deepEqual(
    parseState("?days=90&engine=claude&topic=Pricing&metric=leads"),
    { days: 90, engine: "claude", topic: "Pricing", metric: "leads" },
  );
});
test("CSV correctly quotes fields, including multiline content", () => {
  assert.equal(csv([["One, two", 'a"b', "a\nb"]]), '"One, two","a""b","a\nb"');
});
