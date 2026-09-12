import test from "node:test";
import assert from "node:assert/strict";
import {
  select,
  parseState,
  filterRecords,
  csv,
  dates,
  citationSummary,
} from "../app/lib/model.js";
import { answers, visits, QUESTIONS, ENGINES } from "../app/lib/data.js";
import { recommendationEvidence } from "../app/lib/intelligence.js";
test("recommendation evidence separates mentions, shortlist positions, and distinct lost questions", () => {
  const rows = [
    { question: "a", mention: true, position: null, competitors: [], external: "source" },
    { question: "a", mention: true, position: 2, competitors: ["Other"], external: "source" },
    { question: "a", mention: false, position: null, competitors: ["Other"], external: "source" },
    { question: "a", mention: false, position: null, competitors: ["Other"], external: "source" },
    { question: "b", mention: false, position: null, competitors: [], external: "unrelated" },
  ];
  const e = recommendationEvidence(rows);
  assert.equal(e.share, 20);
  assert.equal(e.lostQuestions, 1);
  assert.equal(e.lostAnswers, 2);
  assert.deepEqual(e.sources, [{ name: "source", count: 2 }]);
  assert.deepEqual(e.competitors, [{ name: "Other", count: 2 }]);
  assert.equal(recommendationEvidence([]).share, 0);
});
const base = { days: 30, engine: "", topic: "", metric: "visibility" };
test("citation mix counts references separately from distinct page, question, and engine coverage", () => {
  const summary = citationSummary([
    { cited: true, page: "/pricing", question: "q1", engine: "chatgpt", external: "g2.com" },
    { cited: true, page: "/pricing", question: "q1", engine: "claude", external: "g2.com" },
    { cited: false, page: "/product", question: "q2", engine: "chatgpt", external: "reddit.com" },
  ]);
  assert.deepEqual(summary.own, { citations: 2, pages: 1, questions: 1, engines: 2 });
  assert.deepEqual(summary.external, { citations: 3, pages: 2, questions: 2, engines: 2 });
  assert.equal(summary.total, 5);
  assert.equal(summary.websiteShare, 40);
  assert.equal(summary.questions, 2);
  assert.equal(citationSummary([]).websiteShare, 0);
  assert.equal(citationSummary([{ cited: false, question: "q1", engine: "claude" }]).total, 0);
});
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

test("startup traffic includes real zero days and stays independent of answer sampling", () => {
  const data = select(base);
  assert.ok(data.current.referrals > 20 && data.current.referrals < 100);
  assert.ok(data.series.filter((day) => day.referrals === 0).length >= 5);
  assert.ok(Math.max(...data.series.map((day) => day.referrals)) <= 12);
  assert.ok(data.current.leads > 0 && data.current.leads <= 5);
  const noTraffic = select({ ...base, engine: "grok" });
  assert.equal(noTraffic.current.referrals, 0);
  assert.equal(noTraffic.current.leads, 0);
  assert.ok(noTraffic.current.samples > 0);
});
