import test from "node:test";
import assert from "node:assert/strict";
import {
  VIEWS,
  resolveView,
  metricForView,
  pageURL,
} from "../app/lib/navigation.js";
import { parseState } from "../app/lib/model.js";
test("legacy marketing and dashboard links open their intended page", () => {
  assert.equal(
    resolveView({
      pathname: "/app/",
      search: "?metric=referrals",
      hash: "#actions",
    }),
    "opportunities",
  );
  assert.equal(
    resolveView({ pathname: "/app/", hash: "#questions" }),
    "questions",
  );
  assert.equal(resolveView({ pathname: "/app/", hash: "#sources" }), "sources");
  assert.equal(
    resolveView({ pathname: "/app/", search: "?metric=referrals" }),
    "traffic",
  );
  assert.equal(resolveView({ pathname: "/app/" }), "overview");
  assert.equal(resolveView({ pathname: "/app/no-such-view/" }), "overview");
  for (const page of Object.keys(VIEWS))
    assert.equal(
      resolveView({ pathname: `/app/${page}/`, hash: "#questions" }),
      page,
    );
});
test("page links preserve analysis scope and choose valid page metrics", () => {
  for (const view of Object.keys(VIEWS)) {
    const input = {
      days: 90,
      engine: "claude",
      topic: "Alternatives",
      metric: "leads",
    };
    const url = new URL(pageURL(view, input), "https://mentionloom.vercel.app");
    const restored = parseState(url.search);
    assert.equal(resolveView(url), view);
    assert.equal(restored.days, input.days);
    assert.equal(restored.engine, input.engine);
    assert.equal(restored.topic, input.topic);
    assert.equal(
      restored.metric,
      view === "visibility" ? "visibility" : "leads",
    );
  }
  assert.equal(metricForView("traffic", "citations"), "referrals");
  assert.equal(metricForView("visibility", "citations"), "citations");
  assert.equal(pageURL("invalid", {}), "/app/overview/");
});
