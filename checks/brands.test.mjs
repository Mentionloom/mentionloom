import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ENGINES } from "../app/lib/data.js";

const root = resolve(import.meta.dirname, "..");

test("every monitored answer engine has a local SVG brand mark", async () => {
  assert.deepEqual(
    ENGINES.map((engine) => engine.id),
    [
      "chatgpt",
      "perplexity",
      "claude",
      "gemini",
      "google",
      "grok",
      "deepseek",
      "meta",
      "mistral",
    ],
  );
  for (const engine of ENGINES) {
    const svg = await readFile(
      resolve(root, `assets/brands/${engine.id}.svg`),
      "utf8",
    );
    assert.match(svg, /^<svg[^>]+viewBox=/);
    assert.ok(svg.includes("<path"), `${engine.name} must use a vector mark`);
    assert.ok(!svg.includes("<text"), `${engine.name} must not use typed text`);
  }
});

test("the landing page exposes its engine filters through local brand marks", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const visibleFilters = [...html.matchAll(/data-engine="([^"]+)"/g)]
    .map(([, id]) => id)
    .filter(Boolean);
  assert.ok(visibleFilters.length >= 5);
  for (const id of visibleFilters) {
    assert.ok(ENGINES.some((engine) => engine.id === id), `${id} must be a known engine`);
    assert.ok(html.includes(`/assets/brands/${id}.svg`));
  }
});
