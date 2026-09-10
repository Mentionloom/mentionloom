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
