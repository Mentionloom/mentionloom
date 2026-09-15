import { createFilters } from "./lib/filters.js";
import { TRAFFIC_SOURCES, SOURCE_GROUPS, COUNTRIES, DEVICES, TRAFFIC_METRICS, MILESTONES, sourceLabel, countryLabel, parseTrafficState, selectTraffic, trafficMetrics, funnelRows } from "./lib/traffic.js";
import { usageHTML, funnelHTML, sourcesHTML, locationsHTML, devicesHTML, pagesHTML, journeysHTML, journeys, sessionsHTML, trafficTableHTML } from "./lib/traffic-view.js";
import { END, answers, ENGINES, QUESTIONS, TOPICS, ACTIONS, CRAWLERS } from "./lib/data.js";
import { select, parseState, fmt, pct, csv, dates } from "./lib/model.js";
import { recommendationEvidence } from "./lib/intelligence.js";
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
import { addonURL, addonFromPath } from "./lib/addons.js";
import { addonRowHTML, addonDetailHTML, addonDemoHTML } from "./lib/addons-view.js";

import {
  VIEWS,
  resolveView,
  metricForView,
  pageURL,
} from "./lib/navigation.js";

const $ = (s) => document.querySelector(s);
const state = { ...parseState(location.search), ...parseTrafficState(location.search) };
let currentView = resolveView(location);
state.metric = metricForView(currentView, state.metric);
let trafficData, locationView = "country", deviceView = "device", trafficPageView = "landing";
let filters;
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
  if (currentView === "addons" && addonFromPath(location.pathname)) return;
  history.replaceState(null, "", pageURL(currentView, state));
  syncPageLinks();
}
function syncPageLinks() {
  document
    .querySelectorAll("[data-route]")
    .forEach((link) => (link.href = pageURL(link.dataset.route, link.dataset.sourceScope ? { ...state, source: state.engine || link.dataset.sourceScope, country: "", device: "" } : link.dataset.route === "traffic" && currentView !== "traffic" ? { ...state, source: state.engine || state.source } : state)));
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
  $('#traffic-metrics').hidden = currentView !== 'traffic';
  $('#discovery-metrics').hidden = currentView === 'traffic';
  filters?.close();
  $('#traffic-milestones').hidden = currentView !== 'traffic';
  const product = currentView === "addons" ? addonFromPath(location.pathname) : null;
  document.title = `${product?.name || VIEWS[currentView]} · Acme · Mentionloom`;
  $("#page-title").textContent = product?.name || VIEWS[currentView];
  $("#next-move").hidden = currentView !== "overview";
  $("#recommendation-summary").hidden = !["overview", "questions"].includes(currentView);
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
  if (view === 'traffic' && currentView !== 'traffic') state.source = state.engine || state.source || '';
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
    const metric = previousFocus.dataset.trafficMetric;
    const target = metric ? `[data-traffic-metric="${metric}"]` : 'days' in patch ? '[data-menu="period-menu"]' : '#filters-toggle';
    $(target)?.focus({ preventScroll: true });
  }
  $("#filter-status").textContent =
    currentView === "traffic" ? `Showing ${trafficData.current.referrals} visits, ${sourceLabel(state.source)}, ${countryLabel(state.country)}, ${state.device || "all devices"}.` :
    `Showing ${state.days} days, ${state.engine ? engine(state.engine).name : "all engines"}, ${state.topic || "all topics"}. ${fmt(data.current.samples)} sampled answers.`;
}
function render() {
  data = select(state);
  trafficData = selectTraffic(trafficScope());
  const intelligence = recommendationEvidence(data.a);
  $("#recommendation-summary").innerHTML = `<div class="mini-stats recommendation-stats">
    <button class="stat" data-action="recommendation-details"><span>Recommendation share${icon("right")}</span><strong>${pct(intelligence.share)}</strong></button>
    <button class="stat" data-action="lost-questions"><span>Lost questions${icon("right")}</span><strong>${intelligence.lostQuestions}<small> / ${intelligence.questions}</small></strong></button>
  </div>`;
  $("#period-label").textContent = `Last ${state.days} days`;
  const range = `${date(data.start)} – ${date(data.end)}, 2026`;
  $('[data-menu="period-menu"]').title = range;
  $("#period-range").textContent = range;
  filters?.render();
  document.querySelectorAll("[data-days]").forEach((b) => {
    b.setAttribute(
      "aria-selected",
      String(Number(b.dataset.days) === state.days),
    );
    b.querySelector(".option-check").innerHTML =
      Number(b.dataset.days) === state.days ? icon("check") : "";
  });
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
      `<b class="${diff < 0 ? "negative" : ""}">${!before && key !== "visibility" ? data.current[key] ? "New" : "No change" : `${diff >= 0 ? "↗" : "↘"} ${Math.abs(diff).toFixed(1)}${key === "visibility" ? " pp" : "%"}`}</b>`;
    $("#delta-" + key).title = `Change versus the previous ${state.days} days`;
    const b = $(`[data-metric="${key}"]`);
    b.title = `${LABELS[key]} · Change versus the previous ${state.days} days. Select to view the chart.`;
    b.classList.toggle("active", state.metric === key);
    b.setAttribute("aria-pressed", String(state.metric === key));
    b.setAttribute("aria-controls", "main-chart");
    sparkline(
      $(`[data-spark="${key}"]`),
      data.series.map((d) => d[key]),
    );
  }
  renderMainChart();
  renderEngines();
  renderCompetitors();
  renderPages();

  renderQuestions();
  renderActions();
  renderPageSummaries();
  renderGrowth();
  renderAddons();
  renderTraffic();
  renderNavUpdates();
}
function renderNavUpdates() {
  const stored = load("nav-seen", {}),
    seen = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {},
    revision = `${END}:${answers.length}`,
    signals = { questions: "New answer samples", opportunities: "New recommendations to review" };
  if (signals[currentView] && seen[currentView] !== revision) {
    seen[currentView] = revision;
    store("nav-seen", seen);
  }
  for (const [view, label] of Object.entries(signals)) {
    const link = $(`.page-navigation [data-route="${view}"]`),
      unread = seen[view] !== revision;
    link.querySelector(".nav-update").hidden = !unread;
    if (unread) {
      link.setAttribute("aria-label", `${VIEWS[view]} · ${label.toLowerCase()}`);
      link.title = label;
    } else {
      link.removeAttribute("aria-label");
      link.removeAttribute("title");
    }
  }
}
function renderMainChart() {
  if ($("#report-core").hidden) return;
  if (currentView === "traffic") return renderTrafficChart();
  $("#traffic-milestones").hidden = true;
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
  const comparison = dates(state.days, true),
    comparing = $("#compare-toggle").checked;
  $("#compare-label").textContent = `Compare with prior ${state.days} days`;
  $("#compare-toggle").closest("label").title = `Show a dashed line for ${date(comparison.start)} – ${date(comparison.end)}`;
  $("#chart-legend").textContent = `${date(data.start)} – ${date(data.end)}`;
  $("#comparison-legend").hidden = !comparing;
  $("#comparison-dates").textContent = `${date(comparison.start)} – ${date(comparison.end)}`;
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
    engineView === "visibility" ? "Rate" : "Sessions";
  const max =
    engineView === "visibility"
      ? 100
      : Math.max(...data.engines.map((e) => e.referrals), 1);
  $("#engine-rows").innerHTML = data.engines
    .slice()
    .sort((a, b) => b[engineView] - a[engineView])
    .slice(0, rankingPreviewCount())
    .map(
      (e) =>
        `<button class="rank-row ${state.engine === e.id ? "self" : ""}" data-engine="${e.id}" style="--share:${(e[engineView] / max) * 100}%">${engineIcon(e)}<span class="rank-name">${e.name}</span><span class="rank-value">${format(e[engineView], engineView)}</span>${icon("filter")}</button>`,
    )
    .join("");
  $("#engines-more").textContent = data.engines.length === 1 ? "View engine" : `View all ${data.engines.length} engines`;
}
function rankingPreviewCount() {
  return Math.min(5, data.engines.length, data.competitors.length);
}
function renderCompetitors() {
  $("#competitor-rows").innerHTML = data.competitors
    .slice(0, rankingPreviewCount())
    .map(
      (c, i) =>
        `<button class="rank-row ${c.self ? "self" : ""}" data-competitor="${esc(c.name)}" style="--share:${c.share}%"><span class="rank-index">${i + 1}</span><span class="brand-initial ${c.self ? "self acme-mark" : ""}">${c.self ? '<img src="/assets/brands/acme.svg" width="23" height="23" alt="">' : esc(c.name.slice(0, 1))}</span><span class="rank-name">${c.name}${c.self ? ' <span class="badge">You</span>' : ""}</span><span class="rank-value">${pct(c.share)}</span>${icon("arrow")}</button>`,
    )
    .join("");
  $("#competitors-more").textContent = `View all ${data.competitors.length} brands`;
}
function renderPages() {
  selectValue($("#page-tabs"), pageView);
  const pages = pageView === "own" ? data.pages : data.external,
    max = Math.max(...pages.map((p) => p.citations), 1),
    summary = data.citationSummary,
    coverage = summary[pageView];
  $("#citation-coverage").innerHTML = `<div title="Questions with a citation from ${pageView === "own" ? "your website" : "an external source"}"><span>Cited questions</span><strong>${coverage.questions}<small> / ${summary.questions}</small></strong></div><div title="Engines citing ${pageView === "own" ? "your website" : "an external source"}"><span>Citing engines</span><strong>${coverage.engines}<small> / ${summary.engines}</small></strong></div>`;
  $("#page-rows").innerHTML =
    pages
      .slice(0, 3)
      .map(
        (p) =>
          `<button class="rank-row" data-source-page="${esc(p.path)}" style="--share:${(p.citations / max) * 88}%">${icon(pageView === "own" ? "file" : "globe")}<span class="rank-name">${esc(p.path)}</span><span class="rank-value">${fmt(p.citations)}</span>${icon("arrow")}</button>`,
      )
      .join("") ||
    '<div class="citation-empty">No cited pages</div>';
  $("#pages-total").textContent = `${pages.length} sources`;
  $("#citation-mix").innerHTML = `<div class="citation-mix-values"><div><span>Your website</span><strong>${pct(summary.websiteShare)}</strong><small>${fmt(summary.own.citations)} citations</small></div><div><span>External sources</span><strong>${pct(summary.total ? 100 - summary.websiteShare : 0)}</strong><small>${fmt(summary.external.citations)} citations</small></div></div><div class="citation-mix-bar" role="img" aria-label="${fmt(summary.own.citations)} website citations and ${fmt(summary.external.citations)} external citations, ${fmt(summary.total)} total"><span style="width:${summary.websiteShare}%"></span></div><div class="citation-source-counts"><div><span>Website pages</span><strong>${summary.own.pages}</strong></div><div><span>External sources</span><strong>${summary.external.pages}</strong></div></div>`;
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

}

