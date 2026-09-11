import { ENGINES, QUESTIONS, TOPICS, ACTIONS, CRAWLERS } from "./lib/data.js";
import { select, parseState, fmt, pct, csv } from "./lib/model.js";
import {
  icon,
  engineIcon,
  escape as esc,
  number,
  animate,
  installMenus,
  closeMenus,
  toast,
  download,
  store,
  load,
  initializeOrbit,
  enhance,
  openDialog,
  closeDialog,
} from "./lib/ui.js";
import { renderChart, sparkline, LABELS } from "./lib/charts.js";
import {
  priorities,
  baselineFor,
  normalizeWork,
  startWork,
  checkStep,
  canShip,
  growthContext,
} from "./lib/growth.js";
import {
  nextMoveHTML,
  journeyHTML,
  competitorHTML,
  workbenchHTML,
  reviewHTML,
} from "./lib/growth-view.js";
import {
  ADDONS,
  normalizeAddons,
  setAddonState,
  addonCounts,
  recommendedAddon,
} from "./lib/addons.js";
import { addonRowHTML, addonDetailHTML } from "./lib/addons-view.js";

import {
  VIEWS,
  resolveView,
  metricForView,
  pageURL,
} from "./lib/navigation.js";

const $ = (s) => document.querySelector(s);
const state = parseState(location.search);
let currentView = resolveView(location);
state.metric = metricForView(currentView, state.metric);
let data,
  engineView = "visibility",
  pageView = "own",
  questionView = "all",
  actionView = "todo",
  showAll = false,
  sortAscending = true;
let shipped = load("shipped", []);
if (!Array.isArray(shipped)) shipped = [];
shipped = shipped.filter((id) => ACTIONS.some((a) => a.id === id));
let pending = load("questions", []);
if (!Array.isArray(pending)) pending = [];
pending = pending
  .filter(
    (q) =>
      q &&
      typeof q.id === "string" &&
      typeof q.text === "string" &&
      TOPICS.includes(q.topic),
  )
  .slice(0, 100);
