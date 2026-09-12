// Product adapter for the installed Orbit 0.2 source runtime.
import {
  initialize,
  prepare,
  setTheme,
} from "../components/orbit/runtime/orbit.js";
export async function initializeOrbit() {
  setTheme("light");
  await initialize();
}
export async function enhance(root) {
  await prepare(root);
  // prepare enhances copied HTML. Its gallery specimen padding is not part of
  // this application's layout; keep the runtime's component marker and behavior.
  root.classList.remove("specimen-body");
}
export function openDialog(dialog) {
  window.OrbitMotion.showDialog(dialog);
}
export function closeDialog(dialog) {
  window.OrbitMotion.closeDialog(dialog);
}

export const paths = {
  arrow: "M7 17 17 7M7 7h10v10",
  right: "M5 12h14m-5-5 5 5-5 5",
  down: "m7 10 5 5 5-5",
  up: "m7 14 5-5 5 5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  filter: "M4 7h16M7 12h10m-7 5h4",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2",
  download: "M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  chart: "M4 19V5m0 14h16M7 13l4-4 4 3 5-7",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  layers: "m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  info: "M12 11v6m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  pause: "M8 5v14M16 5v14",
  play: "m8 4 12 8-12 8Z",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18",
  file: "M14 2H4v20h16V8Zm0 0v6h6M8 13h8m-8 4h6",
  target:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 12h.01",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-13a4 4 0 0 1 0 8m6 5v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  bolt: "m13 2-9 12h7l-1 8 10-12h-7Z",
  settings: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6",
  mail: "M3 5h18v14H3Zm0 0 9 7 9-7",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  chevrons: "m8 9 4-4 4 4m-8 6 4 4 4-4",
  table: "M3 3h18v18H3Zm0 6h18M9 3v18M3 15h18",
  copy: "M9 9h12v12H9ZM15 9V3H3v12h6",
  gpt: "M12 3a5 5 0 0 1 5 3 5 5 0 0 1 4 7 5 5 0 0 1-5 7 5 5 0 0 1-8 0 5 5 0 0 1-5-7 5 5 0 0 1 4-7 5 5 0 0 1 5-3Zm0 4 5 3v5l-5 3-5-3v-5Zm0 0v6l5 2M7 10l5 3v5",
  claude:
    "M12 2v20M2 12h20M5 5l14 14M5 19 19 5M8 3l8 18M3 8l18 8M3 16l18-8M8 21l8-18",
  perplexity: "M12 2v20M4 5l16 14V5L4 19Zm0 3h16v8H4Z",
  gemini: "M12 2c0 6-4 10-10 10 6 0 10 4 10 10 0-6 4-10 10-10-6 0-10-4-10-10Z",
};
// Interface glyphs use Orbit's bundled Lucide icons. Engine marks and the few
// domain glyphs absent from its catalog share the same SVG sizing/stroke contract.
const iconAliases = {
  arrow: "external",
  right: "arrow",
  close: "x",
  filter: "sliders",
  table: "grid",
  chevrons: "down",
  spark: "star",
};
const orbitIcons = new Set(
  "grid palette chevron down external sun moon download search x copy plus code cursor type check circlecheck sliders chart layers bell layout list heart star link more mail lock arrow smile gauge funnel settings globe info folder trash edit upload chat send calendar minus eye eye-off clock file list-todo terminal bot rotate-ccw square paperclip image external-link thumbs-up circle".split(
    " ",
  ),
);
export const icon = (name, cls = "") => {
  const mapped = iconAliases[name] || name;
  if (window.OrbitIcon && orbitIcons.has(mapped))
    return window
      .OrbitIcon(mapped)
      .replace('class="icon lucide', 'class="icon lucide ' + cls);
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
};
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const engineIcon = (e) =>
  `<span class="engine-icon ${e.color}"><img src="/assets/brands/${e.id}.svg" width="20" height="20" alt=""></span>`;
