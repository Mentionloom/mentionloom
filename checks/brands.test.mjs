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

test("the landing page exposes every engine through a named control", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  for (const engine of ENGINES) {
    assert.ok(html.includes(`data-engine="${engine.id}"`));
    assert.ok(html.includes(`/assets/brands/${engine.id}.svg`));
  }
});
