import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { VIEWS } from "./app/lib/navigation.js";
import { marketingAssets } from "./scripts/marketing-assets.mjs";

const output = new URL("./dist/", import.meta.url);
const files = [
  "index.html",
  "orbit-tokens.css",
  "site.css",
  "product-portal.css",
  "site.js",
  "app/index.html",
  "app/app.css",
  "app/pages.css",
  "app/growth.css",
  "app/addons.css",
  "app/lib/addons.js",
  "app/lib/addons-view.js",
  "app/lib/growth.js",
  "app/lib/growth-view.js",
  "app/lib/navigation.js",
  "app/app.js",
  "app/tokens.css",
  "app/foundation.css",
  "app/lib/data.js",
  "app/lib/model.js",
  "app/lib/ui.js",
  "app/lib/charts.js",

  "waitlist.css",
  "waitlist.js",
  "assets/mark.svg",
  "assets/woven-light.png",
  "assets/OpenRunde-Regular.woff2",
  "assets/OpenRunde-Medium.woff2",
  "assets/OpenRunde-Semibold.woff2",
  "assets/OFL.txt",
];

await rm(output, { recursive: true, force: true });
await mkdir(new URL("assets/", output), { recursive: true });
await mkdir(new URL("app/lib/", output), { recursive: true });
await Promise.all(
  files.map((file) =>
    copyFile(new URL(file, import.meta.url), new URL(file, output)),
  ),
);
await cp(
  new URL("./app/components/", import.meta.url),
  new URL("app/components/", output),
  { recursive: true },
);
await marketingAssets(output);
await cp(
  new URL("./assets/licenses/", import.meta.url),
  new URL("assets/licenses/", output),
  { recursive: true },
);
console.log(
  `Built ${files.length} application files and the complete installed Orbit source in dist/.`,
);

for (const page of Object.keys(VIEWS)) {
  await mkdir(new URL(`app/${page}/`, output), { recursive: true });
  await copyFile(
    new URL("app/index.html", import.meta.url),
    new URL(`app/${page}/index.html`, output),
  );
}