export const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export function animate(el, frames, duration, extra = {}) {
  const timing =
    duration ??
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--motion-medium",
      ),
    );
  return window.OrbitMotion?.animate(el, frames, timing, extra);
}
export function number(el, value) {
  const percent = value.endsWith("%"),
    numeric = Number(value.replace(/[,％%]/g, ""));
  window.OrbitNumbers.set(el, percent ? numeric / 100 : numeric, {
    kind: percent ? "percent" : "number",
  });
}
let toastTimer;
export function toast(text) {
  const el = document.querySelector("#app-toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
}
export function segment(group, key) {
  group.querySelectorAll("button").forEach((b) => {
    const selected = b.dataset.value === key;
    b.classList.toggle("active", selected);
    b.setAttribute("aria-pressed", String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  requestAnimationFrame(() => window.OrbitMotion.indicator(group, true));
}
export function installMenus() {
  document.querySelectorAll("[data-menu]").forEach((trigger) => {
    const panel = document.getElementById(trigger.dataset.menu),
      wrapper = document.createElement("div");
    wrapper.className = "dropdown ds-select";
    trigger.before(wrapper);
    wrapper.append(trigger, panel);
    trigger.classList.add("control-trigger");
    trigger.setAttribute("data-select-toggle", "");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-controls", panel.id);
    let label = trigger.querySelector("#period-label,#engine-label,#traffic-source-label,#country-label,#device-label");
    if (!label) {
      label = document.createElement("span");
      const text = [...trigger.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join("")
        .trim();
      label.textContent = text || "Acme";
      [...trigger.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .forEach((n) => n.remove());
      if (trigger.dataset.menu === "workspace-menu")
        trigger.insertBefore(
          label,
          trigger.querySelector('[data-app-icon="chevrons"]'),
        );
      else trigger.append(label);
      if (trigger.dataset.menu === "topic-menu") label.id = "topic-label";
    }
    label.setAttribute("data-select-label", "");
    panel.classList.add("dropdown-panel", "control-panel");
    panel.removeAttribute("popover");
    panel.hidden = true;
    panel.setAttribute("role", "listbox");
    panel.setAttribute(
      "aria-label",
      {
        "period-menu": "Reporting period",
        "traffic-source-menu": "Traffic source",
        "country-menu": "Country",
        "device-menu": "Device",
        "engine-menu": "AI engine",
        "topic-menu": "Buyer intent",
        "workspace-menu": "Workspace",
      }[panel.id],
    );
    if (trigger.dataset.menu === "workspace-menu") {
      wrapper.className = "dropdown";
      trigger.removeAttribute("data-select-toggle");
      trigger.setAttribute("data-menu-toggle", "");
      trigger.setAttribute("aria-haspopup", "menu");
      panel.classList.remove("control-panel");
      panel.setAttribute("role", "menu");
      panel
        .querySelectorAll("button")
        .forEach((b) => b.setAttribute("role", "menuitem"));
      wrapper.addEventListener("focusout", () =>
        queueMicrotask(() => {
          if (!wrapper.contains(document.activeElement)) {
            trigger.setAttribute("aria-expanded", "false");
            window.OrbitMotion.visibility(panel, false);
          }
        }),
      );
      return;
    }
    // The listbox's title and explanation belong outside the selectable options.
    panel
      .querySelectorAll(".menu-label,.menu-note")
      .forEach((note) => note.setAttribute("role", "presentation"));
    panel.querySelectorAll(":scope>button").forEach((b) => {
      b.setAttribute("role", "option");
      b.setAttribute(
        "aria-selected",
        b.getAttribute("aria-selected") ||
          b.getAttribute("aria-pressed") ||
          "false",
      );
      b.removeAttribute("aria-pressed");
      b.dataset.option = b.textContent.trim();
    });
    void enhance(wrapper);
  });
}
export function closeMenus() {
  document
    .querySelectorAll(".dropdown>.dropdown-panel:not([hidden])")
    .forEach((p) => {
      p.previousElementSibling.setAttribute("aria-expanded", "false");
      window.OrbitMotion.visibility(p, false);
      p.previousElementSibling.focus({ preventScroll: true });
    });
}
export function download(name, content, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function store(key, value) {
  try {
    localStorage.setItem("mentionloom:" + key, JSON.stringify(value));
    return true;
  } catch {
    toast("Your browser could not save this change.");
    return false;
  }
}
export function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem("mentionloom:" + key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