let growthWork = normalizeWork(load("growth-work", {}));
let addonState = normalizeAddons(load("addons", {}));
let detailHistory = [];
const date = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const engine = (id) => ENGINES.find((e) => e.id === id);
const format = (n, k) => (k === "visibility" ? pct(n) : fmt(n));
function hydrate(root = document) {
  root
    .querySelectorAll("[data-app-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.appIcon)));
}
function syncURL() {
  history.replaceState(null, "", pageURL(currentView, state));
  syncPageLinks();
}
function syncPageLinks() {
  document
    .querySelectorAll("[data-route]")
    .forEach((link) => (link.href = pageURL(link.dataset.route, state)));
}
function selectValue(root, value) {
  const options = [...root.querySelectorAll("[data-value]")];
  for (const option of options)
    option.setAttribute(
      "aria-selected",
      String(option.dataset.value === value),
    );
  const selected = options.find((option) => option.dataset.value === value);
  const label = selected?.dataset.option || "";
  root.querySelector("[data-select-label]").textContent = label;
  const toggle = root.querySelector("[data-select-toggle]");
  toggle.dataset.selectName ||= toggle.getAttribute("aria-label");
  toggle.setAttribute("aria-label", `${toggle.dataset.selectName}: ${label}`);
}
function showPage({ focus = false } = {}) {
  document.body.dataset.currentView = currentView;
  document.title = `${VIEWS[currentView]} · Acme · Mentionloom`;
  $("#page-title").textContent = VIEWS[currentView];
  $("#page-context").textContent = {
    overview: "Your position today. Your next move forward.",
    visibility: "See where AI recommends you—and who appears alongside you.",
    traffic: "From an AI recommendation to a visit that matters.",
    questions: "Find the buyer questions where your brand is missing.",
    opportunities: "Turn the evidence into improvements you can ship.",
    addons: "Add focused instruments when your workflow needs them.",
    sources: "Connect the signals behind your growth.",
  }[currentView];
  $("#next-move").hidden = currentView !== "overview";
  $("#overview-next").hidden = currentView !== "overview";
  $("#page-export").hidden = ["sources", "overview", "addons"].includes(
    currentView,
  );
  $("#growth-path").hidden = !["overview", "opportunities"].includes(
    currentView,
  );
  document
    .querySelectorAll("[data-route-view]")
    .forEach((view) => (view.hidden = view.dataset.routeView !== currentView));
  $("#report-core").hidden = !["overview", "visibility", "traffic"].includes(
    currentView,
  );
  $("#global-filters").hidden = ["sources", "addons"].includes(currentView);

  $("#page-add-question").hidden = currentView !== "questions";
  $("#page-setup").hidden = currentView !== "sources";
  document
    .querySelectorAll("[data-metric]")
    .forEach(
      (button) =>
        (button.hidden =
          currentView === "visibility"
            ? !["visibility", "citations"].includes(button.dataset.metric)
            : currentView === "traffic"
              ? !["referrals", "leads"].includes(button.dataset.metric)
              : false),
    );
  document.querySelectorAll(".page-navigation [data-route]").forEach((link) => {
    const active = link.dataset.route === currentView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  syncPageLinks();
  document
    .querySelector('.page-navigation [aria-current="page"]')
    ?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  if (focus) $("#page-title").focus({ preventScroll: true });
}
function navigate(view, { replace = false } = {}) {
  currentView = Object.hasOwn(VIEWS, view) ? view : "overview";
  state.metric = metricForView(currentView, state.metric);
  closeMenus();
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  history[replace ? "replaceState" : "pushState"](
    null,
    "",
    pageURL(currentView, state),
  );
  showPage({ focus: true });
  window.scrollTo({ top: 0, behavior: "instant" });
  render();
  animate(
    $("#main"),
    [
      { opacity: 0.45, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    180,
  );
}
function update(patch) {
  const previousFocus = document.activeElement;
  Object.assign(state, patch);
  syncURL();
  render();
  if (previousFocus && !previousFocus.isConnected) {
    const menu =
      "engine" in patch
        ? "engine-menu"
        : "topic" in patch
          ? "topic-menu"
          : "period-menu";
    $(`[data-menu="${menu}"]`).focus({ preventScroll: true });
  }
  $("#filter-status").textContent =
    `Showing ${state.days} days, ${state.engine ? engine(state.engine).name : "all engines"}, ${state.topic || "all topics"}. ${fmt(data.current.samples)} sampled answers.`;
}
function render() {
  data = select(state);
  $("#period-label").textContent = `Last ${state.days} days`;
  $("#engine-label").textContent = state.engine
    ? engine(state.engine).name
    : "All engines";
  $("#topic-label").textContent = state.topic || "Add filter";
  $("#date-label").textContent =
    `${date(data.start)} – ${date(data.end)}, 2026`;
  $("#filter-chips").innerHTML =
    (state.engine
      ? `<button class="filter-chip" data-clear="engine">Engine is ${engine(state.engine).name}${icon("close")}</button>`
      : "") +
    (state.topic
      ? `<button class="filter-chip" data-clear="topic">Topic is ${esc(state.topic)}${icon("close")}</button>`
      : "") +
    (state.engine || state.topic
      ? '<button class="text-button" data-action="clear-filters">Clear all</button>'
      : "");
  document.querySelectorAll("[data-days]").forEach((b) => {
    b.setAttribute(
      "aria-selected",
      String(Number(b.dataset.days) === state.days),
    );
    b.querySelector(".option-check").innerHTML =
      Number(b.dataset.days) === state.days ? icon("check") : "";
  });
  $("#engine-menu").innerHTML =
    '<span class="menu-label">AI engine</span>' +
    [{ id: "", name: "All engines" }, ...ENGINES]
      .map(
        (e) =>
          `<button role="option" data-option="${e.name}" data-engine="${e.id}" aria-selected="${state.engine === e.id}">${e.id ? engineIcon(e) : icon("spark")}<span>${e.name}</span><span class="option-check">${state.engine === e.id ? icon("check") : ""}</span></button>`,
      )
      .join("");
  $("#topic-menu").innerHTML =
    '<span class="menu-label">Filter by buyer intent</span>' +
    ["", ...TOPICS]
      .map(
        (t) =>
          `<button role="option" data-option="${t || "All topics"}" data-topic="${t}" aria-selected="${state.topic === t}">${icon(t ? "target" : "layers")}<span>${t || "All topics"}</span><span class="option-check">${state.topic === t ? icon("check") : ""}</span></button>`,
      )
      .join("") +
    '<div class="menu-note">Topics connect tracked answers with their related landing pages.</div>';
  for (const key of Object.keys(LABELS)) {
    number($("#value-" + key), format(data.current[key], key));
    const before = data.previous[key],
      diff =
        key === "visibility"
          ? data.current[key] - before
          : before
            ? ((data.current[key] - before) / before) * 100
            : 0;
    $("#delta-" + key).innerHTML =
      `<b class="${diff < 0 ? "negative" : ""}">${diff >= 0 ? "↗" : "↘"} ${Math.abs(diff).toFixed(1)}${key === "visibility" ? " pp" : "%"}</b> vs. prior ${state.days}d`;
    $("#delta-" + key).title = `Change versus the previous ${state.days} days`;
    const b = $(`[data-metric="${key}"]`);
    b.classList.toggle(
      "active",
      currentView !== "overview" && state.metric === key,
    );
    if (currentView === "overview") b.removeAttribute("aria-pressed");
    else b.setAttribute("aria-pressed", String(state.metric === key));
    sparkline(
      $(`[data-spark="${key}"]`),
      data.series.map((d) => d[key]),
    );
  }
  renderMainChart();
  renderEngines();
  renderCompetitors();
  renderPages();
  renderFunnel();
  renderQuestions();
  renderActions();
  renderPageSummaries();
  renderGrowth();
  renderAddons();
}
function renderMainChart() {
  if ($("#report-core").hidden) return;
  $("#chart-description").textContent =
    {
      visibility: "Mention rate",
      citations: "Website citations",
      referrals: "AI referrals",
      leads: "Leads",
    }[state.metric] + (state.days === 90 ? " · grouped every 3 days" : "");
  $("#chart-context").textContent =
    state.metric === "visibility"
      ? growthContext(data).summary
      : state.metric === "citations"
        ? "Answers that link to your website"
        : state.metric === "referrals"
          ? "Sessions attributed to AI sources"
          : "Conversions from attributed AI sessions";
  $("#chart-legend").textContent = LABELS[state.metric];
  $("#sample-count").textContent =
    state.metric === "visibility" || state.metric === "citations"
      ? `${fmt(data.current.samples)} sampled answers`
      : `${fmt(data.current.referrals)} attributed sessions`;
  renderChart(
    $("#main-chart"),
    data.series,
    state.metric,
    $("#compare-toggle").checked,
    openDay,
  );
}
function renderEngines() {
  selectValue($("#engine-tabs"), engineView);
  $("#engine-unit").textContent =
    engineView === "visibility" ? "Mention rate" : "Sessions";
  const max =
    engineView === "visibility"
      ? 100
      : Math.max(...data.engines.map((e) => e.referrals), 1);
  $("#engine-rows").innerHTML = data.engines
    .slice()
    .sort((a, b) => b[engineView] - a[engineView])
    .map(
      (e) =>
        `<button class="rank-row ${state.engine === e.id ? "self" : ""}" data-engine="${e.id}" style="--share:${(e[engineView] / max) * 100}%">${engineIcon(e)}<span class="rank-name">${e.name}</span><span class="rank-value">${format(e[engineView], engineView)}</span>${icon("filter")}</button>`,
    )
    .join("");
}
function renderCompetitors() {
  $("#competitor-rows").innerHTML = data.competitors
    .map(
      (c, i) =>
        `<button class="rank-row ${c.self ? "self" : ""}" data-competitor="${esc(c.name)}" style="--share:${c.share}%"><span class="rank-index">${i + 1}</span><span class="brand-initial ${c.self ? "self" : ""}">${c.self ? "a" : c.name.slice(0, 1)}</span><span class="rank-name">${c.name}${c.self ? ' <span class="badge">You</span>' : ""}</span><span class="rank-value">${pct(c.share)}</span>${icon("arrow")}</button>`,
    )
    .join("");
}
function renderPages() {
  selectValue($("#page-tabs"), pageView);
  const pages = pageView === "own" ? data.pages : data.external,
    max = Math.max(...pages.map((p) => p.citations), 1);
  $("#page-rows").innerHTML =
    pages
      .slice(0, 5)
      .map(
        (p) =>
          `<button class="rank-row" data-source-page="${esc(p.path)}" style="--share:${(p.citations / max) * 88}%">${icon(pageView === "own" ? "file" : "globe")}<span class="rank-name">${esc(p.path)}</span><span class="rank-value">${fmt(p.citations)}</span>${icon("arrow")}</button>`,
      )
      .join("") ||
    empty("No citations in this view", "Try a different engine or topic.");
  $("#pages-total").textContent = `${pages.length} sources`;
}
function renderFunnel() {
  const c = data.current;
  $("#funnel").innerHTML =
    [
      ["referrals", "AI referrals", "people"],
      ["engaged", "Engaged visits", "chart"],
      ["leads", "Leads created", "target"],
    ]
      .map(
        ([key, label, symbol]) =>
          `<div class="funnel-step"><div class="funnel-label"><span>${icon(symbol)}${label}</span><strong>${fmt(c[key])}</strong></div><div class="funnel-track"><span style="width:${c.referrals ? (c[key] / c.referrals) * 100 : 0}%"></span></div></div>`,
      )
      .join("") +
    `<div class="funnel-rates"><span><b>${pct(c.referrals ? (c.engaged / c.referrals) * 100 : 0)}</b> engagement rate</span><span><b>${pct(c.referrals ? (c.leads / c.referrals) * 100 : 0)}</b> lead conversion</span></div>`;
  $("#funnel")
    .querySelectorAll(".funnel-track>span")
    .forEach((el) =>
      animate(
        el,
        [{ transform: "scaleX(.9)" }, { transform: "scaleX(1)" }],
        400,
      ),
    );
}
function renderQuestions() {
  selectValue($("#question-tabs"), questionView);
  const query = $("#question-search").value.toLowerCase();
  let qs = [
    ...data.questions,
    ...pending
      .filter((q) => !state.topic || q.topic === state.topic)
      .map((q) => ({ ...q, pending: true, visibility: -1 })),
  ];
  $("#q-nav-count").textContent = QUESTIONS.length + pending.length;
  qs = qs
    .filter(
      (q) =>
        (!query || (q.text + " " + q.topic).toLowerCase().includes(query)) &&
        (questionView === "all" ||
          (questionView === "opportunity" && !q.pending && q.visibility < 40) ||
          (questionView === "strong" && !q.pending && q.visibility >= 60)),
    )
    .sort((a, b) => (a.visibility - b.visibility) * (sortAscending ? 1 : -1));
  const visible = showAll ? qs : qs.slice(0, 6);
  $("#question-rows").innerHTML = visible.length
    ? visible
        .map(
          (q) =>
            `<tr><td><button class="question-link" data-question="${esc(q.id)}">${esc(q.text)}</button></td><td><span class="badge neutral">${esc(q.topic)}</span></td><td>${q.pending ? '<span class="small-label">Pending</span>' : pct(q.visibility)}</td><td>${q.pending ? '<span class="small-label">No samples</span>' : engineCoverage(q)}</td><td><button class="icon-button" data-question="${esc(q.id)}" aria-label="Explore ${esc(q.text)}">${icon("right")}</button></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">${empty("No questions match this view", "Try another search or change the coverage filter.")}</td></tr>`;
  $("#questions-count").textContent =
    `Showing ${visible.length} of ${qs.length} questions`;
  $("#more-questions").hidden = qs.length <= 6;
  $("#more-questions").innerHTML =
    (showAll ? "Show fewer" : "Show all " + qs.length + " questions") +
    icon(showAll ? "up" : "down");
  $("#sort-questions").innerHTML =
    "Mention rate" + icon(sortAscending ? "down" : "up");
  $("#sort-questions")
    .closest("th")
    .setAttribute("aria-sort", sortAscending ? "ascending" : "descending");
}
function renderActions() {
  selectValue($("#action-tabs"), actionView);
  $("#action-count").textContent = ACTIONS.filter(
    (a) => !shipped.includes(a.id),
  ).length;
  const actions = priorities(data, growthWork, shipped).filter((a) =>
    actionView === "shipped" ? shipped.includes(a.id) : !shipped.includes(a.id),
  );
  $("#action-cards").innerHTML = actions.length
    ? actions
        .map(
          (a) =>
            `<button class="opportunity-row" data-improvement="${a.id}"><span class="opportunity-name"><strong>${a.title}</strong><small>${a.path}</small></span><span class="opportunity-rate"><strong>${pct(data.questions.find((q) => q.id === a.question)?.visibility || 0)}</strong><small>mention rate</small></span><span class="opportunity-effort">${icon("clock")}${a.effort}</span><span class="badge ${shipped.includes(a.id) ? "green" : "neutral"}">${shipped.includes(a.id) ? "Shipped" : growthWork[a.id] ? `${growthWork[a.id].checked.length}/3 complete` : "To do"}</span>${icon("right")}</button>`,
        )
        .join("")
    : empty(
        actionView === "shipped"
          ? "Your next win belongs here."
          : "You’re all caught up in this view.",
        actionView === "shipped"
          ? "Open an improvement and mark it shipped to keep track of your progress."
          : "Change your topic filter to explore more improvements.",
      );
}
function engineCoverage(question) {
  return `<span class="engine-coverage">${data.engines
    .map((e) => {
      const rows = question.rows.filter((r) => r.engine === e.id),
        rate = rows.length
          ? (rows.filter((r) => r.mention).length / rows.length) * 100
          : 0;
      return `<span title="${e.name}: ${pct(rate)}" aria-label="${e.name}: ${pct(rate)}" class="${rate < 40 ? "gap" : rate >= 60 ? "strong" : ""}"><img src="/assets/brands/${e.id}.svg" width="15" height="15" alt=""><span>${Math.round(rate)}%</span></span>`;
    })
    .join("")}</span>`;
}
function stat(label, value, suffix = "") {
  return `<div><span>${label}</span><strong>${value}${suffix ? `<small>${suffix}</small>` : ""}</strong></div>`;
}
function renderPageSummaries() {
  const gap = data.questions.filter((q) => q.visibility < 40),
    strong = data.questions.filter((q) => q.visibility >= 60),
    middle = data.questions.length - gap.length - strong.length;
  const tracked =
    data.questions.length +
    pending.filter((q) => !state.topic || q.topic === state.topic).length;
  $("#question-stats").innerHTML =
    stat("Tracked questions", tracked) +
    stat("Answer samples", fmt(data.current.samples)) +
    stat("Visibility gaps", gap.length) +
    stat("Strong presence", strong.length);
  const categories = [
    ["Visibility gaps", gap.length, "gap"],
    ["40–59% mention rate", middle, "mid"],
    ["60%+ mention rate", strong.length, "strong"],
  ];
  $("#coverage-distribution").innerHTML =
    `<div class="coverage-track" role="img" aria-label="${gap.length} questions below 40 percent, ${middle} from 40 to 59 percent, ${strong.length} at least 60 percent">${categories.map(([label, count, style]) => `<span class="${style}" style="width:${(count / Math.max(data.questions.length, 1)) * 100}%"></span>`).join("")}</div><div class="coverage-key">${categories.map(([label, count, style]) => `<span><i class="${style}"></i>${label}<b>${count}</b></span>`).join("")}</div>`;
  const relevant = ACTIONS.filter(
      (a) =>
        !state.topic ||
        QUESTIONS.find((q) => q.id === a.question).topic === state.topic,
    ),
    done = relevant.filter((a) => shipped.includes(a.id)).length;
  $("#opportunity-stats").innerHTML =
    stat("Open opportunities", relevant.length - done) +
    stat("Shipped", done) +
    stat("Questions with gaps", gap.length);
  $("#gap-rows").innerHTML = (
    gap.length ? gap.slice(0, 4) : data.questions.slice(0, 3)
  )
    .map(
      (q) =>
        `<button class="gap-row" data-question="${q.id}"><span>${esc(q.text)}</span><span class="gap-track"><span style="width:${100 - q.visibility}%"></span></span><strong>${pct(100 - q.visibility)}</strong>${icon("right")}</button>`,
    )
    .join("");
  $("#overview-engines").innerHTML = data.engines
    .map(
      (e) =>
        `<button class="rank-row" data-overview-engine="${e.id}" style="--share:${e.visibility}%">${engineIcon(e)}<span class="rank-name">${e.name}</span><span class="rank-value">${pct(e.visibility)}</span>${icon("right")}</button>`,
    )
    .join("");
  const max = Math.max(...data.engines.map((e) => e.referrals), 1);
  $("#traffic-engines").innerHTML = data.engines
    .slice()
    .sort((a, b) => b.referrals - a.referrals)
    .map(
      (e) =>
        `<button class="rank-row" data-engine="${e.id}" style="--share:${(e.referrals / max) * 100}%">${engineIcon(e)}<span class="rank-name">${e.name}</span><span class="rank-value">${fmt(e.referrals)}</span>${icon("filter")}</button>`,
    )
    .join("");
  const entries = [...new Set(data.v.map((v) => v.page))]
    .map((path) => ({
      path,
      count: data.v.filter((v) => v.page === path).length,
    }))
    .sort((a, b) => b.count - a.count);
  const largest = Math.max(...entries.map((p) => p.count), 1);
  $("#traffic-pages").innerHTML = entries
    .slice(0, 6)
    .map(
      (p) =>
        `<button class="rank-row" data-source-page="${esc(p.path)}" style="--share:${(p.count / largest) * 100}%">${icon("file")}<span class="rank-name">${esc(p.path)}</span><span class="rank-value">${fmt(p.count)}</span>${icon("right")}</button>`,
    )
    .join("");
  $("#crawler-rows").innerHTML = CRAWLERS.map(
    (c) =>
      `<button class="crawler-row" data-action="crawlers"><span><strong>${c.name}</strong><small>${c.purpose}</small></span><strong>${fmt(c.count)}</strong><span class="badge ${c.status === "Allowed" ? "green" : "neutral"}">${c.status}</span>${icon("right")}</button>`,
  ).join("");
}

function empty(title, description) {
  return `<div class="empty-state">${icon("spark")}<h3>${title}</h3><p>${description}</p></div>`;
}
function detail(title, eyebrow, html, replace = false) {
  closeMenus();
  if ($("#search-dialog").open) $("#search-dialog").close();
  if ($("#detail").open && !replace)
    detailHistory.push({
      title: $("#app-detail-title").textContent,
      eyebrow: $("#detail-eyebrow").textContent,
      html: $("#detail-body").innerHTML,
      scroll: $("#detail").scrollTop,
    });
  if (!$("#detail").open) detailHistory = [];
  $("#app-detail-title").textContent = title;
  $("#detail-eyebrow").textContent = eyebrow;
  $("#detail-body").innerHTML = html;
  $("#drawer-back").hidden = !detailHistory.length;
  $("#detail").scrollTop = 0;
  if (!$("#detail").open) openDialog($("#detail"));
  hydrate($("#detail"));
  void enhance($("#detail-body"));
  $("#app-detail-title").focus({ preventScroll: true });
}
$("#detail").addEventListener("close", () => {
  queueMicrotask(() => {
    if (
      document.activeElement === document.body &&
      !document.querySelector("dialog[open]")
    )
      (currentView === "overview"
        ? $("#overview-next")
        : $("#page-title")
      ).focus({ preventScroll: true });
  });
});
$("#drawer-back").addEventListener("click", () => {
  const previous = detailHistory.pop();
  if (!previous) return;
  detail(previous.title, previous.eyebrow, previous.html, true);
  $("#detail").scrollTop = previous.scroll;
});

function answersList(rows, limit = 8) {
  return rows
    .slice()
    .reverse()
    .slice(0, limit)
    .map((r) => {
      const q = QUESTIONS.find((q) => q.id === r.question);
      return `<button data-question="${r.question}" data-answer-date="${r.date}" data-answer-engine="${r.engine}">${engineIcon(engine(r.engine))}<span>${esc(q.text)}<small>${engine(r.engine).name} · ${date(r.date)} · ${r.mention ? "Acme mentioned" : "Acme missing"}</small></span>${icon("right")}</button>`;
    })
    .join("");
}
function answerCard(r) {
  const e = engine(r.engine);
  const q = QUESTIONS.find((q) => q.id === r.question);
  const names = r.competitors.length
    ? r.competitors.join(", ")
    : "other dedicated project management tools";
  return `<article class="answer-card"><div class="answer-head">${engineIcon(e)}${e.name}<span class="badge ${r.mention ? "green" : "amber"}">${r.mention ? "Mentioned" : "Missing"}</span></div><blockquote>${r.mention ? `<mark>Acme</mark> ${esc(q.excerpt)} ${r.competitors.length ? "Other options to compare include " + esc(names) + "." : ""}` : `${esc(q.missing)} ${r.competitors.length ? "The options in this answer include " + esc(names) + "." : ""}`}</blockquote><div class="answer-source">${icon("link")}${r.cited ? "acme.work" + esc(r.page) : esc(r.external)}</div><div class="answer-meta">Illustrative answer excerpt · ${date(r.date)}, 2026${r.position ? " · Acme at position " + r.position : ""}</div></article>`;
}
function openQuestion(id, answerDate, answerEngine) {
  const q =
    data.questions.find((q) => q.id === id) ||
    QUESTIONS.find((q) => q.id === id) ||
    pending.find((q) => q.id === id);
  if (!q) return;
  if (pending.some((p) => p.id === id)) {
    detail(
      q.text,
      "TRACKED QUESTION · PENDING",
      `<p>This question is saved in your demo workspace. It has no measurements yet.</p><div class="notice">Adding a question here does not run an AI query. Scheduled answer sampling needs to be connected before results can appear.</div><span class="badge neutral">${esc(q.topic)}</span><h3>Make room for another question</h3><button class="button" data-delete-question="${esc(id)}">Remove this question</button>`,
    );
    return;
  }
  const rows = data.a.filter((r) => r.question === id),
    hits = rows.filter((r) => r.mention).length,
    latest = ENGINES.filter((e) => !state.engine || e.id === state.engine)
      .map((e) => rows.filter((r) => r.engine === e.id).at(-1))
      .filter(Boolean);
  const specific =
    answerDate &&
    rows.find((r) => r.date === answerDate && r.engine === answerEngine);
  detail(
    q.text,
    q.topic + " · BUYER QUESTION",
    `<div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(rows.length ? (hits / rows.length) * 100 : 0)}</strong></div><div><span>Answers sampled</span><strong>${fmt(rows.length)}</strong></div></div><div class="notice">${date(data.start)} – ${date(data.end)} · ${state.engine ? engine(state.engine).name : "All AI engines"}. These are sample answers, not access to private conversations.</div><h3>${specific ? "Selected answer" : "Latest answer by engine"}</h3>${(specific ? [specific] : latest).map(answerCard).join("") || empty("No samples in this view", "Change the topic filter to see this question’s measurements.")}<h3>Make this answer easier to find</h3><p class="small-label">Related landing page</p><button class="rank-row self" data-source-page="${q.page}" style="--share:100%">${icon("file")}<span class="rank-name">acme.work${q.page}</span>${icon("arrow")}</button>${
      ACTIONS.some((a) => a.question === id)
        ? `<h3>A next move for this question</h3><div class="drawer-list">${ACTIONS.filter(
            (a) => a.question === id,
          )
            .map(
              (a) =>
                `<button data-improvement="${a.id}">${icon("bolt")}<span>${a.title}<small>${a.effort}</small></span>${icon("right")}</button>`,
            )
            .join("")}</div>`
        : ""
    }`,
  );
}
function openPage(path) {
  const own = path.startsWith("/");
  const rows = data.a.filter((r) =>
    own ? r.cited && r.page === path : r.external === path,
  );
  const v = data.v.filter((v) => own && v.page === path);
  detail(
    own ? "acme.work" + path : path,
    own ? "YOUR WEBSITE · CITED PAGE" : "EXTERNAL SOURCE",
    `<div class="drawer-stats"><div><span>Sampled citations</span><strong>${fmt(rows.length)}</strong></div><div><span>${own ? "AI referrals" : "Distinct questions"}</span><strong>${own ? fmt(v.length) : new Set(rows.map((r) => r.question)).size}</strong></div></div><div class="notice">${own ? "Website citations and referrals are separate signals. We cannot tie a particular click to a specific private AI conversation." : "External sources are pages cited in sampled answers. They can shape the answer even when your own website is not cited."}</div><h3>Recent answers using this source</h3><div class="drawer-list">${answersList(rows) || empty("No citations in this view", "Try another reporting period or filter.")}</div>${
      own
        ? `<h3>Visits to this page</h3><table class="data-table"><thead><tr><th>Engine</th><th>Sessions</th><th>Leads</th></tr></thead><tbody>${ENGINES.filter(
            (e) => !state.engine || state.engine === e.id,
          )
            .map(
              (e) =>
                `<tr><td>${e.name}</td><td>${fmt(v.filter((r) => r.engine === e.id).length)}</td><td>${v.filter((r) => r.engine === e.id && r.lead).length}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : ""
    }`,
  );
}
function openCompetitor(name) {
  const c = data.competitors.find((c) => c.name === name);
  if (!c) return;
  const rows = data.a.filter((r) =>
    name === "Acme" ? r.mention : r.competitors.includes(name),
  );
  const gaps = rows.filter((r) => !r.mention);
  const grouped = QUESTIONS.map((q) => ({
    ...q,
    evidence: (name === "Acme" ? rows : gaps).filter((r) => r.question === q.id),
  })).filter((q) => q.evidence.length).sort((a, b) => b.evidence.length - a.evidence.length);
  const evidence = grouped.map((q) => {
    const latest = q.evidence.at(-1);
    const providers = [...new Set(q.evidence.map((r) => r.engine))];
    return `<button class="benchmark-question" data-question="${q.id}" data-answer-date="${latest.date}" data-answer-engine="${latest.engine}"><span class="benchmark-question-copy"><strong>${esc(q.text)}</strong><span class="benchmark-meta">${providers.map((id) => `<img src="/assets/brands/${id}.svg" width="16" height="16" alt="${esc(engine(id).name)}">`).join("")}<span>Latest ${date(latest.date)}</span></span></span><span class="benchmark-count"><strong>${fmt(q.evidence.length)}</strong><small>${name === "Acme" ? "mentions" : "missed"}</small></span>${icon("right")}</button>`;
  }).join("");
  detail(
    name,
    name === "Acme" ? "YOUR BRAND" : "COMPETITOR BENCHMARK",
    `<p class="benchmark-scope">${state.engine ? esc(engine(state.engine).name) : "All engines"} · ${date(data.start)} – ${date(data.end)} · Sample data</p><div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(c.share)}</strong></div><div><span>${name === "Acme" ? "Answers mentioning you" : "Answers without Acme"}</span><strong>${fmt(name === "Acme" ? c.count : gaps.length)}</strong></div></div><div class="benchmark-heading"><h3>${name === "Acme" ? "Questions mentioning you" : "Where you’re missing"}</h3><span>${grouped.length} questions</span></div><p class="benchmark-description">${name === "Acme" ? "Ranked by sampled mentions." : esc(name) + " appears in these answers without Acme. Open a question to inspect the latest sample."}</p><div class="benchmark-list">${evidence || empty("No missing mentions here", "Acme appears alongside this brand in the current sample.")}</div><details class="benchmark-method"><summary>How this is measured</summary><p>${fmt(c.count)} of ${fmt(data.current.samples)} sampled answers mention ${esc(name)}. Each question groups its matching answers across this reporting period. Multiple brands can appear in one answer; rates do not add to 100%.</p></details>`,
  );
}
function openAction(id, replace = false) {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) return;
  const record = growthWork[id],
    done = shipped.includes(id);
  detail(
    action.title.replace(/\.$/, ""),
    done
      ? "IMPROVEMENT SHIPPED"
      : record
        ? "YOUR GROWTH PLAN"
        : "CONTENT OPPORTUNITY",
    workbenchHTML(
      action,
      record,
      done,
      record?.baseline || baselineFor(action, data, state),
      QUESTIONS.find((q) => q.id === action.question),
    ),
    replace,
  );
}
function saveGrowth(next) {
  if (!store("growth-work", next)) return false;
  growthWork = next;
  renderActions();
  renderGrowth();
  return true;
}
function beginImprovement(id) {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) return;
  const existing = Boolean(growthWork[id]);
  if (
    !saveGrowth(startWork(growthWork, action, baselineFor(action, data, state)))
  )
    return;
  openAction(id, $("#detail").open);
  if (!existing) toast("Plan started. Your baseline is saved.");
}
function openGrowthReview(id) {
  const action = ACTIONS.find((a) => a.id === id);
  if (action && shipped.includes(id)) {
    detail(
      "Measure the change",
      "GROWTH REVIEW",
      reviewHTML(action, growthWork[id]),
    );
    return;
  }
  const items = ACTIONS.filter((a) => shipped.includes(a.id));
  detail(
    "Measure the change",
    "YOUR GROWTH REVIEW",
    items.length
      ? `<p>Your changes are recorded. Open one to review its baseline and measurement plan.</p><div class="drawer-list">${items.map((a) => `<button data-growth-review="${a.id}">${icon("circlecheck")}<span>${esc(a.title)}<small>Shipped · awaiting new samples</small></span>${icon("right")}</button>`).join("")}</div><div class="notice">Completion is recorded separately from measured impact.</div>`
      : `<div class="review-empty">${icon("chart")}<h3>Your first improvement starts the loop.</h3><p>Save a baseline, work through a focused plan, then return here to compare new measurements.</p><button class="button primary" data-action="growth-improve">Find an improvement${icon("right")}</button></div>`,
  );
}
function renderGrowth() {
  const context = growthContext(data),
    items = priorities(data, growthWork, shipped);
  const next = items.find((a) => !a.completed);
  $("#overview-next").disabled = false;
  $("#overview-next").innerHTML =
    `${next ? (growthWork[next.id] ? "Continue plan" : "Your next move") : items.length ? "Review results" : "Explore questions"}${icon("right")}`;
  $("#next-move").innerHTML = nextMoveHTML(items, growthWork, context);
  $("#growth-path").innerHTML = journeyHTML(items, context, growthWork);
  $("#overview-competitors").innerHTML = competitorHTML(data.competitors);
  $("#overview-benchmark").innerHTML =
    `<strong>#${context.rank}</strong> of ${data.competitors.length} brands · same questions, same period`;
  $("#meaning-visibility").textContent =
    `${fmt(data.current.mentions)} of ${fmt(data.current.samples)} answers`;
  $("#meaning-citations").textContent = "Answers linking to your website";
  $("#meaning-referrals").textContent = "Sessions attributed to AI";
  $("#meaning-leads").textContent =
    `${pct(context.conversion)} of AI referrals converted`;
}
function addonPreview(addon) {
  const gap = data.questions
      .slice()
      .sort((a, b) => a.visibility - b.visibility)[0],
    competitor = data.competitors.find((item) => !item.self),
    own = data.competitors.find((item) => item.self);
  if (addon.id === "brief-studio")
    return `<div class="addon-preview"><div class="addon-preview-head"><span>Buyer question</span><strong>${pct(gap?.visibility || 0)} visible</strong></div><div class="addon-preview-row"><strong>${esc(gap?.text || "Your next buyer question")}</strong><span>${esc(gap?.topic || "Discovery")}</span></div><div class="addon-preview-row"><span>Suggested structure</span><strong>Answer · proof · source map</strong></div></div>`;
  if (addon.id === "competitor-watch")
    return `<div class="addon-preview"><div class="addon-preview-head"><strong>Same questions · same period</strong><span>Mention rate</span></div><div class="addon-preview-row"><span>${esc(competitor?.name || "Leading competitor")}</span><strong>${pct(competitor?.share || 0)}</strong></div><div class="addon-preview-row"><span>Acme</span><strong>${pct(own?.share || data.current.visibility)}</strong></div></div>`;
  if (addon.id === "weekly-brief")
    return `<div class="addon-preview"><div class="addon-preview-head"><strong>Monday, at a glance</strong><span>Last ${state.days} days</span></div><div class="addon-preview-row"><span>Mention rate</span><strong>${pct(data.current.visibility)}</strong></div><div class="addon-preview-row"><span>AI referrals</span><strong>${fmt(data.current.referrals)}</strong></div><div class="addon-preview-row"><span>Next opportunity</span><strong>${esc(gap?.topic || "Discovery")}</strong></div></div>`;
  if (addon.id === "crawler-guard")
    return `<div class="addon-preview"><div class="addon-preview-head"><strong>Illustrative access check</strong><span>30 days</span></div>${CRAWLERS.slice(0, 3).map((crawler) => `<div class="addon-preview-row"><span>${esc(crawler.name)}</span><strong>${esc(crawler.status)} · ${fmt(crawler.count)}</strong></div>`).join("")}</div>`;
  return `<div class="addon-preview"><div class="addon-preview-head"><strong>Illustrative AI pipeline</strong><span>Current view</span></div><div class="addon-preview-row"><span>Attributed sessions</span><strong>${fmt(data.current.referrals)}</strong></div><div class="addon-preview-row"><span>Leads created</span><strong>${fmt(data.current.leads)}</strong></div><div class="addon-preview-row"><span>Visit → lead</span><strong>${pct(data.current.referrals ? (data.current.leads / data.current.referrals) * 100 : 0)}</strong></div></div>`;
}
function openAddon(id, replace = false) {
  const addon = ADDONS.find((item) => item.id === id);
  if (!addon) return;
  detail(
    addon.name,
    addon.access === "pilot" ? "PRIVATE PILOT" : "ADD-ON",
    addonDetailHTML(addon, addonState[id], addonPreview(addon)),
    replace,
  );
}
function renderAddons() {
  const counts = addonCounts(addonState),
    opted = counts.active + counts.pilots,
    recommended = recommendedAddon(addonState),
    allAdded = ADDONS.every((addon) => addonState[addon.id]);
  $("#addon-count").hidden = opted === 0;
  $("#addon-count").textContent = opted;
  $("#addon-focus").innerHTML = `<div class="addon-focus-copy"><span class="badge purple">${allAdded ? "STACK COMPLETE" : "SUGGESTED NEXT"}</span><h2>${allAdded ? "Your signal stack is ready." : `${esc(recommended.name)} turns the evidence into a repeatable move.`}</h2><p>${allAdded ? "Open any instrument below to see what it watches and creates." : esc(recommended.description)}</p><button class="button primary" data-addon="${recommended.id}">${addonState[recommended.id] ? "Manage add-on" : recommended.access === "pilot" ? "Explore pilot" : "See how it works"}${icon("right")}</button></div><div class="addon-focus-signal" aria-label="${esc(recommended.watches)} creates ${esc(recommended.creates)}"><div class="focus-node">${icon("eye")}<span><small>Watches</small><strong>${esc(recommended.watches)}</strong></span></div><span class="focus-arrow">${icon("right")}</span><div class="focus-node">${icon(recommended.icon)}<span><small>Creates</small><strong>${esc(recommended.creates)}</strong></span></div></div>`;
  const active = ADDONS.filter((addon) => addonState[addon.id]?.state === "active"),
    available = ADDONS.filter(
      (addon) =>
        addon.access === "available" &&
        !addonState[addon.id] &&
        (allAdded || addon.id !== recommended.id),
    ),
    pilots = ADDONS.filter((addon) => addon.access === "pilot");
  $("#addon-active-section").hidden = active.length === 0;
  $("#addon-active-copy").textContent =
    active.length === 1 ? "1 instrument active" : `${active.length} instruments active`;
  $("#addon-active").innerHTML = active
    .map((addon) => addonRowHTML(addon, addonState[addon.id]))
    .join("");
  $("#addon-available").innerHTML = available.length
    ? available.map((addon) => addonRowHTML(addon, addonState[addon.id])).join("")
    : `<div class="addon-empty">Every available add-on is in your stack.</div>`;
  $("#addon-pilots").innerHTML = pilots
    .map((addon) => addonRowHTML(addon, addonState[addon.id]))
    .join("");
}
function changeAddon(id, enabled) {
  const addon = ADDONS.find((item) => item.id === id);
  if (!addon) return;
  const next = setAddonState(
    addonState,
    id,
    enabled ? (addon.access === "pilot" ? "pilot" : "active") : null,
  );
  if (!store("addons", next)) return;
  addonState = next;
  renderAddons();
  openAddon(id, true);
  toast(
    enabled
      ? addon.access === "pilot"
        ? "Pilot interest saved in this browser."
        : `${addon.name} added to this demo workspace.`
      : addon.access === "pilot"
        ? "Pilot interest removed."
        : `${addon.name} removed from this demo workspace.`,
  );
}
function openDay(start, end = start) {
  const rows = data.a.filter((r) => r.date >= start && r.date <= end),
    visits = data.v.filter((r) => r.date >= start && r.date <= end);
  detail(
    date(start) + (end !== start ? " – " + date(end) : ""),
    "DAILY DETAIL · " + LABELS[state.metric].toUpperCase(),
    `<div class="drawer-stats"><div><span>Answers mentioning Acme</span><strong>${rows.filter((r) => r.mention).length}<small style="font-size:15px;color:var(--muted)"> / ${rows.length}</small></strong></div><div><span>AI referrals</span><strong>${fmt(visits.length)}</strong></div></div><h3>Answer samples</h3><div class="drawer-list">${answersList(rows, 16)}</div><div class="notice">This panel follows the engine and topic filters on your dashboard. All entries belong to the sample workspace.</div>`,
  );
}
function methodology() {
  detail(
    "Four signals. One clearer picture.",
    "ABOUT THIS DATA",
    `<p>AI discovery is a journey. Each part needs its own measurement, and each has limits.</p>${[
      [
        "spark",
        "Answer visibility",
        "Sampled",
        "We ask a defined set of buyer questions, then count brand mentions and website citations in the returned answers. This estimates visibility for that sample; it cannot observe every conversation.",
      ],
      [
        "people",
        "AI referrals",
        "Attributed",
        "A website event can identify a visit through a known AI referrer or a UTM parameter such as utm_source=chatgpt.com. Some apps strip this context, so direct traffic can include unattributed AI visits.",
      ],
      [
        "target",
        "Leads from AI",
        "Events",
        "A lead event is associated with an attributed session. Here it represents a form completion. Production tracking needs your website events and a documented attribution window.",
      ],
      [
        "globe",
        "Crawler access",
        "Server logs",
        "Server or CDN logs show requests from search and training crawlers. User-agent and verified identity help classify them. A crawler request is neither a human visitor nor proof of a mention.",
      ],
    ]
      .map(
        ([i, title, badge, body]) =>
          `<div class="source-item"><div class="source-title">${icon(i)}${title}<span class="badge neutral">${badge}</span></div><p>${body}</p></div>`,
      )
      .join(
        "",
      )}<div class="notice">This entire workspace uses deterministic sample data through September 9, 2026. No live integrations or private AI conversations are connected. Topic filters map answer topics to their related landing pages; this is not a session-to-answer identity match.</div><details><summary>How are chart comparisons calculated?</summary><p>Each period is compared with the immediately preceding period of the same length. Mention-rate changes use percentage points; count changes use relative percentages. The 90-day chart groups observations into three-day intervals. All chart axes start at zero.</p></details><details><summary>What counts as a citation?</summary><p>A sampled answer that links to acme.work counts as one website citation. Mentions without a link still count toward mention rate. An external page may be cited alongside or instead of your website.</p></details><details><summary>Can a mention guarantee traffic or revenue?</summary><p>No. Answers, referrals, and lead events are different datasets. The dashboard brings them together for analysis without claiming that a specific answer caused a visit.</p></details>`,
  );
}
function sourceDetails(kind = "answers") {
  const config = {
    answers: [
      "Answer sampling",
      "Mentions and citations for your tracked questions.",
      [
        "Choose questions and engines",
        "Collect answer text and cited URLs",
        "Compare mention rates over time",
      ],
    ],
    analytics: [
      "Website analytics",
      "Visits identified through AI referrers or campaign parameters.",
      [
        "Add a website collector or analytics connection",
        "Capture landing page and source",
        "Keep unattributed sessions separate",
      ],
    ],
    conversions: [
      "Conversion events",
      "Lead and signup events from attributed website sessions.",
      [
        "Choose a conversion event",
        "Connect website analytics",
        "Define an attribution window",
      ],
    ],
    logs: [
      "Server logs",
      "Crawler requests from your server or CDN.",
      [
        "Import access logs",
        "Verify bot identity",
        "Separate search and training crawlers",
      ],
    ],
  }[kind] || ["Data source", "Choose a source to connect.", []];
  detail(
    config[0],
    "SOURCE · NOT CONNECTED",
    `<p>${config[1]}</p><ol class="step-list">${config[2].map((step, i) => `<li><span class="step-number">${i + 1}</span><span>${step}</span></li>`).join("")}</ol><button class="button primary" data-action="setup">Plan setup${icon("right")}</button><div class="notice">Preview only. A saved plan does not activate this connection.</div>`,
  );
}
function setup() {
  const saved = load("setup", {});
  detail(
    "Your website. Your next chapter.",
    "WORKSPACE SETUP · PREVIEW",
    `<p>Start with your website and the question you want to answer first. We’ll save a setup plan for this browser.</p><form id="setup-form" novalidate><label class="form-field field">Website URL<input name="website" type="url" placeholder="https://yourcompany.com" value="${esc(typeof saved.website === "string" ? saved.website : "")}" required maxlength="250"></label><label class="form-field field">What do you want to understand?<select name="priority" aria-label="What do you want to understand?"><option value="visibility">Where AI recommends my brand</option><option value="traffic">Which AI engines send visitors</option><option value="conversions">Which visits turn into customers</option></select></label><p class="form-error" id="setup-error" role="alert" hidden></p><button class="button primary" type="submit">Save my setup plan${icon("right")}</button></form><div class="notice">This saves locally in the demo. No tracking code is installed and no external account is connected.</div>`,
  );
  if (["visibility", "traffic", "conversions"].includes(saved.priority))
    $("#setup-form select").value = saved.priority;
}
function addQuestion() {
  detail(
    "What should we listen for?",
    "TRACK A QUESTION",
    `<p>Write a question your future customer would ask an AI assistant. Specific questions make the evidence more useful.</p><form id="question-form" novalidate><label class="form-field field">Buyer question<textarea name="question" placeholder="What is the best project management tool for a design agency?" required minlength="10" maxlength="220"></textarea></label><label class="form-field field">Topic<select name="topic" aria-label="Topic">${TOPICS.map((t) => `<option>${t}</option>`).join("")}</select></label><p class="form-error" id="question-error" role="alert" hidden></p><button class="button primary" type="submit">Add to tracked questions${icon("plus")}</button></form><div class="notice">New questions are saved locally with a pending status. Results require a connected answer-sampling service.</div>`,
  );
}
function search() {
  closeMenus();
  $("#global-search").value = "";
  renderSearch("");
  openDialog($("#search-dialog"));
  $("#global-search").focus();
}
function renderSearch(term) {
  term = term.toLowerCase().trim();
  const results = [
    ...QUESTIONS.map((q) => ({
      kind: "question",
      id: q.id,
      title: q.text,
      meta: "Buyer question · " + q.topic,
      i: "spark",
    })),
    ...pending.map((q) => ({
      kind: "question",
      id: q.id,
      title: q.text,
      meta: "Pending question",
      i: "clock",
    })),
    ...ACTIONS.map((a) => ({
      kind: "improvement",
      id: a.id,
      title: a.title,
      meta: "Next move · " + a.effort,
      i: "bolt",
    })),
    ...ADDONS.map((addon) => ({
      kind: "addon",
      id: addon.id,
      title: addon.name,
      meta: "Add-on · " + addon.watches,
      i: addon.icon,
    })),
    ...data.pages.map((p) => ({
      kind: "source-page",
      id: p.path,
      title: "acme.work" + p.path,
      meta: "Your website · " + fmt(p.citations) + " citations",
      i: "file",
    })),
  ]
    .filter(
      (r) => !term || (r.title + " " + r.meta).toLowerCase().includes(term),
    )
    .slice(0, 10);
  $("#search-results").innerHTML = results.length
    ? results
        .map(
          (r) =>
            `<button data-${r.kind}="${esc(r.id)}">${icon(r.i)}<span>${esc(r.title)}<small>${r.meta}</small></span>${icon("right")}</button>`,
        )
        .join("")
    : empty("No results", "Try a page name, buyer question, or improvement.");
}
function exportReport() {
  const rows = [
    ["Mentionloom sample workspace — Acme"],
    ["Period", data.start, data.end],
    ["Engine", state.engine ? engine(state.engine).name : "All"],
    ["Topic", state.topic || "All"],
    [],
    ["Date", "Mention rate (%)", "Website citations", "AI referrals", "Leads"],
  ];
  data.series.forEach((d) =>
    rows.push([
      d.date,
      d.visibility.toFixed(2),
      d.citations,
      d.referrals,
      d.leads,
    ]),
  );
  download(`acme-ai-discovery-${data.start}-${data.end}.csv`, csv(rows));
  toast("Your filtered report has been exported.");
}
const actions = {
  search,
  setup,
  sources: () => navigate("sources"),
  "source-details": sourceDetails,
  "growth-next": () => {
    const items = priorities(data, growthWork, shipped),
      next = items.find((a) => !a.completed);
    next
      ? beginImprovement(next.id)
      : items.length
        ? openGrowthReview()
        : actions["growth-gaps"]();
  },
  "growth-gaps": () => {
    questionView = growthContext(data).gaps.length ? "opportunity" : "all";
    showAll = true;
    navigate("questions");
  },
  "growth-improve": () => {
    actionView = "todo";
    navigate("opportunities");
  },
  "growth-review": () => openGrowthReview(),
  "growth-priority": () =>
    detail(
      "Why this comes next",
      "RECOMMENDATION LOGIC",
      `<p>We rank the suggested improvements by the number of sampled answers that omit Acme. An improvement you’ve already started stays first.</p><div class="notice">This follows your engine, topic and date filters. It is an observed coverage gap, not a prediction of search volume or revenue.</div><button class="button" data-action="growth-improve">Explore the improvement queue${icon("right")}</button>`,
    ),
  methodology,
  "add-question": addQuestion,
  export: exportReport,
  "clear-filters": () => update({ engine: "", topic: "" }),
  "reset-workspace": () => {
    update({ days: 30, engine: "", topic: "", metric: "visibility" });
    closeMenus();
    navigate("overview");
    toast("Demo filters reset.");
  },
  opportunities: () => {
    questionView = "opportunity";
    showAll = true;
    navigate("questions");
  },
  "chart-data": () =>
    detail(
      LABELS[state.metric],
      "CHART DATA",
      `<p>${date(data.start)} – ${date(data.end)}, 2026. ${state.engine ? engine(state.engine).name : "All AI engines"} · ${state.topic || "All topics"}. Daily values before chart grouping.</p><button class="button" data-action="export">${icon("download")}Export report</button><table class="data-table"><thead><tr><th>Date</th><th>${LABELS[state.metric]}</th><th>Previous period</th></tr></thead><tbody>${data.series.map((d) => `<tr><td>${date(d.date)}</td><td>${format(d[state.metric], state.metric)}</td><td>${format(d.previous[state.metric], state.metric)}</td></tr>`).join("")}</tbody></table>`,
    ),
  competitors: () =>
    detail(
      "The competitive picture.",
      "SAME QUESTIONS · SAME PERIOD",
      `<p>Compare brands across ${fmt(data.current.samples)} sampled answers. Open a brand to find the questions behind its visibility.</p><div class="drawer-list">${data.competitors.map((c) => `<button data-competitor="${c.name}"><span class="brand-initial ${c.self ? "self" : ""}">${c.self ? "a" : c.name[0]}</span><span>${c.name}<small>${fmt(c.count)} answers · ${pct(c.share)} mention rate</small></span>${icon("right")}</button>`).join("")}</div>`,
    ),
  pages: () =>
    detail(
      "Follow the citations.",
      "SOURCES IN AI ANSWERS",
      `<p>These are the pages cited in your filtered sample. Select a source to inspect the answers behind it.</p><h3>Your website</h3><div class="drawer-list">${data.pages.map((p) => `<button data-source-page="${esc(p.path)}">${icon("file")}<span>acme.work${esc(p.path)}<small>${fmt(p.citations)} citations · ${fmt(p.referrals)} referrals</small></span>${icon("right")}</button>`).join("")}</div><h3>External sources</h3><div class="drawer-list">${data.external.map((p) => `<button data-source-page="${esc(p.path)}">${icon("globe")}<span>${esc(p.path)}<small>${fmt(p.citations)} sampled citations</small></span>${icon("right")}</button>`).join("")}</div>`,
    ),
  attribution: () =>
    detail(
      "The click is only the beginning.",
      "REFERRAL ATTRIBUTION",
      `<p>AI referrals are identified from a known AI referrer or campaign source. Once a visitor arrives, their session can be associated with an event on your own website.</p><div class="drawer-stats"><div><span>Identified by UTM</span><strong>${fmt(data.v.filter((v) => v.method === "UTM source").length)}</strong></div><div><span>Identified by referrer</span><strong>${fmt(data.v.filter((v) => v.method === "Referrer").length)}</strong></div></div><h3>In this sample</h3><ol class="step-list"><li><span class="step-number">1</span><span>A session arrives with an AI source in the UTM or referrer.</span></li><li><span class="step-number">2</span><span>An engaged visit views another page or stays for at least 30 seconds.</span></li><li><span class="step-number">3</span><span>A lead is a form completion in that same session.</span></li></ol><div class="notice">Referrer loss means some AI visits cannot be identified. A UTM does not expose the prompt that produced a visit. This dashboard does not claim to read private chats.</div><button class="button" data-action="sources">Explore data sources${icon("right")}</button>`,
    ),
  crawlers: () =>
    detail(
      "A clear path for search engines.",
      "CRAWLER ACCESS · SAMPLE SNAPSHOT",
      `<p>Crawler requests tell you whether AI systems can retrieve your pages. They are separate from mentions, human visits, and conversions.</p><table class="data-table"><thead><tr><th>Crawler / purpose</th><th>Requests</th><th>Access</th></tr></thead><tbody>${CRAWLERS.map((c) => `<tr><td>${c.name}<br><span class="small-label">${c.purpose}</span></td><td>${fmt(c.count)}</td><td><span class="badge ${c.status === "Allowed" ? "green" : "neutral"}">${c.status}</span></td></tr>`).join("")}</tbody></table><div class="notice">Illustrative 30-day server-log snapshot, independent of your dashboard filters. No server or CDN is connected.</div><h3>Search is different from training</h3><p>Allowing a search crawler can help it retrieve a page, but does not guarantee indexing or recommendations. Training crawlers have a different purpose and can be managed separately.</p><button class="button" data-action="sources">Review sources${icon("right")}</button>`,
    ),
  activity: () =>
    detail(
      "Inside the answer.",
      "ANSWER FEED · SAMPLE DATA",
      `<p>Recent sampled answers for your current filters. Open an entry to explore the underlying question.</p><div class="drawer-list">${answersList(data.a, 24)}</div>`,
    ),
};

// Commit filter changes after Orbit finishes the native event dispatch.
// A microtask can run between listeners and remove its selected option too early.
document.addEventListener("click", (event) => {
  const b = event.target.closest("button,a");
  if (!b || !data) return;
  if (b.dataset.route) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(b.dataset.route);
    return;
  }
  if (b.dataset.growthStart) {
    beginImprovement(b.dataset.growthStart);
    return;
  }
  if (b.dataset.growthReview) {
    openGrowthReview(b.dataset.growthReview);
    return;
  }
  if (b.dataset.addon) {
    openAddon(b.dataset.addon);
    return;
  }
  if (b.dataset.addonEnable) {
    changeAddon(b.dataset.addonEnable, true);
    return;
  }
  if (b.dataset.addonRemove) {
    changeAddon(b.dataset.addonRemove, false);
    return;
  }
  if (b.dataset.connection) {
    sourceDetails(b.dataset.connection);
    return;
  }
  if (b.hasAttribute("data-close")) {
    closeDialog(b.closest("dialog"));
    return;
  }
  if (b.dataset.action) {
    setTimeout(() => actions[b.dataset.action]?.(), 0);
    return;
  }
  if (b.dataset.days) {
    setTimeout(() => update({ days: Number(b.dataset.days) }), 0);
    return;
  }
  if (b.dataset.overviewEngine) {
    state.engine = b.dataset.overviewEngine;
    navigate("visibility");
    return;
  }
  if (b.hasAttribute("data-engine")) {
    setTimeout(() => update({ engine: b.dataset.engine }), 0);
    return;
  }
  if (b.hasAttribute("data-topic")) {
    setTimeout(() => update({ topic: b.dataset.topic }), 0);
    return;
  }
  if (b.dataset.clear) {
    update({ [b.dataset.clear]: "" });
    return;
  }
  if (b.dataset.metric) {
    if (currentView === "overview") {
      state.metric = b.dataset.metric;
      navigate(
        ["referrals", "leads"].includes(state.metric)
          ? "traffic"
          : "visibility",
      );
      return;
    }
    update({ metric: b.dataset.metric });
    return;
  }
  if (b.dataset.question) {
    openQuestion(
      b.dataset.question,
      b.dataset.answerDate,
      b.dataset.answerEngine,
    );
    return;
  }
  if (b.dataset.sourcePage) {
    openPage(b.dataset.sourcePage);
    return;
  }
  if (b.dataset.competitor) {
    openCompetitor(b.dataset.competitor);
    return;
  }
  if (b.dataset.improvement) {
    openAction(b.dataset.improvement);
    return;
  }
  if (b.dataset.ship) {
    const id = b.dataset.ship,
      action = ACTIONS.find((a) => a.id === id),
      reopening = shipped.includes(id);
    if (!action || (!reopening && !canShip(action, growthWork))) return;
    const next = reopening ? shipped.filter((a) => a !== id) : [...shipped, id];
    if (store("shipped", next)) {
      shipped = next;
      if (growthWork[id])
        saveGrowth({
          ...growthWork,
          [id]: {
            ...growthWork[id],
            shippedAt: reopening ? null : new Date().toISOString(),
          },
        });
      renderActions();
      renderPageSummaries();
      renderGrowth();
      openAction(id, true);
      toast(
        reopening
          ? "Improvement reopened."
          : "Improvement shipped. Next: review the results.",
      );
    }
    return;
  }
  if (b.dataset.deleteQuestion) {
    pending = pending.filter((q) => q.id !== b.dataset.deleteQuestion);
    store("questions", pending);
    $("#detail").close();
    renderQuestions();
    renderPageSummaries();
    toast("Question removed from this browser.");
    return;
  }
  if (b.dataset.value && b.closest("#engine-tabs")) {
    engineView = b.dataset.value;
    renderEngines();
    return;
  }
  if (b.dataset.value && b.closest("#page-tabs")) {
    pageView = b.dataset.value;
    renderPages();
    return;
  }
  if (b.dataset.value && b.closest("#question-tabs")) {
    questionView = b.dataset.value;
    showAll = false;
    renderQuestions();
    return;
  }
  if (b.dataset.value && b.closest("#action-tabs")) {
    actionView = b.dataset.value;
    renderActions();
    return;
  }
});
document.addEventListener("change", (event) => {
  const input = event.target.closest("[data-work-step]");
  if (!input) return;
  const action = ACTIONS.find((a) => a.id === input.dataset.workAction);
  if (!action || shipped.includes(action.id)) return;
  const previous = growthWork;
  if (
    !saveGrowth(
      checkStep(
        growthWork,
        action,
        Number(input.dataset.workStep),
        input.checked,
      ),
    )
  ) {
    input.checked =
      previous[action.id]?.checked.includes(Number(input.dataset.workStep)) ||
      false;
    return;
  }
  // Preserve checkbox focus and the user's scroll position while revealing progress.
  const count = growthWork[action.id].checked.length;
  input.defaultChecked = input.checked;
  input.closest(".work-step").classList.toggle("is-done", input.checked);
  $("#work-count").textContent = `${count} / ${action.steps.length} complete`;
  const progress = $(".work-progress");
  progress.setAttribute("aria-valuenow", count);
  progress.firstElementChild.style.transform = `scaleX(${count / action.steps.length})`;
  const button = $(`[data-ship="${action.id}"]`);
  button.disabled = !canShip(action, growthWork);
  $("#ship-hint").textContent = button.disabled
    ? "Complete the checklist to record this as shipped."
    : "Finished on your website? Record the change here.";
  $("#filter-status").textContent =
    `Improvement saved: ${count} of ${action.steps.length} steps complete.`;
});
$("#compare-toggle").addEventListener("change", renderMainChart);
$("#question-search").addEventListener("input", () => {
  showAll = true;
  renderQuestions();
});
$("#more-questions").addEventListener("click", () => {
  showAll = !showAll;
  renderQuestions();
});
$("#sort-questions").addEventListener("click", () => {
  sortAscending = !sortAscending;
  renderQuestions();
});
$("#global-search").addEventListener("input", (e) =>
  renderSearch(e.target.value),
);
$("#global-search").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    $("#search-results button")?.focus();
  }
});
$("#search-results").addEventListener("keydown", (e) => {
  const bs = [...$("#search-results").querySelectorAll("button")],
    i = bs.indexOf(document.activeElement);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (e.key === "ArrowUp" && i === 0) $("#global-search").focus();
    else
      bs[
        (i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length
      ]?.focus();
  }
});
document.addEventListener(
  "keydown",
  (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if ($("#detail").open) $("#detail").close();
      search();
    }
  },
  true,
);
function formError(form, field, message) {
  const error = form.querySelector('[role="alert"]');
  error.hidden = false;
  error.textContent = message;
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", error.id);
  field.focus();
}
document.addEventListener("input", (e) => {
  const form = e.target.closest("#question-form,#setup-form");
  if (!form) return;
  e.target.removeAttribute("aria-invalid");
  e.target.removeAttribute("aria-describedby");
  const error = form.querySelector('[role="alert"]');
  if (error) error.hidden = true;
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "question-form") {
    e.preventDefault();
    const f = new FormData(e.target),
      text = String(f.get("question")).trim(),
      topic = String(f.get("topic"));
    if (text.length < 10 || text.length > 220) {
      formError(
        e.target,
        e.target.elements.question,
        "Write a question between 10 and 220 characters.",
      );
      return;
    }
    if (!TOPICS.includes(topic)) return;
    if (
      [...QUESTIONS, ...pending].some(
        (q) => q.text.toLowerCase() === text.toLowerCase(),
      )
    ) {
      formError(
        e.target,
        e.target.elements.question,
        "You’re already tracking that question.",
      );
      return;
    }
    if (pending.length >= 100) {
      toast("This demo supports up to 100 saved questions.");
      return;
    }
    const q = { id: "pending-" + crypto.randomUUID(), text, topic };
    if (store("questions", [...pending, q])) {
      pending.push(q);
      questionView = "all";
      showAll = true;
      $("#question-search").value = text;
      update({ topic: "" });
      $("#detail").close();
      navigate("questions");
      toast("Question saved. Waiting for an answer-sampling connection.");
    }
  }
  if (e.target.id === "setup-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    const website = String(f.get("website")),
      priority = String(f.get("priority"));
    if (!e.target.elements.website.validity.valid) {
      formError(
        e.target,
        e.target.elements.website,
        "Enter a complete website URL, such as https://yourcompany.com.",
      );
      return;
    }
    let url;
    try {
      url = new URL(website);
    } catch {
      formError(
        e.target,
        e.target.elements.website,
        "Enter a complete website URL, such as https://yourcompany.com.",
      );
      return;
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      formError(
        e.target,
        e.target.elements.website,
        "Use a website beginning with https://.",
      );
      return;
    }
    if (store("setup", { website, priority })) {
      detail(
        "Your setup plan is saved.",
        "WORKSPACE SETUP · PREVIEW",
        `<p>We’ve saved <strong>${esc(url.hostname)}</strong> in this browser. Here’s what needs to be connected to make the dashboard yours.</p><ol class="step-list"><li><span class="step-number">1</span><span>Verify your domain and define the buyer questions you want to track.</span></li><li><span class="step-number">2</span><span>Connect answer sampling to collect mentions and citations.</span></li><li><span class="step-number">3</span><span>Install your website collector and define a lead event.</span></li></ol><div class="notice">This is a saved plan, not an active connection. The Acme dashboard continues to show sample data.</div><button class="button" data-action="sources">Review data sources${icon("right")}</button>`,
      );
      toast("Setup plan saved in this browser.");
    }
  }
});
showPage();
addEventListener("popstate", () => {
  Object.assign(state, parseState(location.search));
  currentView = resolveView(location);
  state.metric = metricForView(currentView, state.metric);
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  showPage({ focus: true });
  render();
});
addEventListener("hashchange", () => {
  if (
    ["#overview", "#questions", "#actions", "#sources"].includes(location.hash)
  )
    navigate(resolveView({ hash: location.hash }), { replace: true });
});
try {
  await initializeOrbit();
} catch (error) {
  $("#filter-status").textContent =
    "The interface could not load. Please reload to try again.";
  const errorBox = document.createElement("div");
  errorBox.className = "empty-state";
  errorBox.setAttribute("role", "alert");
  errorBox.innerHTML =
    '<h2>The interface could not load.</h2><p>Please reload to try again.</p><button class="button primary" type="button">Reload dashboard</button>';
  errorBox.querySelector("button").onclick = () => location.reload();
  $("#main").prepend(errorBox);
  throw error;
}
hydrate();
installMenus();
render();
await enhance(document.querySelector(".question-controls"));
await enhance(document.querySelector(".opportunity-toolbar"));
await enhance(document.querySelector(".breakdown-grid"));
syncURL();
window.scrollTo({ top: 0, behavior: "instant" });

const reveal = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animate(
          e.target,
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
          320,
        );
        reveal.unobserve(e.target);
      }
    }),
  { threshold: 0.08 },
);
document
  .querySelectorAll(".card,.action-card,.section-heading")
  .forEach((el) => reveal.observe(el));

let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (data) renderMainChart();
  }, 160);
});