function limitOverviewList(id) {
  const list = document.getElementById(id);
  list.nextElementSibling?.matches('.list-more') && list.nextElementSibling.remove();
  list.classList.add('overview-scroll-list');
  list.classList.remove('is-expanded');
  list.scrollTop = 0;
  const rows = [...list.children];
  rows.forEach((row, index) => row.hidden = index >= 4);
  if (rows.length <= 4) return;
  const button = document.createElement('button');
  button.className = 'text-button list-more';
  button.textContent = `Show more (${rows.length - 4})`;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Show less' : `Show more (${rows.length - 4})`;
    list.classList.toggle('is-expanded', expanded);
    rows.forEach((row, index) => row.hidden = !expanded && index >= 4);
    list.scrollTo({ top: expanded ? 60 : 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  list.after(button);
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
function answerSamplesHTML(rows) {
  if (!rows.length) return empty("No samples in this view", "Change the topic filter to see this question’s measurements.");
  return answerCard(rows[0]) + (rows.length > 1 ? `<details class="evidence-disclosure"><summary>More engine answers<span class="disclosure-end">${rows.length - 1}${icon("down")}</span></summary>${rows.slice(1).map(answerCard).join("")}</details>` : "");
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
  const evidence = questionEvidenceHTML(rows);
  detail(
    q.text,
    q.topic + " · BUYER QUESTION",
    `<div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(rows.length ? (hits / rows.length) * 100 : 0)}</strong></div><div><span>Answers sampled</span><strong>${fmt(rows.length)}</strong></div></div>${evidence}<h3>${specific ? "Selected answer" : "Latest answers"}</h3>${answerSamplesHTML(specific ? [specific] : latest)}<h3>Target page</h3><button class="rank-row self" data-source-page="${q.page}" style="--share:100%">${icon("file")}<span class="rank-name">acme.work${q.page}</span>${icon("arrow")}</button>${
      ACTIONS.some((a) => a.question === id)
        ? `<h3>Next move</h3><div class="drawer-list">${ACTIONS.filter(
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
function questionEvidenceHTML(rows) {
  const e = recommendationEvidence(rows);
  if (!e.lostAnswers) return '<p class="small-label">No competitor-only answers in this sample.</p>';
  return `<div class="benchmark-heading"><h3>Competitors</h3><span>${e.lostAnswers} / ${e.samples} answers</span></div><div class="rank-list">${e.competitors.map((c) => `<button class="rank-row" data-competitor="${esc(c.name)}"><span class="rank-name">${esc(c.name)}</span><span class="rank-value">${c.count}</span>${icon("right")}</button>`).join("")}</div><details class="evidence-disclosure"><summary>Cited sources<span class="disclosure-end">${e.sources.length}${icon("down")}</span></summary><div class="rank-list">${e.sources.map((s) => `<button class="rank-row" data-source-page="${esc(s.name)}"><span class="rank-name">${esc(s.name)}</span><span class="rank-value">${s.count} citations</span>${icon("right")}</button>`).join("")}</div><p>Sources cited in answers naming competitors without Acme. Frequency shows association, not causation.</p></details>`;
}
function openRecommendationEvidence(id) {
  const q = data.questions.find((question) => question.id === id);
  if (!q) return;
  detail(q.text, "RECOMMENDATION EVIDENCE", `<div class="drawer-stats"><div><span>Answers missing Acme</span><strong>${fmt(q.samples - q.mentions)}<small> / ${fmt(q.samples)}</small></strong></div><div><span>Mention rate</span><strong>${q.samples ? pct(q.visibility) : "—"}</strong></div></div>${questionEvidenceHTML(q.rows)}<details><summary>How to read this${icon("down")}</summary><p>The visibility gap counts every answer missing Acme. Competitor counts include only answers naming that brand without Acme, so the totals can differ. A brand may appear alongside other competitors; frequency is not a shortlist position. All counts follow your current filters.</p></details><button class="button" data-question="${q.id}">Explore answers${icon("right")}</button>`);
}
function recommendationDetails() {
  const e = recommendationEvidence(data.a);
  detail("Recommendation share", "METRIC DETAILS", `<div class="drawer-stats"><div><span>Shortlisted answers</span><strong>${fmt(e.recommendations)}</strong></div><div><span>Total answers</span><strong>${fmt(e.samples)}</strong></div></div><p>${pct(e.share)} of sampled answers record an Acme shortlist position.</p><details><summary>Definition${icon("down")}</summary><p>Shortlisted answers divided by all sampled answers in the selected period, engines, and topics. Mention rate remains available in Visibility. The demo assigns a position to every mention, so these two rates currently match.</p></details><button class="button" data-action="lost-questions">Explore lost questions${icon("right")}</button>`);
}
function lostQuestions() {
  const e = recommendationEvidence(data.a);
  const questions = data.questions.map((q) => ({ ...q, losses: recommendationEvidence(q.rows).lostAnswers })).filter((q) => q.losses).sort((a, b) => b.losses - a.losses);
  detail("Lost questions", "RECOMMENDATION GAPS", `<div class="drawer-stats"><div><span>Questions with losses</span><strong>${e.lostQuestions}<small> / ${e.questions}</small></strong></div><div><span>Lost answers</span><strong>${fmt(e.lostAnswers)}</strong></div></div><div class="benchmark-heading"><h3>Buyer question</h3><span>Lost answers</span></div><div class="benchmark-list">${questions.map((q) => `<button class="benchmark-question" data-question="${q.id}"><span class="benchmark-question-copy"><strong>${esc(q.text)}</strong></span><span class="benchmark-count"><strong>${q.losses}</strong></span>${icon("right")}</button>`).join("") || '<p>No lost questions in this view.</p>'}</div><details><summary>Definition${icon("down")}</summary><p>A lost question has at least one sampled answer naming a competitor without Acme. The same question can also have wins on other dates or engines. Counts follow your current filters; pending questions are excluded.</p></details>`);
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
    `<div class="drawer-stats"><div><span>Sampled citations</span><strong>${fmt(rows.length)}</strong></div><div><span>${own ? "AI referrals" : "Distinct questions"}</span><strong>${own ? fmt(v.length) : new Set(rows.map((r) => r.question)).size}</strong></div></div><div class="notice">${own ? "Website citations and referrals are separate signals. We cannot tie a particular click to a specific private AI conversation." : "External sources are pages cited in sampled answers. They can shape the answer even when your own website is not cited."}</div><h3>Source answers</h3><div class="drawer-list">${answersList(rows) || empty("No citations in this view", "Try another reporting period or filter.")}</div>${
      own
        ? `<h3>Page traffic</h3><table class="data-table"><thead><tr><th>Engine</th><th>Sessions</th><th>Leads</th></tr></thead><tbody>${ENGINES.filter(
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
    `<p class="benchmark-scope">${state.engine ? esc(engine(state.engine).name) : "All engines"} · ${date(data.start)} – ${date(data.end)} · Sample data</p><div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(c.share)}</strong></div><div><span>${name === "Acme" ? "Answers mentioning you" : "Answers without Acme"}</span><strong>${fmt(name === "Acme" ? c.count : gaps.length)}</strong></div></div><div class="benchmark-heading"><h3>${name === "Acme" ? "Mentions" : "Visibility gaps"}</h3><span>${grouped.length} questions</span></div><p class="benchmark-description">${name === "Acme" ? "Ranked by sampled mentions." : esc(name) + " appears in these answers without Acme. Open a question to inspect the latest sample."}</p><div class="benchmark-list">${evidence || empty("No missing mentions here", "Acme appears alongside this brand in the current sample.")}</div><details class="benchmark-method"><summary>How this is measured</summary><p>${fmt(c.count)} of ${fmt(data.current.samples)} sampled answers mention ${esc(name)}. Each question groups its matching answers across this reporting period. Multiple brands can appear in one answer; rates do not add to 100%.</p></details>`,
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
      { ...action, evidence: recommendationEvidence(data.a.filter((r) => r.question === action.question)) },
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
  const buckets = [];
  for (let i = 0; i < data.series.length; i += Math.ceil(data.series.length / 30)) {
    const group = data.series.slice(i, i + Math.ceil(data.series.length / 30));
    buckets.push({ start: group[0].date, end: group.at(-1).date, count: group.reduce((sum, day) => sum + day.referrals, 0) });
  }
  const peak = Math.max(0, ...buckets.map((b) => b.count));
  const zeroDays = data.series.filter((day) => day.referrals === 0).length;
  $("#context-referrals").innerHTML = `<div class="context-total"><strong>${fmt(data.current.referrals)}</strong><span>visits · ${state.days} days</span></div><div class="context-chart-scale"><span>Peak: ${peak} ${state.days > 30 ? "visits / 3 days" : "visits / day"}</span></div><div class="context-bars">${buckets.map((b) => `<button data-context-start="${b.start}" data-context-end="${b.end}" aria-label="${date(b.start)}${b.start === b.end ? "" : ` to ${date(b.end)}`}: ${fmt(b.count)} AI ${b.count === 1 ? "visit" : "visits"}" title="${date(b.start)}: ${fmt(b.count)} ${b.count === 1 ? "visit" : "visits"}"><span class="${b.count ? "" : "is-zero"}" style="height:${b.count / Math.max(1, peak) * 100}%"></span></button>`).join("")}</div><div class="context-axis"><span>${date(data.start)}</span><span>${zeroDays} ${zeroDays === 1 ? "day" : "days"} with no visits</span><span>${date(data.end)}</span></div>`;
  const citationRate = data.current.mentions ? data.current.citations / data.current.mentions * 100 : 0;
  $("#context-citations").innerHTML = `<div class="context-total"><strong>${pct(citationRate)}</strong><span>of mentions link to your website</span></div><div class="context-ratio" role="img" aria-label="${fmt(data.current.citations)} citations from ${fmt(data.current.mentions)} mentions"><span style="width:${citationRate}%"></span></div><div class="context-axis"><span>${fmt(data.current.citations)} with a link</span><span>${fmt(data.current.mentions - data.current.citations)} without</span></div>`;
  const next = items.find((a) => !a.completed);
  $("#overview-next").disabled = false;
  $("#overview-next").innerHTML =
    `${next ? (growthWork[next.id] ? "Continue plan" : "Your next move") : items.length ? "Review results" : "Explore questions"}${icon("right")}`;
  $("#next-move").innerHTML = nextMoveHTML(items, growthWork);
  $("#growth-path").innerHTML = journeyHTML(items, context, growthWork);
  const losses = recommendationEvidence(data.a);
  $("#overview-competitors").innerHTML = losses.competitors.length
    ? competitorHTML(losses.competitors.map((c) => ({ ...c, share: c.count / losses.lostAnswers * 100 })))
    : '<p class="small-label">No competitor-only answers in this period.</p>';
  limitOverviewList("overview-engines");
  limitOverviewList("overview-competitors");
  $("#overview-benchmark").innerHTML =
    `Share of ${fmt(losses.lostAnswers)} answers where competitors appear without you`;
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
  const addon = ADDONS.find(item => item.id === id);
  if (!addon) return;
  document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  currentView = "addons";
  history[replace ? "replaceState" : "pushState"](null, "", addonURL(id));
  showPage();
  renderAddons();
  $("#page-title").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderAddons() {
  const addon = currentView === "addons" ? addonFromPath(location.pathname) : null;
  const root = $("#addon-marketplace");
  if (addon) {
    $("#page-title").textContent = addon.name;
    document.title = `${addon.name} · Add-ons · Mentionloom`;
    root.innerHTML = `<a class="market-back" href="/app/addons/" data-route="addons">${icon("right")} All add-ons</a>${addonDetailHTML(addon, addonState[addon.id])}`;
  } else {
    root.innerHTML = `<div class="market-intro"><div><h2>Tools for your next step</h2><p>Content, monitoring and reporting. Add what your team needs.</p></div><label class="market-search">${icon("search")}<input type="search" id="market-search" placeholder="Search add-ons" aria-label="Search add-ons"></label></div><div class="market-toolbar"><div class="market-categories" aria-label="Product categories">${["All products", "Content", "Monitoring", "Reporting", "Attribution"].map((c,i)=>`<button class="button" data-market-category="${c}" aria-pressed="${i===0}">${c}</button>`).join("")}</div><span class="small-label">Sample pricing · USD / month</span></div><div class="market-grid">${ADDONS.map(a=>`<div data-product-category="${a.category}" data-product-search="${esc(`${a.name} ${a.description}`.toLowerCase())}">${addonRowHTML(a,addonState[a.id])}</div>`).join("")}</div><p id="market-empty" class="market-empty" hidden>No add-ons match. Try another search or category.</p>`;
  }
}
function filterMarketplace() {
  const category = document.querySelector('[data-market-category][aria-pressed="true"]')?.dataset.marketCategory;
  const query = $("#market-search")?.value.trim().toLowerCase() || "";
  let count = 0;
  document.querySelectorAll("[data-product-category]").forEach(el => {
    el.hidden = (category !== "All products" && el.dataset.productCategory !== category) || !el.dataset.productSearch.includes(query);
    if (!el.hidden) count++;
  });
  $("#market-empty").hidden = count > 0;
}
document.addEventListener("input", event => { if (event.target.id === "market-search") filterMarketplace(); });
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
function openDay(start, end = start, metric = state.metric) {
  const rows = data.a.filter((r) => r.date >= start && r.date <= end),
    visits = data.v.filter((r) => r.date >= start && r.date <= end);
  if (["referrals", "leads"].includes(metric)) {
    const sources = ENGINES.map((engine) => ({ ...engine, rows: visits.filter((visit) => visit.engine === engine.id) })).filter((engine) => engine.rows.length);
    detail(
      date(start) + (end !== start ? " – " + date(end) : ""),
      "VISITS FROM AI",
      `<div class="drawer-stats"><div><span>AI visits</span><strong>${fmt(visits.length)}</strong></div><div><span>Leads</span><strong>${fmt(visits.filter((visit) => visit.lead).length)}</strong></div></div>${visits.length ? `<h3>Sources</h3><table class="data-table"><thead><tr><th>Source</th><th>Visits</th><th>Leads</th></tr></thead><tbody>${sources.map((source) => `<tr><td><span class="daily-source">${engineIcon(source)}${esc(source.name)}</span></td><td>${source.rows.length}</td><td>${source.rows.filter((visit) => visit.lead).length}</td></tr>`).join("")}</tbody></table>` : '<div class="empty-state"><h3>No AI visits in this period</h3><p>No attributed visits match the selected dates and filters.</p></div>'}`,
    );
    return;
  }
  detail(
    date(start) + (end !== start ? " – " + date(end) : ""),
    "DAILY DETAIL · " + LABELS[metric].toUpperCase(),
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
function sourceDetails() {
  detail(
    "Data setup",
    "WORKSPACE",
    `<p>This workspace uses sample data. Live connections are not available yet.</p><dl class="data-setup-list"><div><dt>AI answers</dt><dd>Answer samples power mention rates and citations.</dd></div><div><dt>Website analytics</dt><dd>Visits and events power traffic and conversions.</dd></div><div><dt>Server logs</dt><dd>Optional crawler monitoring for Crawler Guard.</dd></div></dl>`,
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
  if (currentView === "traffic") return exportTraffic();
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
function trafficScope() {
  return { days: state.days, source: state.source || '', country: state.country || '', device: state.device || '' };
}
function renderTraffic() {
  const c = trafficData.current;
  $('#traffic-metrics').innerHTML = Object.entries(TRAFFIC_METRICS).map(([key, label]) => {
    const before = trafficData.previous[key], diff = before ? (c[key] - before) / before * 100 : 0;
    const change = before ? `${diff < 0 ? '↘' : '↗'} ${Math.abs(diff).toFixed(1)}%` : c[key] ? 'New' : 'No change';
    return `<button class="metric ${state.metric === key ? 'active' : ''}" data-traffic-metric="${key}" aria-pressed="${state.metric === key}" aria-controls="main-chart"><span class="metric-label">${label}</span><span class="metric-value">${fmt(c[key])}</span><span class="metric-comparison" title="Compared with prior ${state.days} days"><b class="${diff < 0 ? 'negative' : ''}">${change}</b></span></button>`;
  }).join('');
  $('#traffic-usage').innerHTML = usageHTML(trafficData);
  $('#traffic-engines').innerHTML = sourcesHTML(trafficData);
  $('#traffic-funnel').innerHTML = funnelHTML(trafficData);
  $('#traffic-funnel-total').textContent = `${pct(c.referrals ? c.leads / c.referrals * 100 : 0)} visit-to-lead conversion`;
  $('#traffic-locations').innerHTML = locationsHTML(trafficData, locationView, 3);
  $('#traffic-devices').innerHTML = devicesHTML(trafficData, deviceView, 3);
  $('#traffic-pages').innerHTML = pagesHTML(trafficData, trafficPageView);
  $('#traffic-page-unit').textContent = trafficPageView === 'all' ? 'Page views' : 'Visits';
  $('#traffic-journeys').innerHTML = journeysHTML(trafficData);
  selectValue($('#location-view'), locationView);
  selectValue($('#device-view'), deviceView);
  selectValue($('#traffic-page-view'), trafficPageView);
}
function renderTrafficChart() {
  const comparing = $('#compare-toggle').checked, comparison = dates(state.days, true);
  $('#chart-description').textContent = TRAFFIC_METRICS[state.metric] + (state.days === 90 ? ' · every 3 days' : '');
  $('#chart-context').textContent = '';
  $('#compare-label').textContent = `Compare with prior ${state.days} days`;
  $('#compare-toggle').closest('label').title = `${date(comparison.start)} – ${date(comparison.end)}`;
  $('#chart-legend').textContent = `${date(trafficData.start)} – ${date(trafficData.end)}`;
  $('#comparison-legend').hidden = !comparing;
  $('#comparison-dates').textContent = `${date(comparison.start)} – ${date(comparison.end)}`;
  $('#sample-count').textContent = `${fmt(trafficData.current.referrals)} visits · Sample data`;
  $('#traffic-milestones').hidden = !trafficData.milestones.length;
  $('#traffic-milestones').innerHTML = trafficData.milestones.map((event, i) => `<button class="text-button" data-milestone="${event.id}"><span class="milestone-number">${i + 1}</span>${date(event.date)} · ${event.label}${icon('right')}</button>`).join('');
  renderChart($('#main-chart'), trafficData.series, state.metric, comparing, openTrafficDay, { label: TRAFFIC_METRICS[state.metric], milestones: trafficData.milestones, onMilestone: openMilestone });
}
function openTrafficSessions(title, rows, note = '') {
  const c = trafficMetrics(rows);
  detail(title, 'SAMPLE VISITS', `<div class="drawer-stats"><div><span>Visits</span><strong>${fmt(c.referrals)}</strong></div><div><span>Leads</span><strong>${fmt(c.leads)}</strong></div></div>${note ? `<p>${esc(note)}</p>` : ''}${sessionsHTML(rows.slice().sort((a,b) => b.date.localeCompare(a.date)))}`);
}
function openTrafficDay(start, end = start) {
  openTrafficSessions(date(start) + (end !== start ? ' – ' + date(end) : ''), trafficData.rows.filter(v => v.date >= start && v.date <= end));
}
function openMilestone(id) {
  const event = MILESTONES.find(e => e.id === id);
  if (!event) return;
  const rows = trafficData.rows.filter(v => v.campaign === event.campaign), c = trafficMetrics(rows);
  detail(event.title, `${date(event.date).toUpperCase()} · SAMPLE EVENT`, `<div class="traffic-event-post"><span>${esc(sourceLabel(event.source))} · Illustrative post</span><p>${esc(event.post)}</p></div><div class="drawer-stats"><div><span>Tagged visits</span><strong>${c.referrals}</strong></div><div><span>Leads</span><strong>${c.leads}</strong></div></div><p>Visits tagged to this campaign within the selected filters. The chart shows all matching visits; timing alone does not establish impact.</p>${sessionsHTML(rows)}`);
}
function openTrafficNumbers() {
  detail(TRAFFIC_METRICS[state.metric], `${date(trafficData.start)} – ${date(trafficData.end)} · ${sourceLabel(state.source)} · ${countryLabel(state.country)}`, trafficTableHTML(trafficData, state.metric, TRAFFIC_METRICS[state.metric], $('#compare-toggle').checked));
}
function exportTraffic() {
  const rows = [ ['Acme · Sample website traffic'], ['Period', trafficData.start, trafficData.end], ['Source', sourceLabel(state.source)], ['Country', countryLabel(state.country)], ['Device', state.device || 'All devices'], [], ['Date', 'Visits', 'Visitors', 'Page views', 'Leads'] ];
  trafficData.series.forEach(d => rows.push([d.date, d.referrals, d.visitors, d.pageviews, d.leads]));
  rows.push([], ['Visit ID', 'Date', 'Source', 'Country', 'City', 'Device', 'Browser', 'System', 'Entry', 'Journey', 'Seconds', 'Lead', 'Attribution', 'Campaign']);
  trafficData.rows.forEach(v => rows.push([v.id, v.date, sourceLabel(v.source), countryLabel(v.country), v.city, v.device, v.browser, v.os, v.page, v.journey.join(' → '), v.seconds, v.lead, v.method, v.campaign]));
  download(`acme-traffic-${trafficData.start}-${trafficData.end}.csv`, csv(rows));
  toast('Your filtered traffic report has been exported.');
}

const actions = {
  "recommendation-details": recommendationDetails,
  "lost-questions": lostQuestions,
  "tour-start": () => showTour(0),
  search,
  setup,
  sources: sourceDetails,
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
  "traffic-clear": () => update({ source: '', country: '', device: '' }),
  "traffic-sources": () => detail('Sources', 'VISITS', sourcesHTML(trafficData, Infinity)),
  "traffic-locations": () => detail('Locations', 'VISITS', locationsHTML(trafficData, locationView, Infinity)),
  "traffic-devices": () => detail('Devices', 'VISITS', devicesHTML(trafficData, deviceView, Infinity)),
  "traffic-pages": () => detail('Pages', trafficPageView === 'all' ? 'PAGE VIEWS' : 'VISITS', pagesHTML(trafficData, trafficPageView, Infinity)),
  "traffic-journeys": () => detail('Journeys', 'SOURCE → DESTINATION', journeysHTML(trafficData, Infinity)),
  "traffic-funnel": () => detail('Funnel', 'SAME-SESSION CONVERSION', `<p>Visits → engaged visits → pricing → signup → lead. Each stage includes only visits that reached the preceding steps. Engagement means at least 30 seconds or a second page view.</p>${funnelHTML(trafficData)}`),
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
  "chart-data": () => currentView === "traffic" ? openTrafficNumbers() :
    detail(
      LABELS[state.metric],
      "CHART DATA",
      `<p>${date(data.start)} – ${date(data.end)}, 2026. ${state.engine ? engine(state.engine).name : "All AI engines"} · ${state.topic || "All topics"}. Daily values before chart grouping.</p><button class="button" data-action="export">${icon("download")}Export report</button><table class="data-table"><thead><tr><th>Date</th><th>${LABELS[state.metric]}</th>${$("#compare-toggle").checked ? "<th>Compared with</th><th>Value</th>" : ""}</tr></thead><tbody>${data.series.map((d) => `<tr><td>${date(d.date)}</td><td>${format(d[state.metric], state.metric)}</td>${$("#compare-toggle").checked ? `<td>${date(new Date(Date.parse(d.date + "T00:00:00Z") - state.days * 86400000).toISOString().slice(0, 10))}</td><td>${format(d.previous[state.metric], state.metric)}</td>` : ""}</tr>`).join("")}</tbody></table>`,
    ),
  engines: () =>
    detail(
      "AI engines",
      engineView === "visibility" ? "MENTION RATE" : "AI REFERRALS",
      `<div class="drawer-list">${data.engines.slice().sort((a, b) => b[engineView] - a[engineView]).map((e) => `<button data-engine="${e.id}">${engineIcon(e)}<span>${esc(e.name)}<small>${fmt(e.mentions)} / ${fmt(e.samples)} answers · ${fmt(e.referrals)} referrals</small></span><strong>${format(e[engineView], engineView)}</strong>${icon("filter")}</button>`).join("")}</div>`,
    ),
  competitors: () =>
    detail(
      "Competitors",
      "SAME QUESTIONS · SAME PERIOD",
      `<p>Compare brands across ${fmt(data.current.samples)} sampled answers. Open a brand to find the questions behind its visibility.</p><div class="drawer-list">${data.competitors.map((c) => `<button data-competitor="${c.name}"><span class="brand-initial ${c.self ? "self acme-mark" : ""}">${c.self ? '<img src="/assets/brands/acme.svg" width="23" height="23" alt="">' : esc(c.name[0])}</span><span>${c.name}<small>${fmt(c.count)} answers · ${pct(c.share)} mention rate</small></span>${icon("right")}</button>`).join("")}</div>`,
    ),
  pages: () =>
    detail(
      "Cited pages",
      "SOURCES IN AI ANSWERS",
      `<p>Counts include website and external citations. An answer can cite both. Select a page to inspect its answer samples.</p><h3>Your website</h3><div class="drawer-list">${data.pages.map((p) => `<button data-source-page="${esc(p.path)}">${icon("file")}<span>acme.work${esc(p.path)}<small>${fmt(p.citations)} citations · ${fmt(p.referrals)} referrals</small></span>${icon("right")}</button>`).join("")}</div><h3>External sources</h3><div class="drawer-list">${data.external.map((p) => `<button data-source-page="${esc(p.path)}">${icon("globe")}<span>${esc(p.path)}<small>${fmt(p.citations)} sampled citations</small></span>${icon("right")}</button>`).join("")}</div>`,
    ),
  attribution: () =>
    detail(
      "The click is only the beginning.",
      "REFERRAL ATTRIBUTION",
      `<p>AI referrals are identified from a known AI referrer or campaign source. Once a visitor arrives, their session can be associated with an event on your own website.</p><div class="drawer-stats"><div><span>Identified by UTM</span><strong>${fmt(data.v.filter((v) => v.method === "UTM source").length)}</strong></div><div><span>Identified by referrer</span><strong>${fmt(data.v.filter((v) => v.method === "Referrer").length)}</strong></div></div><h3>Sample</h3><ol class="step-list"><li><span class="step-number">1</span><span>A session arrives with an AI source in the UTM or referrer.</span></li><li><span class="step-number">2</span><span>An engaged visit views another page or stays for at least 30 seconds.</span></li><li><span class="step-number">3</span><span>A lead is a form completion in that same session.</span></li></ol><div class="notice">Referrer loss means some AI visits cannot be identified. A UTM does not expose the prompt that produced a visit. This dashboard does not claim to read private chats.</div><button class="button" data-action="sources">Data setup${icon("right")}</button>`,
    ),
  crawlers: () =>
    detail(
      "A clear path for search engines.",
      "CRAWLER ACCESS · SAMPLE SNAPSHOT",
      `<p>Crawler requests tell you whether AI systems can retrieve your pages. They are separate from mentions, human visits, and conversions.</p><table class="data-table"><thead><tr><th>Crawler / purpose</th><th>Requests</th><th>Access</th></tr></thead><tbody>${CRAWLERS.map((c) => `<tr><td>${c.name}<br><span class="small-label">${c.purpose}</span></td><td>${fmt(c.count)}</td><td><span class="badge ${c.status === "Allowed" ? "green" : "neutral"}">${c.status}</span></td></tr>`).join("")}</tbody></table><div class="notice">Illustrative 30-day server-log snapshot, independent of your dashboard filters. No server or CDN is connected.</div><h3>Crawler types</h3><p>Allowing a search crawler can help it retrieve a page, but does not guarantee indexing or recommendations. Training crawlers have a different purpose and can be managed separately.</p><button class="button" data-action="sources">Data setup${icon("right")}</button>`,
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
  if (b.dataset.tour) {
    const choice = b.dataset.tour;
    if (choice === "try") {
      const step = tourSteps[tourStep];
      if (step.view === "traffic") actions["traffic-funnel"]();
      else if (step.view === "addons") detail(ADDONS[0].name, "DEMO", addonDemoHTML(ADDONS[0], addonState[ADDONS[0].id], addonPreview(ADDONS[0])));
      else if (step.view === "questions") {
        const row = [...$(step.target).querySelectorAll('[data-question]')].find(button => data.questions.some(q => q.id === button.dataset.question && q.samples));
        const question = data.questions.filter(q => q.samples).sort((a,b) => a.visibility-b.visibility)[0];
        if (row) row.click();
        else if (question) openQuestion(question.id);
      }
      else $(step.target)?.querySelector(step.action)?.click();
      if (document.querySelector('dialog[open]')) $('#tour-shade').hidden = true;
      return;
    }
    if (choice === "close" || choice === "finish") {
      endTour(choice === "finish" ? "complete" : "dismissed");
    } else showTour(choice === "start" ? 0 : tourStep + (choice === "back" ? -1 : 1));
    return;
  }
  if (b.dataset.contextStart) {
    openDay(b.dataset.contextStart, b.dataset.contextEnd, "referrals");
    return;
  }
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
    if (b.dataset.sourceScope) Object.assign(state, { source: state.engine || b.dataset.sourceScope, country: "", device: "" });
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
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openAddon(b.dataset.addon);
    return;
  }
  if (b.dataset.marketCategory) {
    document.querySelectorAll('[data-market-category]').forEach(el => el.setAttribute('aria-pressed', String(el === b)));
    filterMarketplace();
    return;
  }
  if (b.dataset.addonDemo) {
    const addon = ADDONS.find(a => a.id === b.dataset.addonDemo);
    detail(addon.name, "DEMO", addonDemoHTML(addon, addonState[addon.id], addonPreview(addon)));
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
  if (b.dataset.trafficMetric) { update({ metric: b.dataset.trafficMetric }); return; }
  if (b.hasAttribute('data-traffic-clear')) { update({ [b.dataset.trafficClear]: '' }); return; }
  for (const key of ['source', 'country', 'device']) {
    if (b.hasAttribute('data-traffic-' + key)) {
      if ($('#detail').open) $('#detail').close();
      const value = b.getAttribute('data-traffic-' + key);
      update({ [key]: value });
      closeMenus();
      return;
    }
  }
  if (b.dataset.milestone) { openMilestone(b.dataset.milestone); return; }
  if (b.dataset.funnelStage) { const stage = trafficData.funnel.find(s => s.id === b.dataset.funnelStage); if (stage) openTrafficSessions(stage.name, stage.rows); return; }
  if (b.dataset.trafficDimension) { openTrafficSessions(b.dataset.trafficValue, trafficData.rows.filter(v => v[b.dataset.trafficDimension] === b.dataset.trafficValue)); return; }
  if (b.dataset.trafficPage) { const path = b.dataset.trafficPage, mode = b.dataset.pageMode; openTrafficSessions(path, trafficData.rows.filter(v => mode === 'all' ? v.journey.includes(path) : (mode === 'exit' ? v.journey.at(-1) : v.page) === path)); return; }
  if (b.dataset.trafficJourney) { const journey = journeys(trafficData).find(j => j.id === b.dataset.trafficJourney); if (journey) openTrafficSessions('Journey', journey.rows); return; }
  if (b.dataset.value && b.closest('#location-view')) { locationView = b.dataset.value; renderTraffic(); return; }
  if (b.dataset.value && b.closest('#device-view')) { deviceView = b.dataset.value; renderTraffic(); return; }
  if (b.dataset.value && b.closest('#traffic-page-view')) { trafficPageView = b.dataset.value; renderTraffic(); return; }
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
    if ($("#detail").open) $("#detail").close();
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
    update({ metric: b.dataset.metric });
    return;
  }
  if (b.dataset.recommendationQuestion) {
    openRecommendationEvidence(b.dataset.recommendationQuestion);
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
        `<p>We’ve saved <strong>${esc(url.hostname)}</strong> in this browser. Here’s what needs to be connected to make the dashboard yours.</p><ol class="step-list"><li><span class="step-number">1</span><span>Verify your domain and define the buyer questions you want to track.</span></li><li><span class="step-number">2</span><span>Connect answer sampling to collect mentions and citations.</span></li><li><span class="step-number">3</span><span>Install your website collector and define a lead event.</span></li></ol><div class="notice">This is a saved plan, not an active connection. The Acme dashboard continues to show sample data.</div><button class="button" data-action="sources">Data setup${icon("right")}</button>`,
      );
      toast("Setup plan saved in this browser.");
    }
  }
});
showPage();
addEventListener("popstate", () => {
  Object.assign(state, parseState(location.search), parseTrafficState(location.search));
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
filters = createFilters({
  getState: () => state,
  onChange: update,
  getDefinitions: () => currentView === 'traffic' ? [
    { key: 'source', label: 'Source', icon: 'link', values: [...Object.entries(SOURCE_GROUPS).map(([id,name]) => ({ id, name })), ...TRAFFIC_SOURCES.map(source => ({ ...source, icon: source.logo ? `<img src="/assets/brands/${source.logo}.svg" width="20" height="20" alt="">` : icon(source.glyph || 'globe') }))] },
    { key: 'country', label: 'Country', icon: 'globe', values: COUNTRIES },
    { key: 'device', label: 'Device', icon: 'layout', values: DEVICES.map(name => ({ id: name, name })) },
  ] : [
    { key: 'engine', label: 'Engine', icon: 'spark', values: ENGINES.map(value => ({ ...value, icon: engineIcon(value) })) },
    { key: 'topic', label: 'Topic', icon: 'target', values: TOPICS.map(name => ({ id: name, name })) },
  ],
});
render();
await enhance(document.querySelector(".question-controls"));
await enhance(document.querySelector(".opportunity-toolbar"));
await enhance(document.querySelector(".breakdown-grid"));
await enhance(document.querySelector(".traffic-grid"));
showPage();
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
const recommendationCard = $('#next-move');
let recommendationVisible = false;
const syncRecommendationMotion = () => recommendationCard.classList.toggle('agent-visible', recommendationVisible && !document.hidden);
const recommendationObserver = new IntersectionObserver(entries => {
  recommendationVisible = entries.some(entry => entry.isIntersecting);
  syncRecommendationMotion();
}, { threshold: 0.05 });
recommendationObserver.observe(recommendationCard);
document.addEventListener('visibilitychange', syncRecommendationMotion);
let tourStep = -1;
const tourSteps = [
  { view: "overview", target: "#discovery-metrics", action: '[data-metric="visibility"]', title: "Choose a signal", copy: "Select a metric to see how it changed. Mention rate measures how often Acme appears in sampled AI answers.", task: "Select mention rate" },
  { view: "questions", target: ".question-table-wrap", title: "Find a missing answer", copy: "Start with a buyer question where Acme rarely appears. Open a row to inspect the sampled answer.", task: "Open a buyer question" },
  { view: "opportunities", target: "#action-cards", action: '[data-improvement]', title: "Turn evidence into work", copy: "Each opportunity connects a visibility gap to a page you can improve and a plan you can follow.", task: "Open an improvement" },
  { view: "traffic", target: ".traffic-card:has(#traffic-funnel)", title: "Follow the visit", copy: "See how website visits progress to engagement, pricing, signup and a lead. Select a stage to inspect its sessions.", task: "Explore the funnel" },
  { view: "addons", target: ".market-card", title: "Add a capability", copy: "Explore focused tools for content, monitoring and reporting. Each product has a preview and its own pricing.", task: "Preview Brief Studio" },
];
let tourActive = false;
function positionTour() {
 const shade = $('#tour-shade');
 if (!tourActive || document.querySelector('dialog[open]')) { shade.hidden = true; return; }
 const target = $(tourSteps[tourStep].target);
 if (!target) { shade.hidden = true; return; }
 const panel = $('#demo-tour'), rect = target.getBoundingClientRect();
 const panelHeight = panel.offsetHeight;
 const maxBottom = Math.max(8,innerHeight-panelHeight-44);
 const top = Math.min(maxBottom,Math.max(8,rect.top-8)), left = Math.min(innerWidth-8,Math.max(8,rect.left-8));
 const right = Math.max(left,Math.min(innerWidth-8,rect.right+8));
 const bottom = Math.max(top,Math.min(rect.bottom+8,maxBottom));
 const panes = [...shade.querySelectorAll(':scope > div')];
 const boxes = [[0,0,innerWidth,top],[0,bottom,innerWidth,innerHeight-bottom],[0,top,left,bottom-top],[right,top,innerWidth-right,bottom-top]];
 panes.forEach((el,i)=>{ const [x,y,w,h]=boxes[i]; Object.assign(el.style,{left:x+'px',top:y+'px',width:Math.max(0,w)+'px',height:Math.max(0,h)+'px'}); });
 const frame = shade.querySelector('.tour-frame');
 Object.assign(frame.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
 frame.hidden = bottom <= top || right <= left;
 shade.hidden = false;
}
function endTour(result) {
 tourActive = false;
 $('#demo-tour').hidden = true;
 $('#tour-shade').hidden = true;
 document.body.classList.remove('tour-active');
 document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
 store('education-tour',result);
 document.querySelector('[data-tour="start"]')?.focus({preventScroll:true});
}
function showTour(index) {
 tourStep = Math.max(0,Math.min(index,tourSteps.length-1));
 const step = tourSteps[tourStep];
 tourActive = true;
 document.body.classList.add('tour-active');
 document.querySelectorAll('.tour-highlight').forEach(el=>el.classList.remove('tour-highlight'));
 navigate(step.view);
 const target = $(step.target);
 target?.classList.add('tour-highlight');
 const panel = $('#demo-tour');
 panel.hidden = false;
 panel.innerHTML = `<div class="tour-top"><span>Step ${tourStep+1} of ${tourSteps.length}</span><button class="icon-button" data-tour="close" aria-label="Close guided tour">${icon('close')}</button></div><div class="tour-progress" aria-hidden="true">${tourSteps.map((_,i)=>`<span class="${i<=tourStep?'complete':''}"></span>`).join('')}</div><h2 tabindex="-1">${step.title}</h2><p>${step.copy}</p><button class="tour-task tour-try" data-tour="try">${icon('right')}<span>${step.task}</span></button><div class="tour-actions"><button class="button ghost" data-tour="back" ${tourStep===0?'disabled':''}>Back</button><button class="button" data-tour="${tourStep===tourSteps.length-1?'finish':'next'}">${tourStep===tourSteps.length-1?'Finish tour':'Next'}${icon('right')}</button></div>`;
 target?.scrollIntoView({behavior:'instant',block:'start'});
 panel.querySelector('h2').focus({preventScroll:true});
 requestAnimationFrame(positionTour);
}
addEventListener('scroll',()=>{ if(tourActive) positionTour(); },{passive:true});
addEventListener('resize',()=>{ if(tourActive) positionTour(); });
$('#detail').addEventListener('close',()=>{ if(tourActive) requestAnimationFrame(positionTour); });
document.addEventListener('keydown',event=>{
 if (!tourActive || document.querySelector('dialog[open]')) return;
 if (event.key==='Escape') { event.preventDefault(); endTour('dismissed'); }
 if (event.key!=='Tab') return;
 const target=$(tourSteps[tourStep].target), panel=$('#demo-tour');
 const candidates=[...(target?.matches('a,button')?[target]:target?.querySelectorAll('button,a,input,[tabindex="0"]')||[]),...panel.querySelectorAll('button')].filter(el=>!el.disabled && el.getClientRects().length);
 if (!candidates.length) return;
 const index=candidates.indexOf(document.activeElement);
 event.preventDefault();
 const next = index < 0 ? (event.shiftKey ? candidates.length-1 : 0) : (index+(event.shiftKey?-1:1)+candidates.length)%candidates.length;
 candidates[next].focus();
});
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (data) renderMainChart();
  }, 160);
});

// The waitlist invitation stays put until it is dismissed, then stays gone.
{
  const cta = document.querySelector("#waitlist-cta");
  const key = "mentionloom-app-cta";
  if (cta) {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(key) === "dismissed";
    } catch {}
    if (dismissed) cta.hidden = true;
    document.querySelector("#waitlist-cta-close")?.addEventListener("click", () => {
      cta.hidden = true;
      try {
        sessionStorage.setItem(key, "dismissed");
      } catch {}
    });
  }
}
