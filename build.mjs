import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { ADDONS } from "./app/lib/addons.js";
import { VIEWS } from "./app/lib/navigation.js";
import { marketingAssets } from "./scripts/marketing-assets.mjs";

const output = new URL("./dist/", import.meta.url);

// Fail the deployment before publishing static assets if a browser entry point
// contains invalid JavaScript. The static-asset build copies these files verbatim,
// so syntax errors would otherwise deploy successfully and only fail in browsers.
for (const entry of ["site.js", "waitlist.js", "app/app.js", "app/product.js"]) {
  execFileSync(process.execPath, ["--check", new URL(entry, import.meta.url).pathname], {
    stdio: "inherit",
  });
}
const files = [
  "index.html",
  "alternative.html",
  "methodology.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "terms.html",
  "alternative.css",
  "alternative.js",
  "orbit-tokens.css",
  "site.css",
  "product-portal.css",
  "site.js",
  "app/index.html",
  "app/product.js",
  "app/launch-entry.css",
  "app/app.css",
  "app/pages.css",
  "app/growth.css",
  "app/addons.css",
  "app/density.css",
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
  "app/lib/traffic.js",
  "app/lib/traffic-view.js",
  "app/lib/intelligence.js",
  "app/lib/fluid-orb.js",
  "app/lib/ui.js",
  "app/lib/filters.js",
  "app/lib/charts.js",

  "waitlist.css",
  "waitlist.js",
  "assets/dark-ml.svg",
  "assets/blue-ml.svg",
  "assets/light-ml.svg",
  "assets/favicon.svg",
  "assets/logo.svg",
  "assets/mark.svg",
  "assets/ml-dark.svg",
  "assets/ml-blue.svg",
  "assets/ml-light.svg",
  "assets/ml-gradient.svg",
  "assets/square-ml-dark.svg",
  "assets/square-ml-blue.svg",
  "assets/square-ml-light.svg",
  "assets/dark.svg",
  "assets/blue.svg",
  "assets/light.svg",
  "assets/l-dark.svg",
  "assets/l-blue.svg",
  "assets/l-light.svg",
  "assets/icon-dark-light.svg",
  "assets/icon-blue-light.svg",
  "assets/icon-light-blue.svg",
  "assets/og.png",
  "assets/brands/acme.svg",
  "assets/flags/us.svg",
  "assets/flags/gb.svg",
  "assets/flags/sg.svg",
  "assets/flags/es.svg",
  "assets/flags/jp.svg",
  "assets/flags/br.svg",
  "assets/flags/au.svg",
  "assets/flags/de.svg",
  "assets/woven-light.png",
  "assets/OpenRunde-Regular.woff2",
  "assets/OpenRunde-Medium.woff2",
  "assets/OpenRunde-Semibold.woff2",
  "assets/Geist-Variable.woff2",
  "assets/SpaceGrotesk-Variable.woff2",
  "assets/Geist-LICENSE.txt",
  "assets/OFL.txt",
];

await rm(output, { recursive: true, force: true });
await mkdir(new URL("assets/brands/", output), { recursive: true });
await mkdir(new URL("assets/flags/", output), { recursive: true });
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

// Retain a static entry for bookmarked Sources URLs; the app routes it to Overview.
for (const page of [...Object.keys(VIEWS), "sources", "sign-in", "sign-up", "forgot-password", "reset-password", "onboarding", "addons"]) {
  await mkdir(new URL(`app/${page}/`, output), { recursive: true });
  await copyFile(
    new URL("app/index.html", import.meta.url),
    new URL(`app/${page}/index.html`, output),
  );
}

// The old interactive dashboard is retained as an explicitly labelled public demo.
await mkdir(new URL("app/demo/", output), { recursive: true });
await copyFile(new URL("app/demo.html", import.meta.url), new URL("app/demo/index.html", output));

for (const addon of ADDONS) {
  await mkdir(new URL(`app/addons/${addon.id}/`, output), { recursive: true });
  await copyFile(new URL("app/index.html", import.meta.url), new URL(`app/addons/${addon.id}/index.html`, output));
}

// Version the shared waitlist on every static route so Cloudflare/browser caches
// cannot combine a new modal with the old script or stylesheet after deployment.
const waitlistHash = createHash("sha256");
for (const file of ["waitlist.js", "waitlist.css"]) {
  waitlistHash.update(await readFile(new URL(file, output)));
}
const waitlistVersion = waitlistHash.digest("hex").slice(0, 12);
const launchHash = createHash("sha256");
for (const file of ["app/product.js", "app/launch-entry.css"]) {
  launchHash.update(await readFile(new URL(file, output)));
}
const launchVersion = launchHash.digest("hex").slice(0, 12);
const htmlFiles = [
  ...files.filter((file) => file.endsWith(".html")),
  ...[...Object.keys(VIEWS), "sources", "sign-in", "sign-up", "forgot-password", "reset-password", "onboarding", "addons"].map((page) => `app/${page}/index.html`),
  "app/demo/index.html",
  ...ADDONS.map((addon) => `app/addons/${addon.id}/index.html`),
];
for (const file of new Set(htmlFiles)) {
  const url = new URL(file, output);
  const html = await readFile(url, "utf8");
  const updated = html.replace(
    /((?:src|href)=["'])\/waitlist\.(css|js)(?:\?[^"']*)?(["'])/g,
    (_, prefix, extension, quote) => `${prefix}/waitlist.${extension}?v=${waitlistVersion}${quote}`,
  );
  const versionedLaunch = updated
    .replace(/(href=["'])\/app\/launch-entry\.css(?:\?[^"']*)?(["'])/g, `$1/app/launch-entry.css?v=${launchVersion}$2`)
    .replace(/(src=["'])\/app\/product\.js(?:\?[^"']*)?(["'])/g, `$1/app/product.js?v=${launchVersion}$2`);
  if (versionedLaunch !== html) await writeFile(url, versionedLaunch);
}
