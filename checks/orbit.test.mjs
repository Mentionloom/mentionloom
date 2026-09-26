import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path));

test("the production build ships the complete installed Orbit runtime and font assets", async () => {
  execFileSync(process.execPath, ["build.mjs"], { cwd: root });
  const manifest = JSON.parse(await read("app/components/orbit/orbit.json"));
  assert.equal(manifest.version, "0.2.0");
  const runtime = "app/components/orbit/runtime";
  const entries = await readdir(resolve(root, runtime), {
    recursive: true,
    withFileTypes: true,
  });
  assert.ok(entries.some((entry) => entry.name === "OpenRunde-Regular.woff2"));
  for (const entry of entries.filter((entry) => entry.isFile())) {
    const path = resolve(entry.parentPath, entry.name).slice(root.length + 1);
    assert.deepEqual(
      await read(`dist/${path}`),
      await read(path),
      `${path} must reach production unchanged`,
    );
  }
  for (const page of [
    "overview",
    "visibility",
    "traffic",
    "questions",
    "opportunities",
    "addons",
    "sources",
  ]) {
    assert.deepEqual(
      await read(`dist/app/${page}/index.html`),
      await read("dist/app/index.html"),
      `${page} must load directly and after refresh`,
    );
  }
  const html = (await read("dist/app/index.html")).toString();
  assert.match(html, /\/app\/product\.js\?v=/);
  assert.doesNotMatch(html, /Acme|class="badge demo-badge"|data-demo/);
  const demo = (await read("dist/app/demo/index.html")).toString();
  assert.match(demo, /Acme/);
  for (const [, href] of html.matchAll(/<link\b[^>]*href="([^"]+)"/g)) {
    if (!href.startsWith("http"))
      await readFile(
        href.startsWith("/")
          ? resolve(root, "dist", href.slice(1).split("?")[0])
          : resolve(root, "dist/app", href.split("?")[0]),
      );
  }
});

test("auth and onboarding routes resolve to the authenticated product shell", async () => {
  for (const page of ["sign-in", "sign-up", "forgot-password", "reset-password", "onboarding"]) {
    const html = (await read(`dist/app/${page}/index.html`)).toString();
    assert.match(html, /launch-main/);
    assert.match(html, /\/app\/product\.js\?v=/);
  }
});

test("semantic text and focus colors remain readable on their actual light surfaces", async () => {
  const css =
    (await read("app/components/orbit/runtime/tokens.css")) +
    "\n" +
    (await read("app/tokens.css"));
  const tokens = Object.fromEntries(
    [...css.matchAll(/:root\s*\{([^}]+)\}/g)].flatMap(([, block]) =>
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
        ([, key, value]) => [key, value.trim()],
      ),
    ),
  );
  const value = (name) =>
    tokens[name].startsWith("var(")
      ? value(tokens[name].slice(4, -1))
      : tokens[name];
  const rgb = (name) => {
    let hex = value(name).slice(1);
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  };
  const luminance = (name) =>
    rgb(name)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (foreground, background) => {
    const a = luminance(foreground),
      b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const [foreground, backgrounds] of [
    ["--text", ["--surface", "--subtle"]],
    ["--muted", ["--surface", "--subtle"]],
    ["--success-text", ["--surface", "--gray-1", "--green-1"]],
    ["--danger-text", ["--surface", "--gray-1"]],
    ["--accent-text", ["--surface", "--purple-1"]],
  ])
    for (const background of backgrounds)
      assert.ok(
        contrast(foreground, background) >= 4.5,
        `${foreground} on ${background}`,
      );
  assert.ok(contrast("--focus-color", "--surface") >= 3);
  assert.ok(contrast("--border-control", "--subtle") >= 3);
  assert.ok(contrast("--chart-stroke", "--surface") >= 3);
});
