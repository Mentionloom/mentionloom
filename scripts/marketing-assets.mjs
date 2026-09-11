import { readFile, writeFile, mkdir } from "node:fs/promises";
import icons from "@iconify-json/simple-icons/icons.json" with { type: "json" };
import { build } from "esbuild";
const root = new URL("../", import.meta.url);
export async function marketingAssets(output = root) {
  await mkdir(new URL("assets/brands/", output), { recursive: true });
  await mkdir(new URL("assets/icons/", output), { recursive: true });
  for (const [file, id] of Object.entries({
    chatgpt: "openai",
    claude: "claude",
    perplexity: "perplexity",
    gemini: "googlegemini",
    google: "google",
    deepseek: "deepseek",
    meta: "metaai",
    mistral: "mistralai",
    asana: "asana",
    notion: "notion",
    clickup: "clickup",
  })) {
    const i = icons.icons[id];
    await writeFile(
      new URL(`assets/brands/${file}.svg`, output),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${i.width || icons.width} ${i.height || icons.height}" fill="#181925">${i.body.replaceAll("currentColor", "#181925")}</svg>`,
    );
  }
  // Grok is sourced from the compact mark rendered by Grok's official web app.
  // xAI provides the same mark in its downloadable brand pack; Simple Icons does
  // not currently include it. Keep both paths and proportions unchanged.
  await writeFile(
    new URL("assets/brands/grok.svg", output),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 33" fill="none" color="#181925"><path d="M13.2371 21.0407L24.3186 12.8506C24.8619 12.4491 25.6384 12.6057 25.8973 13.2294C27.2597 16.5185 26.651 20.4712 23.9403 23.1851C21.2297 25.8989 17.4581 26.4941 14.0108 25.1386L10.2449 26.8843C15.6463 30.5806 22.2053 29.6665 26.304 25.5601C29.5551 22.3051 30.562 17.8683 29.6205 13.8673L29.629 13.8758C28.2637 7.99809 29.9647 5.64871 33.449 0.844576C33.5314 0.730667 33.6139 0.616757 33.6964 0.5L29.1113 5.09055V5.07631L13.2343 21.0436" fill="currentColor"/><path d="M10.9503 23.0313C7.07343 19.3235 7.74185 13.5853 11.0498 10.2763C13.4959 7.82722 17.5036 6.82767 21.0021 8.2971L24.7595 6.55998C24.0826 6.07017 23.215 5.54334 22.2195 5.17313C17.7198 3.31926 12.3326 4.24192 8.67479 7.90126C5.15635 11.4239 4.0499 16.8403 5.94992 21.4622C7.36924 24.9165 5.04257 27.3598 2.69884 29.826C1.86829 30.7002 1.0349 31.5745 0.36364 32.5L10.9474 23.0341" fill="currentColor"/></svg>`,
  );
  const names = {
    arrow: "arrow-right",
    external: "arrow-up-right",
    down: "chevron-down",
    check: "check",
    close: "x",
    chat: "messages-square",
    wave: "chart-no-axes-combined",
    spark: "sparkles",
    globe: "globe-2",
    play: "play",
    pause: "pause",
    target: "scan-eye",
    file: "file-text",
    filter: "sliders-horizontal",
    search: "search",
    link: "link",
    clock: "clock-3",
    layers: "layers",
    shield: "shield-check",
    chevron: "chevron-right",
    plus: "plus",
    flag: "flag",
    circlecheck: "circle-check",
    mouse: "mouse-pointer-2",
  };
  const symbols = [];
  for (const [id, name] of Object.entries(names)) {
    const source = await readFile(
      new URL(`node_modules/lucide-static/icons/${name}.svg`, root),
      "utf8",
    );
    symbols.push(
      `<symbol id="i-${id}" viewBox="0 0 24 24">${source.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "")}</symbol>`,
    );
  }
  await writeFile(
    new URL("assets/icons/lucide.svg", output),
    `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`,
  );
  await build({
    entryPoints: [new URL("marketing/globe.js", root).pathname],
    outfile: new URL("assets/globe.js", output).pathname,
    bundle: true,
    format: "esm",
    minify: true,
    target: "es2022",
    legalComments: "eof",
  });
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  await marketingAssets();
