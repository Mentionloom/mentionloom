import {
  ENGINES,
  QUESTIONS,
  TOPICS,
  ACTIONS,
  CRAWLERS,
  END,
} from "./lib/data.js";
import { select, parseState, fmt, pct, csv } from "./lib/model.js";
import {
  icon,
  engineIcon,
  escape as esc,
  number,
  animate,
  segment,
  installMenus,
  closeMenus,
  toast,
  download,
  store,
  load,
  reduced,
} from "./lib/ui.js";
import { renderChart, sparkline, LABELS } from "./lib/charts.js";

const $ = (s) => document.querySelector(s);
const state = parseState(location.search);
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
let pulseIndex = 0,
  paused = reduced.matches;
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
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function syncURL() {
  const p = new URLSearchParams();
  if (state.days !== 30) p.set("days", state.days);
  if (state.engine) p.set("engine", state.engine);
  if (state.topic) p.set("topic", state.topic);
  if (state.metric !== "visibility") p.set("metric", state.metric);
  history.replaceState(
    null,
    "",
    location.pathname + (p.size ? "?" + p : "") + location.hash,
  );
}
function update(patch) {
  Object.assign(state, patch);
  syncURL();
  render();
  $("#filter-status").textContent =
    `Showing ${state.days} days, ${state.engine ? engine(state.engine).name : "all engines"}, ${state.topic || "all topics"}. ${fmt(data.current.samples)} sampled answers.`;
}
function render() {
  data = select(state);
  $("#period-label").textContent = `Last ${state.days} days`;
  $("#engine-label").textContent = state.engine
    ? engine(state.engine).name
    : "All AI engines";
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
      "aria-pressed",
      String(Number(b.dataset.days) === state.days),
    );
    b.querySelector(".option-check").innerHTML =
      Number(b.dataset.days) === state.days ? icon("check") : "";
  });
  $("#engine-menu").innerHTML =
    '<span class="menu-label">AI engine</span>' +
    [{ id: "", name: "All AI engines" }, ...ENGINES]
      .map(
        (e) =>
          `<button data-engine="${e.id}" aria-pressed="${state.engine === e.id}">${e.id ? engineIcon(e) : icon("spark")}${e.name}<span class="option-check">${state.engine === e.id ? icon("check") : ""}</span></button>`,
      )
      .join("");
  $("#topic-menu").innerHTML =
    '<span class="menu-label">Filter by buyer intent</span>' +
    ["", ...TOPICS]
      .map(
        (t) =>
          `<button data-topic="${t}" aria-pressed="${state.topic === t}">${icon(t ? "target" : "layers")}${t || "All topics"}<span class="option-check">${state.topic === t ? icon("check") : ""}</span></button>`,
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
      `<b class="${diff < 0 ? "negative" : ""}">${diff >= 0 ? "↗" : "↘"} ${Math.abs(diff).toFixed(1)}${key === "visibility" ? " pp" : "%"}</b> vs. previous ${state.days}d`;
    const b = $(`[data-metric="${key}"]`);
    b.classList.toggle("active", state.metric === key);
    b.setAttribute("aria-pressed", String(state.metric === key));
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
  renderPulse();
  const gap = data.questions.filter((q) => q.visibility < 40).length;
  $("#insight-text").innerHTML = gap
    ? `You’re missing from most answers to <b>${gap} buying questions.</b> Let’s change that.`
    : `You appear in at least 40% of answers for every tracked question. <b>Explore the next opportunity.</b>`;
}
function renderMainChart() {
  $("#chart-description").textContent =
    {
      visibility: "Acme in sampled answers",
      citations: "Sampled answers linking to acme.work",
      referrals: "Sessions attributed to AI referrals",
      leads: "Attributed sessions with a lead event",
    }[state.metric] + (state.days === 90 ? " · grouped every 3 days" : "");
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
  segment($("#engine-tabs"), engineView);
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
        `<button class="rank-row ${state.engine === e.id ? "self" : ""}" data-engine="${e.id}" style="--share:${(e[engineView] / max) * 100}%" aria-label="Filter by ${e.name}, ${format(e[engineView], engineView)}">${engineIcon(e)}<span class="rank-name">${e.name}</span><span class="rank-value">${format(e[engineView], engineView)}</span>${icon("filter")}</button>`,
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
  segment($("#page-tabs"), pageView);
  const pages = pageView === "own" ? data.pages : data.external,
    max = Math.max(...pages.map((p) => p.citations), 1);
  $("#page-rows").innerHTML =
    pages
      .slice(0, 5)
      .map(
        (p) =>
          `<button class="rank-row" data-page="${esc(p.path)}" style="--share:${(p.citations / max) * 88}%">${icon(pageView === "own" ? "file" : "globe")}<span class="rank-name">${esc(p.path)}</span><span class="rank-value">${fmt(p.citations)}</span>${icon("arrow")}</button>`,
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
function coverage(n) {
  return `<span class="coverage-mini" aria-label="${pct(n)} mention rate">${Array.from({ length: 10 }, (_, i) => `<span class="${i < Math.round(n / 10) ? "on" : ""}"></span>`).join("")}</span>`;
}
function renderQuestions() {
  segment($("#question-tabs"), questionView);
  const query = $("#question-search").value.toLowerCase();
  let qs = [
    ...data.questions,
    ...pending
      .filter((q) => !state.topic || q.topic === state.topic)
      .map((q) => ({ ...q, pending: true, visibility: -1 })),
  ];
  $("#q-all-count").textContent = qs.length;
  $("#q-gap-count").textContent = data.questions.filter(
    (q) => q.visibility < 40,
  ).length;
  $(".nav-count").textContent = QUESTIONS.length + pending.length;
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
            `<tr><td><button class="question-link" data-question="${esc(q.id)}">${esc(q.text)}</button></td><td><span class="badge neutral">${esc(q.topic)}</span></td><td>${q.pending ? '<span class="small-label">Pending</span>' : pct(q.visibility)}</td><td>${q.pending ? '<span class="small-label">No samples</span>' : coverage(q.visibility)}</td><td><button class="icon-button" data-question="${esc(q.id)}" aria-label="Explore ${esc(q.text)}">${icon("right")}</button></td></tr>`,
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
  segment($("#action-tabs"), actionView);
  const relevant = ACTIONS.filter(
    (a) =>
      !state.topic ||
      QUESTIONS.find((q) => q.id === a.question).topic === state.topic,
  );
  $("#todo-count").textContent = relevant.filter(
    (a) => !shipped.includes(a.id),
  ).length;
  $("#shipped-count").textContent = relevant.filter((a) =>
    shipped.includes(a.id),
  ).length;
  $("#action-count").textContent = ACTIONS.filter(
    (a) => !shipped.includes(a.id),
  ).length;
  const actions = relevant.filter((a) =>
    actionView === "shipped" ? shipped.includes(a.id) : !shipped.includes(a.id),
  );
  $("#action-cards").innerHTML = actions.length
    ? actions
        .map(
          (a) =>
            `<button class="action-card" data-improvement="${a.id}"><span class="action-card-top"><span class="badge ${shipped.includes(a.id) ? "green" : "neutral"}">${shipped.includes(a.id) ? "Shipped" : a.label}</span>${icon(shipped.includes(a.id) ? "check" : "arrow")}</span><h3>${a.title}</h3><p>${a.body}</p><span class="action-card-bottom"><span>${icon("clock")}${a.effort}</span><b>${shipped.includes(a.id) ? "Review improvement" : "See the plan"}</b></span></button>`,
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
function renderPulse() {
  const rows = data.a.filter((r) => r.mention);
  const a =
    rows[
      (rows.length -
        1 -
        (pulseIndex % Math.max(rows.length, 1)) +
        rows.length) %
        rows.length
    ];
  if (!a) return;
  const q = QUESTIONS.find((q) => q.id === a.question);
  $("#pulse-event").innerHTML =
    `<div>${engineIcon(engine(a.engine))}<span>${engine(a.engine).name} · ${date(a.date)}</span></div><p>“${esc(q.text.length > 70 ? q.text.slice(0, 67) + "…" : q.text)}”</p><span class="badge ${a.cited ? "green" : "neutral"}">${icon(a.cited ? "link" : "check")}${a.cited ? "Your website was cited" : "Acme was mentioned"}</span>`;
}
function empty(title, description) {
  return `<div class="empty-state">${icon("spark")}<h3>${title}</h3><p>${description}</p></div>`;
}
function detail(title, eyebrow, html, replace = false) {
  closeMenus();
  if ($("#search-dialog").open) $("#search-dialog").close();
  if ($("#detail").open && !replace)
    detailHistory.push({
      title: $("#detail-title").textContent,
      eyebrow: $("#detail-eyebrow").textContent,
      html: $("#detail-body").innerHTML,
      scroll: $("#detail").scrollTop,
    });
  if (!$("#detail").open) detailHistory = [];
  $("#detail-title").textContent = title;
  $("#detail-eyebrow").textContent = eyebrow;
  $("#detail-body").innerHTML = html;
  $("#drawer-back").hidden = !detailHistory.length;
  $("#detail").scrollTop = 0;
  if (!$("#detail").open) $("#detail").showModal();
  hydrate($("#detail"));
  $("#detail-title").focus({ preventScroll: true });
}
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
    `<div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(rows.length ? (hits / rows.length) * 100 : 0)}</strong></div><div><span>Answers sampled</span><strong>${fmt(rows.length)}</strong></div></div><div class="notice">${date(data.start)} – ${date(data.end)} · ${state.engine ? engine(state.engine).name : "All AI engines"}. These are sample answers, not access to private conversations.</div><h3>${specific ? "Selected answer" : "Latest answer by engine"}</h3>${(specific ? [specific] : latest).map(answerCard).join("") || empty("No samples in this view", "Change the topic filter to see this question’s measurements.")}<h3>Make this answer easier to find</h3><p class="small-label">Related landing page</p><button class="rank-row self" data-page="${q.page}" style="--share:100%">${icon("file")}<span class="rank-name">acme.work${q.page}</span>${icon("arrow")}</button>${
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
  detail(
    name,
    name === "Acme" ? "YOUR BRAND" : "COMPETITOR BENCHMARK",
    `<div class="drawer-stats"><div><span>Mention rate</span><strong>${pct(c.share)}</strong></div><div><span>Answers mentioning ${esc(name)}</span><strong>${fmt(c.count)}</strong></div></div><div class="notice">Calculated across the same ${fmt(data.current.samples)} sampled answers. Multiple brands can be mentioned in one answer, so rates do not add to 100%.</div><h3>${name === "Acme" ? "Recent mentions" : "Answers where " + esc(name) + " appears without Acme"}</h3><div class="drawer-list">${answersList(name === "Acme" ? rows : gaps) || empty("No missing mentions here", "Acme appears alongside this brand in the current sample.")}</div>`,
  );
}
function openAction(id, replace = false) {
  const a = ACTIONS.find((a) => a.id === id);
  if (!a) return;
  const done = shipped.includes(id),
    q = QUESTIONS.find((q) => q.id === a.question);
  detail(
    a.title,
    done ? "IMPROVEMENT · SHIPPED" : a.label.toUpperCase(),
    `<p>${a.body}</p><span class="badge neutral">${icon("clock")}${a.effort}</span><h3>The question behind it</h3><div class="drawer-list"><button data-question="${a.question}">${icon("spark")}<span>${q.text}</span>${icon("right")}</button></div><h3>Your plan</h3><ol class="step-list">${a.steps.map((s, i) => `<li><span class="step-number">${done ? icon("check") : i + 1}</span><span>${s}</span></li>`).join("")}</ol><div class="source-callout">${icon("file")}<span>Suggested page<br><strong>acme.work${a.path}</strong></span></div><button class="button ${done ? "" : "primary"}" data-ship="${id}">${icon(done ? "up" : "check")}${done ? "Move back to to do" : "Mark as shipped"}</button><div class="notice">${done ? "Saved in this browser. Future answer samples would show whether visibility changed." : "Marking this shipped records your progress in this browser. It does not publish content or change your measured visibility."}</div>`,
    replace,
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
function sources() {
  detail(
    "Bring your own signals.",
    "DATA SOURCES",
    `<p>The demo is ready to explore. Connect your data to turn these examples into your own discovery dashboard.</p>${[
      [
        "spark",
        "Answer sampling",
        "Track questions, markets, languages, and answer engines. Keep the original answer and citations as evidence.",
      ],
      [
        "code",
        "Website analytics",
        "Install an event collector to capture landing pages, AI referrers, campaign parameters, and consented conversion events.",
      ],
      [
        "globe",
        "Server or CDN logs",
        "Import crawler requests and verify bot identity separately from human traffic.",
      ],
      [
        "target",
        "Conversion events",
        "Define which events matter: qualified leads, trials, or purchases.",
      ],
    ]
      .map(
        ([i, t, p]) =>
          `<div class="source-item"><div class="source-title">${icon(i)}${t}<span class="badge neutral">Not connected</span></div><p>${p}</p></div>`,
      )
      .join(
        "",
      )}<div class="notice">The integration flow is a product preview. Saving a setup plan does not install a tracker or connect a provider.</div><button class="button primary" data-action="setup">Plan your setup${icon("right")}</button>`,
  );
}
function setup() {
  const saved = load("setup", {});
  detail(
    "Your website. Your next chapter.",
    "WORKSPACE SETUP · PREVIEW",
    `<p>Start with your website and the question you want to answer first. We’ll save a setup plan for this browser.</p><form id="setup-form"><label class="form-field">Website URL<input name="website" type="url" placeholder="https://yourcompany.com" value="${esc(typeof saved.website === "string" ? saved.website : "")}" required maxlength="250"></label><label class="form-field">What do you want to understand?<select name="priority"><option value="visibility">Where AI recommends my brand</option><option value="traffic">Which AI engines send visitors</option><option value="conversions">Which visits turn into customers</option></select></label><button class="button primary" type="submit">Save my setup plan${icon("right")}</button></form><div class="notice">This saves locally in the demo. No tracking code is installed and no external account is connected.</div>`,
  );
  if (["visibility", "traffic", "conversions"].includes(saved.priority))
    $("#setup-form select").value = saved.priority;
}
function addQuestion() {
  detail(
    "What should we listen for?",
    "TRACK A QUESTION",
    `<p>Write a question your future customer would ask an AI assistant. Specific questions make the evidence more useful.</p><form id="question-form"><label class="form-field">Buyer question<textarea name="question" placeholder="What is the best project management tool for a design agency?" required minlength="10" maxlength="220"></textarea></label><label class="form-field">Topic<select name="topic">${TOPICS.map((t) => `<option>${t}</option>`).join("")}</select></label><button class="button primary" type="submit">Add to tracked questions${icon("plus")}</button></form><div class="notice">New questions are saved locally with a pending status. Results require a connected answer-sampling service.</div>`,
  );
}
function search() {
  closeMenus();
  $("#global-search").value = "";
  renderSearch("");
  $("#search-dialog").showModal();
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
    ...data.pages.map((p) => ({
      kind: "page",
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
  sources,
  methodology,
  "add-question": addQuestion,
  export: exportReport,
  "clear-filters": () => update({ engine: "", topic: "" }),
  "reset-workspace": () => {
    update({ days: 30, engine: "", topic: "", metric: "visibility" });
    closeMenus();
    toast("Acme demo overview restored.");
  },
  opportunities: () => {
    questionView = "opportunity";
    showAll = true;
    renderQuestions();
    $("#questions").scrollIntoView({
      behavior: reduced.matches ? "instant" : "smooth",
    });
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
      `<p>These are the pages cited in your filtered sample. Select a source to inspect the answers behind it.</p><h3>Your website</h3><div class="drawer-list">${data.pages.map((p) => `<button data-page="${esc(p.path)}">${icon("file")}<span>acme.work${esc(p.path)}<small>${fmt(p.citations)} citations · ${fmt(p.referrals)} referrals</small></span>${icon("right")}</button>`).join("")}</div><h3>External sources</h3><div class="drawer-list">${data.external.map((p) => `<button data-page="${esc(p.path)}">${icon("globe")}<span>${esc(p.path)}<small>${fmt(p.citations)} sampled citations</small></span>${icon("right")}</button>`).join("")}</div>`,
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

document.addEventListener("click", (event) => {
  const b = event.target.closest("button,a");
  if (!b) return;
  if (b.hasAttribute("data-close")) {
    b.closest("dialog").close();
    return;
  }
  if (b.dataset.action) {
    actions[b.dataset.action]?.();
    return;
  }
  if (b.dataset.days) {
    closeMenus();
    update({ days: Number(b.dataset.days) });
    return;
  }
  if (b.hasAttribute("data-engine")) {
    closeMenus();
    update({ engine: b.dataset.engine });
    return;
  }
  if (b.hasAttribute("data-topic")) {
    closeMenus();
    update({ topic: b.dataset.topic });
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
  if (b.dataset.question) {
    openQuestion(
      b.dataset.question,
      b.dataset.answerDate,
      b.dataset.answerEngine,
    );
    return;
  }
  if (b.dataset.page) {
    openPage(b.dataset.page);
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
    const id = b.dataset.ship;
    const next = shipped.includes(id)
      ? shipped.filter((a) => a !== id)
      : [...shipped, id];
    if (store("shipped", next)) {
      shipped = next;
      renderActions();
      openAction(id, true);
      toast(
        shipped.includes(id)
          ? "Shipped. Your progress is saved."
          : "Moved back to your next moves.",
      );
    }
    return;
  }
  if (b.dataset.deleteQuestion) {
    pending = pending.filter((q) => q.id !== b.dataset.deleteQuestion);
    store("questions", pending);
    $("#detail").close();
    renderQuestions();
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
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if ($("#detail").open) $("#detail").close();
    search();
  }
});
for (const d of document.querySelectorAll("dialog"))
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  });
document.addEventListener("submit", (e) => {
  if (e.target.id === "question-form") {
    e.preventDefault();
    const f = new FormData(e.target),
      text = String(f.get("question")).trim(),
      topic = String(f.get("topic"));
    if (text.length < 10 || text.length > 220 || !TOPICS.includes(topic))
      return;
    if (
      [...QUESTIONS, ...pending].some(
        (q) => q.text.toLowerCase() === text.toLowerCase(),
      )
    ) {
      toast("You’re already tracking that question.");
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
      $("#questions").scrollIntoView({
        behavior: reduced.matches ? "instant" : "smooth",
      });
      toast("Question saved. Waiting for an answer-sampling connection.");
    }
  }
  if (e.target.id === "setup-form") {
    e.preventDefault();
    const f = new FormData(e.target);
    const website = String(f.get("website")),
      priority = String(f.get("priority"));
    const url = new URL(website);
    if (!["http:", "https:"].includes(url.protocol)) {
      toast("Use a website beginning with https://.");
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
function setPause(value) {
  paused = value;
  document.body.classList.toggle("paused", paused);
  $("#pause-pulse").innerHTML = icon(paused ? "play" : "pause");
  $("#pause-pulse").setAttribute(
    "aria-label",
    paused ? "Play demo replay" : "Pause demo replay",
  );
}
$("#pause-pulse").addEventListener("click", () => setPause(!paused));
setInterval(() => {
  if (paused || document.hidden || !$("#pulse-event").getClientRects().length)
    return;
  const r = $("#pulse-event").getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  pulseIndex++;
  renderPulse();
  animate(
    $("#pulse-event"),
    [
      { opacity: 0.15, transform: "translateY(5px)" },
      { opacity: 1, transform: "none" },
    ],
    280,
  );
}, 5500);
reduced.addEventListener("change", (e) => {
  if (e.matches) setPause(true);
});
const sectionIds = ["overview", "questions", "actions"];
let navFrame = 0;
function updateActiveSection() {
  let active = "overview";
  for (const id of sectionIds)
    if (
      document.getElementById(id).getBoundingClientRect().top <=
      Math.min(220, innerHeight * 0.35)
    )
      active = id;
  document.querySelectorAll("[data-section]").forEach((a) => {
    a.classList.toggle("active", a.dataset.section === active);
    if (a.dataset.section === active)
      a.setAttribute("aria-current", "location");
    else a.removeAttribute("aria-current");
  });
  navFrame = 0;
}
addEventListener(
  "scroll",
  () => {
    if (!navFrame) navFrame = requestAnimationFrame(updateActiveSection);
  },
  { passive: true },
);
addEventListener("resize", updateActiveSection);
requestAnimationFrame(updateActiveSection);
addEventListener("popstate", () => {
  Object.assign(state, parseState(location.search));
  render();
});
hydrate();
installMenus();
render();
setPause(paused);
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

// Preserve links from the marketing site to the sources preview.
function openLinkedPanel() {
  if (location.hash === "#sources") sources();
}
addEventListener("hashchange", openLinkedPanel);
openLinkedPanel();
