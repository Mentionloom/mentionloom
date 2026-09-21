import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHandler } from "../api/waitlist.js";
import { memoryStore } from "../checks/memory-store.mjs";

const mock = process.argv.includes("--test-storage");
const handler = mock
  ? createHandler({
      store: memoryStore(),
      secret: () => "local-test-only-".repeat(4),
    })
  : createHandler();
const types = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  png: "image/png",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  txt: "text/plain",
};
const allowed = new Set([
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
  "app/index.html",
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
  "app/traffic.css",
  "app/lib/intelligence.js",
  "app/lib/ui.js",
  "app/lib/filters.js",
  "app/lib/charts.js",
  "site.js",
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
  "assets/woven-light.png",
  "assets/OpenRunde-Regular.woff2",
  "assets/OpenRunde-Medium.woff2",
  "assets/OpenRunde-Semibold.woff2",
  "assets/OFL.txt",
  "assets/Geist-Variable.woff2",
  "assets/SpaceGrotesk-Variable.woff2",
  "assets/Geist-LICENSE.txt",
]);
createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/waitlist") {
    let content = "";
    for await (const chunk of req) {
      content += chunk;
      if (Buffer.byteLength(content) > 4096) {
        res.writeHead(413).end();
        return;
      }
    }
    req.body = content;
    res.status = (status) => {
      res.statusCode = status;
      return res;
    };
    res.json = (body) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    await handler(req, res);
    return;
  }
  const file =
    pathname === "/"
      ? "index.html"
      : /^\/app(?:\/(?:overview|visibility|traffic|questions|opportunities|addons(?:\/[a-z-]+)?|sources))?\/?$/.test(
            pathname,
          )
        ? "app/index.html"
        : pathname.slice(1);
  if (
    !allowed.has(file) &&
    !/^assets\/(?:globe\.js|brands\/[a-z]+\.svg|icons\/lucide\.svg)$/.test(
      file,
    ) &&
    !/^app\/components\/orbit\/(?:[a-z0-9-]+\.(?:js|html|json)|runtime\/(?:[a-z-]+\.(?:js|css|html)|assets\/[A-Za-z0-9_.-]+))$/.test(
      file,
    )
  ) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    res.setHeader(
      "Content-Type",
      types[file.split(".").pop()] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.end(await readFile(new URL("../" + file, import.meta.url)));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(4323, "127.0.0.1", () =>
  console.log(
    `Mentionloom at http://127.0.0.1:4323 (${mock ? "isolated test storage; no production signups" : "connected private storage"})`,
  ),
);
