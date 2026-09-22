import { select } from "./app/lib/model.js";
import { ACTIONS, ENGINES, QUESTIONS } from "./app/lib/data.js";
import { initializeOrbit, enhance, number, animate, openDialog, closeDialog } from "./app/lib/ui.js";
import { mountGlobe } from "./assets/globe.js?v=20260922-3";

const $ = (s) => document.querySelector(s);
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="/assets/icons/lucide.svg#i-${name}"/></svg>`;
const logo = (name) =>
  `<img src="/assets/brands/${name}.svg" width="24" height="24" alt="">`;
const format = (n) => n.toLocaleString("en-US");
function trackKobbe(name, props = {}) {
  const clean = Object.fromEntries(
    Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value).slice(0, 120)]),
  );
  const event = { name, properties: clean, timestamp: Date.now() };
  window.__kobbeEvents = window.__kobbeEvents || [];
  window.__kobbeEvents.push(event);
  if (window.__kobbeEvents.length > 200) window.__kobbeEvents.shift();
  try { window.kobbe?.track?.(name, clean); } catch {}
  try { window.dispatchEvent(new CustomEvent("kobbe:event", { detail: event })); } catch {}
}
let engine = "",
  story = "visibility",
  question = "q5",
  paused = new URLSearchParams(location.search).has("reduce"),
  ready = false;
let report = select({ days: 30, engine, topic: "" });
const base = report;
if (paused) document.body.classList.add("reduce-motion", "motion-paused");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

const globe = mountGlobe($("#discovery-globe"), { isPaused: () => paused });

function roll(id, value) {
  if (ready && !paused) number($(id), value);
  else $(id).textContent = value;
}
function motion(el) {
  if (ready && !paused) window.OrbitMotion.panel(el);
}
function chart(animateChart = false) {
  const host = $("#visibility-chart");
  const oldSvg = host.querySelector("svg");
  const oldCurrent = oldSvg?.querySelector(".plot-current.plot-incoming")?.getAttribute("d") || "";
  const oldPrevious = oldSvg?.querySelector(".plot-previous.plot-incoming")?.getAttribute("d") || "";
  const oldFill = oldSvg?.querySelector(".plot-fill.plot-incoming")?.getAttribute("d") || "";
  const width = Math.max(270, host.clientWidth || 530),
    height = 140,
    pad = 32,
    right = width - 10,
    top = 10,
    bottom = 115;
  const shouldAnimate = animateChart && ready && !paused && !reduced.matches;
  const point = (value, index) => [
    pad + (index / (report.series.length - 1)) * (right - pad),
    bottom - (value / 100) * (bottom - top),
  ];
  const curve = (points) => {
    if (points.length < 2) return "";
    const slopes = points
      .slice(1)
      .map((p, i) => (p[1] - points[i][1]) / (p[0] - points[i][0]));
    const tangents = points.map((_, i) =>
      i === 0
        ? slopes[0]
        : i === points.length - 1
          ? slopes.at(-1)
          : slopes[i - 1] * slopes[i] <= 0
            ? 0
            : 2 / (1 / slopes[i - 1] + 1 / slopes[i]),
    );
    let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x, y] = points[i],
        [nx, ny] = points[i + 1],
        dx = (nx - x) / 3;
      d += `C${(x + dx).toFixed(1)},${(y + tangents[i] * dx).toFixed(1)} ${(nx - dx).toFixed(1)},${(ny - tangents[i + 1] * dx).toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)}`;
    }
    return d;
  };
  const path = (key) =>
    curve(
      report.series.map((r, i) =>
        point(key === "previous" ? r.previous.visibility : r.visibility, i),
      ),
    );
  const main = path("visibility");
  const previous = path("previous");
  const outgoing =
    shouldAnimate && oldCurrent
      ? `<g class="plot-outgoing" aria-hidden="true">${oldFill ? `<path class="plot-fill" d="${oldFill}" fill="url(#landing-chart-fill)"/>` : ""}${oldPrevious ? `<path class="plot-previous" d="${oldPrevious}"/>` : ""}<path class="plot-current" d="${oldCurrent}"/></g>`
      : "";

  host.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Acme's daily share of monitored answers, on a zero to 100 percent scale. Move the pointer across the chart to read a date."><defs><linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".18"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${[
      0, 50, 100,
    ]
      .map((v) => {
        const y = point(v, 0)[1];
        return `<line class="plot-grid" x1="${pad}" y1="${y}" x2="${right}" y2="${y}"/><text class="plot-axis" x="0" y="${y + 4}">${v}%</text>`;
      })
      .join("")}${outgoing}<path class="plot-fill plot-incoming" d="${main} L${right},${bottom} L${pad},${bottom} Z" fill="url(#landing-chart-fill)"/><path class="plot-previous plot-incoming" d="${previous}"/><path class="plot-current plot-incoming" d="${main}"/><line id="chart-cursor" x1="${right}" x2="${right}" y1="${top}" y2="${bottom}" stroke="var(--sky-3)" stroke-dasharray="3 3"/><circle id="chart-dot" r="4" fill="var(--accent-text)" stroke="white" stroke-width="2"/><text class="plot-axis" x="${pad}" y="138">Aug 11</text><text class="plot-axis" text-anchor="end" x="${right}" y="138">Sep 9</text></svg>`;

  const svg = host.querySelector("svg");
  const currentPath = svg.querySelector(".plot-current.plot-incoming");
  const previousPath = svg.querySelector(".plot-previous.plot-incoming");
  const fillPath = svg.querySelector(".plot-fill.plot-incoming");
  const outgoingGroup = svg.querySelector(".plot-outgoing");

  function inspect(index) {
    const r = report.series[index];
    const [x, y] = point(r.visibility, index);
    $("#chart-cursor").setAttribute("x1", x);
    $("#chart-cursor").setAttribute("x2", x);
    $("#chart-dot").setAttribute("cx", x);
    $("#chart-dot").setAttribute("cy", y);
    const label = new Date(r.date + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    svg.setAttribute(
      "aria-label",
      `${label}: Acme ${r.visibility.toFixed(1)} percent, previous period ${r.previous.visibility.toFixed(1)} percent.`,
    );
  }

  if (shouldAnimate) {
    outgoingGroup &&
      animate(
        outgoingGroup,
        [
          { opacity: 0.48 },
          { opacity: 0 },
        ],
        390,
        { fill: "both", easing: LANDING_EASE },
      );
    if (currentPath) {
      const length = currentPath.getTotalLength();
      animate(
        currentPath,
        [
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: length, opacity: 0.58 },
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0, opacity: 1 },
        ],
        1040,
        { delay: 110, fill: "backwards", easing: LANDING_EASE },
      );
    }
    previousPath &&
      animate(
        previousPath,
        [{ opacity: 0 }, { opacity: 1 }],
        620,
        { delay: 190, fill: "backwards", easing: LANDING_EASE },
      );
    fillPath &&
      animate(
        fillPath,
        [
          { opacity: 0, transform: "scaleX(.04)" },
          { opacity: 1, transform: "scaleX(1)" },
        ],
        840,
        { delay: 180, fill: "backwards", easing: LANDING_EASE },
      );
    [...svg.querySelectorAll(".plot-grid,.plot-axis")].forEach((el, index) =>
      microReveal(el, 25 + index * 18, 220, 1, 0.38),
    );
    [$("#chart-cursor"), $("#chart-dot")].forEach((el, index) =>
      microReveal(el, 760 + index * 35, 220, index ? 0.82 : 1, 0.45),
    );
  }

  let chartInteractionTracked = false;
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    if (!chartInteractionTracked) {
      chartInteractionTracked = true;
      trackKobbe("product_chart_interact", { view: story, engine: engine || "all" });
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const index = Math.round(
      Math.max(
        0,
        Math.min(
          1,
          (((e.clientX - rect.left) / rect.width) * width - pad) /
            (right - pad),
        ),
      ) *
        (report.series.length - 1),
    );
    inspect(index);
  });
  inspect(report.series.length - 1);
}
const PRODUCT_CONTEXT = {
  visibility: {
    eyebrow: "RECOMMENDATION SHARE",
    title: "See who makes<br />the shortlist.",
    copy: "Measure where Acme appears across your monitored buyer questions and which competitors show up instead.",
  },
  questions: {
    eyebrow: "BUYER QUESTIONS",
    title: "Find the questions<br />worth winning.",
    copy: "Rank monitored buyer questions by recommendation share and inspect the answer each engine gives.",
  },
  opportunities: {
    eyebrow: "NEXT MOVES",
    title: "Turn weak answers<br />into work.",
    copy: "Prioritize evidence gaps by recommendation share and open the most useful content opportunities first.",
  },
};

const BUYER_QUESTION_IDS = ["q1", "q3", "q5", "q7", "q8", "q9"];

function answerForEngine(q, record, engineId) {
  const base = record?.mention ? q.excerpt : q.missing;
  const variants = {
    chatgpt: base,
    claude: record?.mention
      ? `is worth considering here. ${base}`
      : `For this question, the strongest answer would compare the trade-offs explicitly. ${base}`,
    perplexity: record?.mention
      ? `is supported by the available sources as an option. ${base}`
      : `The cited evidence currently points elsewhere. ${base}`,
    gemini: record?.mention
      ? `can fit teams evaluating this workflow. ${base}`
      : `A practical comparison should focus on setup, fit, and cost. ${base}`,
    grok: record?.mention
      ? `makes the cut for this use case. ${base}`
      : `Acme is not making this shortlist yet. ${base}`,
  };
  return variants[engineId] || base;
}

function renderQuestions() {
  const candidates = report.questions
    .filter((q) => BUYER_QUESTION_IDS.includes(q.id))
    .sort((a, b) => a.visibility - b.visibility)
    .slice(0, 4);

  if (!candidates.some((q) => q.id === question)) question = candidates[0]?.id || report.questions[0]?.id;

  $("#question-rows").innerHTML = candidates
    .map(
      (q) =>
        `<button class="question-row" data-question="${q.id}" aria-pressed="${q.id === question}" aria-controls="sample-answer"><span>${q.text}</span><span>${q.visibility.toFixed(0)}%</span></button>`,
    )
    .join("");

  const q = report.questions.find((entry) => entry.id === question) || candidates[0];
  if (!q) return;

  const activeEngine = engine || "chatgpt";
  const record = q.rows.filter((row) => row.engine === activeEngine).at(-1) || q.rows.at(-1);
  const e = ENGINES.find((entry) => entry.id === (record?.engine || activeEngine));
  const answer = answerForEngine(q, record, e?.id || activeEngine);

  $("#sample-answer").innerHTML =
    `<div class="card-label">${logo(e?.id || "chatgpt")}<span>${e?.name || "ChatGPT"} · Answer</span></div><p>${record?.mention ? "<mark>Acme</mark> " : ""}${answer}</p><div class="citation-pill">${icon("link")} ${record?.cited ? "acme.work" + q.page : record?.external || "External source"}</div><span class="badge ${record?.mention ? "green" : "neutral"}">${record?.mention ? "Acme mentioned" : "Acme not mentioned"}</span><p class="answer-note">${record?.date || report.end} · Monitored prompt response.</p>`;

  $("#question-rows")
    .querySelectorAll("button")
    .forEach((button) =>
      button.addEventListener("click", () => {
        question = button.dataset.question;
        trackKobbe("product_question_click", { question, engine: engine || "all" });
        renderQuestions();
        $(`[data-question="${question}"]`)?.focus({ preventScroll: true });
        motion($("#sample-answer"));
      }),
    );

  if (ready && story === "questions" && !paused && !reduced.matches) {
    microRevealMany($("#question-rows").querySelectorAll(".question-row"), 0, 90, {
      duration: 420,
      opacity: 0.35,
    });
  }
}
function render(initialReport, animateChart = false) {
  report = initialReport || select({ days: 30, engine, topic: "" });
  const delta = report.current.visibility - report.previous.visibility;
  roll("#visibility-number", `${report.current.visibility.toFixed(1)}%`);
  $("#visibility-delta").textContent =
    `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp`;
  $("#visibility-delta").setAttribute(
    "aria-label",
    `${delta.toFixed(1)} percentage points versus the previous 30 days`,
  );
  $("#visibility-delta").classList.toggle("negative", delta < 0);
  chart(animateChart);
  $("#competitor-rows").innerHTML = report.competitors
    .filter((c) => !c.self && c.name !== "Monday")
    .map(
      (c) =>
        `<div class="competitor-row ${c.self ? "self" : ""}" data-share="${c.share.toFixed(1)}%" style="--share:${animateChart ? "0%" : c.share.toFixed(1) + "%"}"><span>${c.self ? '<span class="acme-mark" aria-hidden="true"><img src="/assets/brands/acme.svg" width="32" height="32" alt=""></span>' : logo(c.name.toLowerCase())}${c.name}${c.self ? " <small>you</small>" : ""}</span><b>${c.share.toFixed(1)}%</b></div>`,
    )
    .join("");
  if (animateChart && ready && !paused && !reduced.matches) {
    const rows = [...$("#competitor-rows").querySelectorAll(".competitor-row")];
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        rows.forEach((row, index) => {
          const delay = 95 + index * 62;
          row.style.setProperty("--share", row.dataset.share);
          microReveal(row.querySelector(":scope > span"), delay, 250, 0.975, 0.5);
          microReveal(row.querySelector(":scope > b"), delay + 32, 220, 0.96, 0.45);
          microReveal(row.querySelector("img,.acme-mark"), delay + 12, 230, 0.88, 0.5);
          setTimeout(() => {
            const value = row.querySelector(":scope > b");
            if (value && ready && !paused) number(value, row.dataset.share);
          }, delay);
        }),
      ),
    );
  }
  renderQuestions();
  const opportunityItems = ACTIONS.map((action) => ({
    action,
    question: report.questions.find((q) => q.id === action.question),
  }))
    .filter((item) => item.question)
    .sort((a, b) => a.question.visibility - b.question.visibility);

  $("#opportunity-rows").innerHTML = opportunityItems
    .map(
      ({ action, question }) =>
        `<details class="opportunity-item" data-opportunity="${action.id}"><summary><div><span>${action.label} · ${question.visibility.toFixed(0)}% visibility</span><strong>${action.title}</strong><small>${question.text}</small></div>${icon("plus")}</summary><p>${action.body}</p></details>`,
    )
    .join("");

  $("#opportunity-rows").querySelectorAll("details").forEach((details) => {
    details.addEventListener("toggle", () => {
      trackKobbe(details.open ? "product_opportunity_open" : "product_opportunity_close", {
        opportunity: details.dataset.opportunity,
        engine: engine || "all",
      });
    });
  });

  if (ready && story === "opportunities" && !paused && !reduced.matches) {
    microRevealMany($("#opportunity-rows").querySelectorAll(".opportunity-item"), 0, 95, {
      duration: 440,
      opacity: 0.35,
    });
  }
  const scopeStatus = $("#scope-status");
  if (scopeStatus)
    scopeStatus.textContent =
      `12 monitored questions · ${engine ? ENGINES.find((e) => e.id === engine).name : `${ENGINES.length} engines`} · ${format(report.a.length)} answers`;
  $("#scoped-demo").href =
    `/app/?days=30${engine ? "&engine=" + engine : ""}${story === "questions" ? "#questions" : story === "opportunities" ? "#actions" : ""}`;
  if (ready) void enhance($("#opportunity-rows"));
}
function setStory(next) {
  story = next;
  document.querySelectorAll("[data-story]").forEach((b) => {
    const active = b.dataset.story === next;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active);
    b.tabIndex = active ? 0 : -1;
  });
  document
    .querySelectorAll(".story-panel")
    .forEach((p) => (p.hidden = p.id !== `story-panel-${next}`));

  const context = PRODUCT_CONTEXT[next];
  if (context) {
    $("#product-context-eyebrow").textContent = context.eyebrow;
    $("#product-context-title").innerHTML = context.title;
    $("#product-context-copy").textContent = context.copy;
    if (ready && !paused && !reduced.matches) {
      microReveal($("#product-context-eyebrow"), 0, 380, 1, 0.35);
      microReveal($("#product-context-title"), 70, 520, 1, 0.3);
      microReveal($("#product-context-copy"), 140, 440, 1, 0.35);
    }
  }

  $("#scoped-demo").href =
    `/app/?days=30${engine ? "&engine=" + engine : ""}${story === "questions" ? "#questions" : story === "opportunities" ? "#actions" : ""}`;
  if (next === "visibility") chart();
  if (next === "questions") renderQuestions();
  if (next === "opportunities") render(report);
  motion($(`#story-panel-${next}`));
  if (ready) window.OrbitMotion.indicator($(".story-nav"));
}
// Product tabs retain Orbit's visual/keyboard contract and use dedicated panels.
// Do not use the gallery's data-tab handler: it replaces panels with specimen copy.
document
  .querySelectorAll("[data-story]")
  .forEach((b) => b.addEventListener("click", () => {
    trackKobbe("product_view_click", { view: b.dataset.story });
    setStory(b.dataset.story);
  }));
$(".story-nav").addEventListener("keydown", (e) => {
  if (ready) return;
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  const buttons = [...document.querySelectorAll("[data-story]")];
  let index = buttons.indexOf(document.activeElement);
  index =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? 2
        : (index + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
  buttons[index].focus();
  buttons[index].click();
});
document.querySelectorAll("[data-engine]").forEach((b) => {
  if (b.closest("#extra-engines")) { b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", "false"); }
  b.setAttribute(
    "aria-label",
    b.dataset.engine
      ? ENGINES.find((e) => e.id === b.dataset.engine).name
      : "All engines",
  );
  b.addEventListener("click", () => {
    engine = b.dataset.engine;
    trackKobbe("product_engine_click", { engine: engine || "all", view: story });
    document.querySelectorAll("[data-engine]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", x === b);
      if (x.closest("#extra-engines")) x.setAttribute("aria-checked", String(x === b));
    });
    const extra = b.closest('#extra-engines');
    const moreLabel = $('#more-engine-label');
    if (moreLabel) moreLabel.textContent = extra ? b.getAttribute('aria-label') : '+6 engines';
    if (extra) { extra.hidden = true; extra.previousElementSibling.setAttribute('aria-expanded', 'false'); extra.previousElementSibling.focus(); }
    render(undefined, true);
  });
});
document.querySelector("[data-menu-toggle]")?.addEventListener("click", (event) => {
  trackKobbe("product_engine_menu", {
    state: event.currentTarget.getAttribute("aria-expanded") === "true" ? "open" : "closed",
  });
});

function showActionSuccess(visual) {
  if (!visual || visual.classList.contains("show-success")) return;
  visual.classList.add("show-success");
  const success = visual.querySelector(".action-success");
  if (!success) return;
  success.setAttribute("aria-hidden", "false");
  if (paused || reduced.matches) return;

  motionAnimate(
    success,
    [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
    900,
    { fill: "backwards" },
  );
  motionEnter(success.querySelector(".action-success-kicker"), 180, 4, 640, 1);
  motionEnter(success.querySelector(":scope > strong"), 300, 6, 780, 1);
  [...success.querySelectorAll(".success-brand")].forEach((brand, index) =>
    motionAnimate(
      brand,
      [
        { opacity: 0, transform: "translateY(6px) scale(.9)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      820,
      { delay: 420 + index * 130, fill: "backwards" },
    ),
  );
  motionEnter(success.querySelector(":scope > p"), 980, 4, 640, 1);
}

function syncActionChecklist({ animateResolution = true } = {}) {
  const checks = $(".action-checks");
  const visual = $(".action-visual");
  if (!checks || !visual) return;

  const inputs = [...checks.querySelectorAll("input")];
  const n = inputs.filter((input) => input.checked).length;
  inputs.forEach((input) =>
    input.closest(".choice")?.classList.toggle("is-complete", input.checked),
  );

  const bar = $("#brief-bar");
  if (bar) bar.style.width = `${inputs.length ? (n / inputs.length) * 100 : 0}%`;

  const resolved = n === inputs.length && inputs.length > 0;
  visual.classList.toggle("gap-resolved", resolved);

  clearTimeout(visual._successTimer);
  if (!resolved) {
    visual.classList.remove("show-success");
    visual.querySelector(".action-success")?.setAttribute("aria-hidden", "true");
    return;
  }

  if (animateResolution) {
    visual._successTimer = setTimeout(() => showActionSuccess(visual), 520);
  } else {
    visual.classList.remove("show-success");
  }
}
$(".action-checks").addEventListener("change", () => syncActionChecklist());
syncActionChecklist({ animateResolution: false });

// These supporting examples always describe the complete, explicitly labeled sample period.
$("#source-rows").innerHTML = base.pages
  .slice(0, 4)
  .map(
    (p) =>
      `<div class="source-row"><span>${icon("file")}${p.path}</span><b>${format(p.citations)}</b></div>`,
  )
  .join("");
$("#referral-number").textContent = format(base.current.referrals);
$("#lead-number").textContent = format(base.current.leads);
$("#funnel-bars").innerHTML = [
  ["AI referrals", base.current.referrals],
  ["Engaged visits", base.current.engaged],
  ["Leads", base.current.leads],
]
  .map(
    ([label, value]) =>
      `<div class="marketing-funnel-step"><div><span>${label}</span><span>${format(value)}</span></div><div class="marketing-funnel-track"><span style="width:${(value / base.current.referrals) * 100}%"></span></div></div>`,
  )
  .join("");
render(base);
let chartWidth = 0;
new ResizeObserver((entries) => {
  const width = entries[0].contentRect.width;
  if (width > 0 && Math.abs(width - chartWidth) > 1) {
    chartWidth = width;
    chart();
  }
}).observe($("#visibility-chart"));
document.querySelectorAll("#faq details").forEach((details, index) => {
  details.addEventListener("toggle", () => {
    const question = details.querySelector("summary")?.textContent?.trim().replace(/\s+/g, " ") || String(index + 1);
    trackKobbe(details.open ? "faq_open" : "faq_close", { question });
  });
});

const LANDING_EASE = "cubic-bezier(.16, 1, .3, 1)";
function motionAnimate(el, frames, duration = 320, extra = {}) {
  return animate(el, frames, Math.round(duration * 1.25), {
    easing: LANDING_EASE,
    ...extra,
  });
}

function microReveal(el, delay = 0, duration = 360, _scale = 0.99, fromOpacity = 0.42) {
  if (!el) return;
  motionAnimate(
    el,
    [
      { opacity: fromOpacity, transform: "translateY(4px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    duration,
    { delay, fill: "backwards" },
  );
}

function microRevealMany(elements, delay = 0, step = 65, options = {}) {
  [...elements].forEach((el, index) =>
    microReveal(
      el,
      delay + index * step,
      options.duration ?? 360,
      options.scale ?? 0.99,
      options.opacity ?? 0.42,
    ),
  );
}

let productMotionPlayed = false;
function playProductMotion() {
  const stage = $(".product-stage");
  if (!stage || productMotionPlayed) return;
  productMotionPlayed = true;
  stage.dataset.motionState = reduced.matches || paused ? "complete" : "running";

  if (reduced.matches || paused || !window.OrbitMotion) return;

  // Keep the shell completely stable. Animate the information inside it.
  const company = stage.querySelector(".sample-company");
  microReveal(company?.querySelector(".acme-mark"), 0, 320, 0.96, 0.48);
  microReveal(company?.querySelector("strong"), 55, 300, 1, 0.42);
  microReveal(company?.querySelector("span:not(.acme-mark)"), 105, 300, 1, 0.42);

  microRevealMany(stage.querySelectorAll(".engine-controls [data-engine]"), 130, 55, {
    duration: 320,
    scale: 0.975,
    opacity: 0.42,
  });

  const metric = stage.querySelector(".visibility-metric");
  microReveal(metric?.querySelector(":scope > span"), 220, 300, 1, 0.42);
  microReveal(metric?.querySelector(":scope > div > strong"), 265, 420, 0.985, 0.38);
  microReveal(metric?.querySelector(":scope > div > .delta"), 330, 320, 0.96, 0.38);
  microReveal(metric?.querySelector(":scope > p"), 385, 300, 1, 0.42);

  const panel = stage.querySelector(".competitor-panel");
  microReveal(panel?.querySelector(".panel-title h3"), 280, 320, 1, 0.42);
  microReveal(panel?.querySelector(".panel-title > .icon"), 330, 320, 0.96, 0.38);
  microReveal(panel?.querySelector(":scope > p"), 380, 300, 1, 0.42);

  microRevealMany(stage.querySelectorAll(".chart-legend > span"), 620, 70, {
    duration: 320,
    scale: 0.99,
    opacity: 0.42,
  });
  microReveal(stage.querySelector(".stage-bottom .text-link"), 740, 340, 0.99, 0.42);

  // Build the data itself: roll the metric, draw the chart, grow ranked bars.
  setTimeout(() => {
    if (!stage.isConnected) return;
    render(report, true);
  }, 170);

  setTimeout(() => {
    stage.dataset.motionState = "complete";
  }, 1550);
}

const insightMotionPlayed = new WeakSet();
const approachMotionPlayed = new WeakSet();

function motionEnter(el, delay = 0, distance = 8, duration = 420, _scale = 0.996) {
  if (!el) return;
  motionAnimate(
    el,
    [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    duration,
    { delay, fill: "backwards" },
  );
}

function motionEnterMany(elements, delay = 0, step = 85, options = {}) {
  [...elements].forEach((el, index) =>
    motionEnter(
      el,
      delay + index * step,
      options.distance ?? 8,
      options.duration ?? 420,
      options.scale ?? 0.996,
    ),
  );
}

function rollInitial(el, delay = 0) {
  if (!el || !window.OrbitNumbers) return;
  const value = Number(el.textContent.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(value)) return;
  setTimeout(() => {
    if (el.isConnected) window.OrbitNumbers.set(el, value, { initial: true });
  }, delay);
}

function animateMetricText(el, value, duration = 3000, delay = 0) {
  if (!el) return;
  const target = Number(value);
  if (!Number.isFinite(target)) return;

  setTimeout(() => {
    if (!el.isConnected) return;
    const formatted = format(target);
    el.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    el.replaceChildren();
    el.classList.add("rolling-number");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", formatted);

    [...formatted].forEach((character, index) => {
      if (!/\d/.test(character)) {
        const punctuation = document.createElement("span");
        punctuation.className = "number-punctuation";
        punctuation.setAttribute("aria-hidden", "true");
        punctuation.textContent = character;
        el.append(punctuation);
        return;
      }

      const digit = document.createElement("span");
      digit.className = "number-digit";
      digit.setAttribute("aria-hidden", "true");
      const track = document.createElement("span");
      track.className = "number-track";
      const targetDigit = Number(character);
      for (let number = 0; number <= targetDigit; number++) {
        const cell = document.createElement("span");
        cell.textContent = number;
        track.append(cell);
      }
      const distance = targetDigit * 1.2;
      digit.append(track);
      el.append(digit);

      animate(
        track,
        [
          { transform: "translateY(0)" },
          { transform: `translateY(-${distance}em)` },
        ],
        duration,
        {
          delay: index * 90,
          easing: LANDING_EASE,
          fill: "forwards",
        },
      );
    });
  }, delay);
}

function playSourceCard(card) {
  const visual = card.querySelector(".source-visual");
  const loading = card.querySelector("[data-source-loading]");
  const head = card.querySelector(".visual-table-head");
  const rows = [...card.querySelectorAll(".source-row")];

  if (!visual || reduced.matches || paused) return;

  const headHeight = Math.max(20, head?.getBoundingClientRect().height || 20);
  if (head) {
    head.style.opacity = "0";
    head.style.maxHeight = "0px";
    head.style.marginBottom = "0";
    head.style.overflow = "hidden";
  }

  const metrics = rows.map((row) => ({
    row,
    height: Math.max(44, row.getBoundingClientRect().height || 44),
  }));
  metrics.forEach(({ row }) => {
    row.style.opacity = "0";
    row.style.height = "0px";
    row.style.paddingTop = "0";
    row.style.paddingBottom = "0";
    row.style.overflow = "hidden";
    row.style.borderColor = "transparent";
  });

  if (loading) {
    loading.hidden = false;
    motionEnter(loading, 205, 4, 230, 1);
  }

  setTimeout(() => {
    if (loading) {
      motionAnimate(
        loading,
        [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-4px)" }],
        170,
        { fill: "forwards" },
      );
      setTimeout(() => {
        loading.hidden = true;
        loading.style.removeProperty("opacity");
        loading.style.removeProperty("transform");
      }, 180);
    }

    if (head) {
      motionAnimate(
        head,
        [
          { opacity: 0, maxHeight: "0px", marginBottom: "0px" },
          { opacity: 1, maxHeight: `${headHeight}px`, marginBottom: "10px" },
        ],
        250,
        { fill: "forwards" },
      );
      setTimeout(() => {
        head.style.removeProperty("opacity");
        head.style.removeProperty("max-height");
        head.style.removeProperty("margin-bottom");
        head.style.removeProperty("overflow");
      }, 270);
    }

    metrics.forEach(({ row, height }, index) => {
      const delay = 120 + index * 180;
      row.classList.add("is-loading");
      motionAnimate(
        row,
        [
          {
            opacity: 0.82,
            height: "0px",
            paddingTop: "0px",
            paddingBottom: "0px",
            borderColor: "transparent",
            transform: "translateY(-4px)",
          },
          {
            opacity: 1,
            height: `${height}px`,
            paddingTop: "13px",
            paddingBottom: "13px",
            borderColor: "var(--border)",
            transform: "translateY(0)",
          },
        ],
        380,
        { delay, fill: "forwards" },
      );
      setTimeout(() => {
        row.classList.remove("is-loading");
        [...row.children].forEach((child) =>
          motionAnimate(child, [{ opacity: 0 }, { opacity: 1 }], 240, { fill: "backwards" }),
        );
        rollInitial(row.querySelector("b"), 15);
      }, delay + 245);
      setTimeout(() => {
        ["opacity", "height", "padding-top", "padding-bottom", "overflow", "border-color", "transform"].forEach(
          (property) => row.style.removeProperty(property),
        );
      }, delay + 455);
    });
  }, 760);
}

function playTrafficCard(card) {
  motionEnterMany(card.querySelectorAll(".funnel-stats > div"), 240, 140, {
    distance: 5,
    duration: 640,
    scale: 1,
  });

  animateMetricText(card.querySelector("#referral-number"), base.current.referrals, 3000, 300);
  animateMetricText(card.querySelector("#lead-number"), base.current.leads, 3000, 440);

  const steps = [...card.querySelectorAll(".marketing-funnel-step")];
  motionEnterMany(steps, 620, 180, { distance: 5, duration: 620, scale: 1 });
  steps.forEach((step, index) => {
    const bar = step.querySelector(".marketing-funnel-track > span");
    if (!bar) return;
    motionAnimate(
      bar,
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      3000,
      { delay: 720 + index * 180, fill: "backwards" },
    );
  });
}

function runActionChecklistDemo(visual) {
  const choices = [...visual.querySelectorAll(".action-checks .choice")];
  const cursor = visual.querySelector(".demo-cursor");
  if (!choices.length || !cursor) return;

  choices.forEach((choice) => {
    const input = choice.querySelector("input");
    if (input) input.checked = false;
    choice.classList.remove("is-complete", "demo-hover");
  });
  syncActionChecklist({ animateResolution: false });

  let cancelled = false;
  let x = Math.max(18, visual.clientWidth - 42);
  let y = Math.max(18, visual.clientHeight - 48);
  cursor.style.opacity = "1";
  cursor.style.transform = `translate(${x}px,${y}px)`;

  const cancel = () => {
    cancelled = true;
    cursor.getAnimations().forEach((animation) => animation.cancel());
    motionAnimate(cursor, [{ opacity: 1 }, { opacity: 0 }], 120, { fill: "forwards" });
  };
  visual.addEventListener("pointerdown", cancel, { once: true });

  choices.forEach((choice, index) => {
    const moveAt = 620 + index * 680;
    setTimeout(() => {
      if (cancelled || !visual.isConnected) return;
      const vr = visual.getBoundingClientRect();
      const cr = choice.getBoundingClientRect();
      const nextX = cr.left - vr.left + 5;
      const nextY = cr.top - vr.top + Math.min(17, cr.height / 2);
      cursor.getAnimations().forEach((animation) => animation.cancel());
      motionAnimate(
        cursor,
        [
          { opacity: 1, transform: `translate(${x}px,${y}px) scale(1)` },
          { opacity: 1, transform: `translate(${nextX}px,${nextY}px) scale(1)` },
        ],
        420,
        { fill: "forwards" },
      );
      x = nextX;
      y = nextY;
      choice.classList.add("demo-hover");
    }, moveAt);

    setTimeout(() => {
      if (cancelled || !visual.isConnected) return;
      motionAnimate(
        cursor,
        [
          { transform: `translate(${x}px,${y}px) scale(1)` },
          { transform: `translate(${x}px,${y}px) scale(.76)`, offset: 0.45 },
          { transform: `translate(${x}px,${y}px) scale(1)` },
        ],
        190,
        { fill: "forwards" },
      );
      const input = choice.querySelector("input");
      if (input) {
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setTimeout(() => choice.classList.remove("demo-hover"), 240);
    }, moveAt + 440);
  });

  setTimeout(() => {
    if (!cancelled) motionAnimate(cursor, [{ opacity: 1 }, { opacity: 0 }], 170, { fill: "forwards" });
  }, 620 + choices.length * 680 + 100);
}

function playActionCard(card) {
  const visual = card.querySelector(".action-visual");
  motionEnter(card.querySelector(".action-card-heading"), 250, 5, 360, 1);
  motionEnter(card.querySelector(".action-visual h4"), 330, 8, 440, 0.997);
  motionEnter(card.querySelector(".action-visual > p"), 410, 5, 360, 1);
  motionEnterMany(card.querySelectorAll(".action-checks .choice"), 500, 90, {
    distance: 5,
    duration: 360,
    scale: 0.997,
  });
  motionEnter(card.querySelector(".brief-progress"), 760, 5, 360, 1);
  setTimeout(() => runActionChecklistDemo(visual), 240);
}

function playCompetitiveCard(card) {
  const visual = card.querySelector(".shortlist-visual");
  const question = card.querySelector("[data-shortlist-question]");
  const thinking = card.querySelector("[data-shortlist-thinking]");
  const brandGroup = card.querySelector(".shortlist-brands");
  const brands = [...card.querySelectorAll(".shortlist-brands > span")];
  const caption = card.querySelector(".your-brand-caption");
  const fullQuestion = "What should our team use?";

  if (!visual || !question || reduced.matches || paused) return;

  visual.classList.add("is-sequencing", "is-typing");
  visual.classList.remove("is-acme-highlighted");
  question.textContent = "“";
  if (thinking) thinking.hidden = true;

  let character = 0;
  setTimeout(() => {
    const typing = setInterval(() => {
      if (!question.isConnected) {
        clearInterval(typing);
        return;
      }
      character += 1;
      question.textContent = `“${fullQuestion.slice(0, character)}${character >= fullQuestion.length ? "”" : ""}`;
      if (character < fullQuestion.length) return;
      clearInterval(typing);
      visual.classList.remove("is-typing");

      setTimeout(() => {
        if (!thinking) return;
        thinking.hidden = false;
        motionEnter(thinking, 0, 5, 240, 0.99);
      }, 100);

      setTimeout(() => {
        if (thinking) {
          motionAnimate(
            thinking,
            [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-4px)" }],
            170,
            { fill: "forwards" },
          );
          setTimeout(() => (thinking.hidden = true), 180);
        }

        if (brandGroup) {
          motionAnimate(brandGroup, [{ opacity: 0.75 }, { opacity: 1 }], 240, { fill: "backwards" });
        }

        const order = [brands[0], brands[1], brands[3], brands[2]].filter(Boolean);
        order.forEach((brand, index) => {
          const self = brand.classList.contains("your-brand");
          motionAnimate(
            brand,
            [
              { opacity: 0, transform: "translateY(6px) scale(.92)" },
              {
                opacity: 1,
                transform: self ? "translateY(0) scale(1)" : "translateY(0) scale(1.02)",
                offset: 0.76,
              },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            460,
            { delay: index * 160, fill: "forwards" },
          );
        });

        const acmeDelay = Math.max(0, (order.length - 1) * 160 + 420);
        setTimeout(() => {
          const acme = brands.find((brand) => brand.classList.contains("your-brand"));
          visual.classList.add("is-acme-highlighted");
          visual.classList.remove("is-sequencing");

          brands
            .filter((brand) => brand !== acme)
            .forEach((brand, index) => {
              brand.getAnimations().forEach((animation) => animation.cancel());
              motionAnimate(
                brand,
                [
                  { opacity: 1, filter: "blur(0px)" },
                  { opacity: 0.34, filter: "blur(2.2px)" },
                ],
                720,
                { delay: index * 70, fill: "forwards" },
              );
            });

          if (acme) {
            acme.getAnimations().forEach((animation) => animation.cancel());
            motionAnimate(
              acme,
              [
                { transform: "translateY(0) scale(.98)" },
                { transform: "translateY(-7px) scale(1.055)", offset: 0.7 },
                { transform: "translateY(-7px) scale(1)" },
              ],
              560,
              { fill: "forwards" },
            );
          }
          motionEnter(caption, 160, 4, 420, 1);
        }, acmeDelay);
      }, 900);
    }, 45);
  }, 380);
}

function playInsightCardMotion(card) {
  if (!card || insightMotionPlayed.has(card)) return;
  insightMotionPlayed.add(card);
  if (reduced.matches || paused || !window.OrbitMotion) return;

  motionEnter(card.querySelector(".feature-label"), 25, 4, 300, 1);
  motionEnter(card.querySelector(".feature-copy h3"), 90, 8, 430, 0.998);
  motionEnter(card.querySelector(".feature-copy > p"), 170, 5, 360, 1);

  if (card.classList.contains("source-card")) playSourceCard(card);
  else if (card.classList.contains("traffic-card")) playTrafficCard(card);
  else if (card.classList.contains("action-card")) playActionCard(card);
  else if (card.classList.contains("audience-card")) playCompetitiveCard(card);
}

function playApproachCardMotion(step) {
  if (!step || approachMotionPlayed.has(step)) return;
  approachMotionPlayed.add(step);

  if (reduced.matches || paused || !window.OrbitMotion) {
    const statusLabel = step.querySelector("[data-company-status] span");
    if (statusLabel) statusLabel.textContent = "Ready";
    return;
  }

  motionEnter(step.querySelector(".step-number"), 80, 4, 620, 1);
  motionEnter(step.querySelector("h3"), 180, 6, 760, 1);
  motionEnter(step.querySelector(":scope > p"), 320, 4, 720, 1);

  if (step.classList.contains("clearer-step-company")) {
    motionEnter(step.querySelector(".mini-product-heading"), 220, 4, 680, 1);

    const progress = step.querySelector(".company-progress > span");
    if (progress) {
      motionAnimate(
        progress,
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        2800,
        { delay: 260, fill: "backwards" },
      );
    }

    const rows = [...step.querySelectorAll(".company-intel-row")];
    rows.forEach((row, index) =>
      motionEnter(row, 420 + index * 560, 6, 820, 1),
    );

    setTimeout(() => {
      const label = step.querySelector("[data-company-status] span");
      if (label) window.OrbitMotion.feedback(label, "Ready");
    }, 3000);
  } else if (step.classList.contains("clearer-step-questions")) {
    motionEnter(step.querySelector(".question-generator-head"), 220, 4, 680, 1);
    motionEnter(step.querySelector(".generated-questions"), 360, 6, 760, 1);

    const rows = [...step.querySelectorAll(".generated-question")];
    rows.forEach((row, index) =>
      motionEnter(row, 520 + index * 620, 5, 760, 1),
    );

    [...step.querySelectorAll(".question-check")].forEach((check, index) =>
      motionAnimate(
        check,
        [
          { opacity: 0.16, transform: "scale(.88)" },
          { opacity: 1, transform: "scale(1.06)", offset: 0.72 },
          { opacity: 1, transform: "scale(1)" },
        ],
        760,
        { delay: 900 + index * 620, fill: "both" },
      ),
    );

    const selection = step.querySelector(".question-selection");
    if (selection && rows.length === 3) {
      const y2 = rows[1].offsetTop - rows[0].offsetTop;
      const y3 = rows[2].offsetTop - rows[0].offsetTop;
      motionAnimate(
        selection,
        [
          { transform: "translateY(0)", offset: 0 },
          { transform: `translateY(${y2}px)`, offset: 0.5 },
          { transform: `translateY(${y3}px)`, offset: 1 },
        ],
        3000,
        { delay: 420, fill: "both" },
      );
    }
  } else if (step.classList.contains("clearer-step-action")) {
    motionEnter(step.querySelector(".gap-header"), 260, 4, 720, 1);

    const rankRows = [...step.querySelectorAll(".mini-rank-row")];
    rankRows.forEach((row, index) =>
      motionEnter(row, 520 + index * 620, 5, 820, 1),
    );

    [...step.querySelectorAll(".mini-rank-fill")].forEach((fill, index) =>
      motionAnimate(
        fill,
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        1800,
        { delay: 900 + index * 360, fill: "backwards" },
      ),
    );

    motionEnter(step.querySelector(".brief-build"), 2200, 8, 900, 1);
    motionEnter(step.querySelector(".brief-kicker"), 2420, 3, 680, 1);
    motionEnter(step.querySelector(".brief-build > strong"), 2640, 5, 820, 1);
  }
}

// Product structures stay rendered at all times. Viewport observers below only animate their internal content.

try {
  await initializeOrbit();
  ready = true;
  await enhance($(".engine-controls"));
  await enhance($(".faq-list"));
  await enhance($("#opportunity-rows"));
  window.OrbitMotion.prepare($(".story-nav"));

  if (!paused && !reduced.matches) {
    const insightObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          entry.target.classList.add("card-visible");
          playInsightCardMotion(entry.target);
        }
      },
      { threshold: 0.22, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("#insights .feature-card").forEach((card) => {
      card.classList.add("motion-card-armed");
      insightObserver.observe(card);
    });

    const approachObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          entry.target.classList.add("card-visible");
          playApproachCardMotion(entry.target);
        }
      },
      { threshold: 0.24, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("#approach .clearer-step").forEach((card) => {
      card.classList.add("motion-card-armed");
      approachObserver.observe(card);
    });
  }

  const productStage = $(".product-stage");
  if (productStage) {
    const productObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        playProductMotion();
      },
      { threshold: 0.22, rootMargin: "0px 0px -6% 0px" },
    );
    productObserver.observe(productStage);
  }

  // Animate the content inside each visible structure rather than moving the
  // structure itself. Content is always rendered; motion is a fast emphasis pass.
  const revealPlans = new Map();
  const registerReveal = (rootSelector, itemSelector, options = {}) => {
    document.querySelectorAll(rootSelector).forEach((root) => {
      revealPlans.set(root, { itemSelector, ...options });
    });
  };

  registerReveal(
    ".hero",
    ".announcement,h1,.hero-copy,.hero-detail,.hero-actions .button,.hero-note",
    { step: 60 },
  );
  registerReveal(
    ".discovery-scene",
    ".globe-pin,.question-float .card-label,.question-float>p,.question-tags>span,.answer-float .card-label,.answer-float>p,.answer-float .citation-pill,.signal-float>.icon,.signal-float strong,.signal-float span,.provider-node",
    { step: 32, scale: 0.97 },
  );
  registerReveal(".provider-strip", ".provider-group>span", {
    step: 28,
    scale: 0.96,
  });
  registerReveal("#product .section-heading", ".eyebrow,h2,p", { step: 45 });
  registerReveal("#product .story-nav", "button", { step: 55, scale: 0.97 });
  registerReveal("#insights .section-heading", ".eyebrow,h2,p", { step: 58 });
  registerReveal("#approach .section-heading", ".eyebrow,h2,p", { step: 42 });
  registerReveal("#product .value-trio > div", ":scope>.icon,:scope>p", {
    step: 52,
    scale: 0.97,
  });
  registerReveal("#faq > div:first-child", ".eyebrow,h2,p", {
    step: 55,
    scale: 0.99,
  });
  registerReveal("#faq .faq-list details", ":scope>summary", {
    step: 0,
    scale: 0.99,
  });
  registerReveal(
    ".early-access-card",
    ":scope>.eyebrow,:scope>h2,:scope>p,.hero-actions .button,.offer-notes>span",
    { step: 60, scale: 0.985 },
  );
  registerReveal(
    ".brand-footer",
    ".brand-footer-label,.brand-footer-col a,.brand-footer-note,.brand-footer-meta>*",
    { step: 45, scale: 0.99 },
  );

  const structureReveal = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        structureReveal.unobserve(target);
        const plan = revealPlans.get(target);
        if (!plan || paused || reduced.matches) continue;
        microRevealMany(target.querySelectorAll(plan.itemSelector), 0, plan.step ?? 40, {
          duration: plan.duration ?? 340,
          scale: plan.scale ?? 0.985,
          opacity: plan.opacity ?? 0.55,
        });
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -4% 0px" },
  );
  revealPlans.forEach((_, root) => structureReveal.observe(root));

  const inView = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.dataset.inView = String(isIntersecting);
      }
    },
    { threshold: 0.05 },
  );
  document
    .querySelectorAll("#product,.product-stage,.provider-strip,.discovery-scene,.early-access-section,#insights .feature-card,#approach .clearer-step,.brand-footer")
    .forEach((el) => inView.observe(el));
} catch (error) {
  console.warn(
    "Orbit enhancements unavailable; native controls remain usable.",
    error,
  );
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    globe.destroy();
  }
});

// The scene is a browsable set of buyer questions, not live geolocation.
const sceneQuestions = [
 { city:'San Francisco', country:'United States', flag:'us', engine:'chatgpt', question:'What’s the best project tool for a small team?', answer:'Asana makes the shortlist. Acme is missing from this answer.', source:'G2 comparison', action:'Show the team sizes Acme fits, plus setup time and the first-week workflow.', evidence:'The answer weighs team size and setup effort, but Acme has no comparable proof.' },
 { city:'London', country:'United Kingdom', flag:'gb', engine:'claude', question:'Which Notion alternative is best for project tracking?', answer:'ClickUp is recommended for task dependencies. Acme is not mentioned.', source:'Product comparison', action:'Show dependency workflows in Acme with a direct comparison against ClickUp.', evidence:'The recommendation centers on dependency tracking and clear project views.' },
 { city:'Singapore', country:'Singapore', flag:'sg', engine:'perplexity', question:'What is an affordable tool for a growing remote team?', answer:'Notion appears for its entry price. Acme is missing from the comparison.', source:'Pricing guide', action:'Show per-seat pricing, included features, and how costs change as teams grow.', evidence:'The answer compares entry pricing and what teams get as they scale.' },
 { city:'Madrid', country:'Spain', flag:'es', engine:'gemini', question:'Which project tool is easiest for a small European startup?', answer:'ClickUp is highlighted for flexible setup. Acme is not included.', source:'Startup software guide', action:'Show setup time, EU-ready workflows, and what a startup can launch on day one.', evidence:'The answer favors quick setup and flexible workflows for small European teams.' },
 { city:'Tokyo', country:'Japan', flag:'jp', engine:'chatgpt', question:'What project tool works well for distributed product teams?', answer:'Notion and Asana are recommended. Acme is missing from the shortlist.', source:'Remote work comparison', action:'Show async handoffs, ownership, and a distributed product workflow end to end.', evidence:'The answer rewards async context, ownership, and clean handoffs across time zones.' },
 { city:'São Paulo', country:'Brazil', flag:'br', engine:'claude', question:'What is a good affordable project tool for a growing agency?', answer:'Monday and ClickUp appear for agency workflows. Acme is not mentioned.', source:'Agency tools guide', action:'Show an agency workflow with templates, client visibility, and clear team pricing.', evidence:'The comparison weighs client work, reusable templates, and cost as agencies grow.' },
 { city:'Sydney', country:'Australia', flag:'au', engine:'perplexity', question:'Which project tool is best for a remote-first team?', answer:'Asana appears for coordination across remote teams. Acme is absent.', source:'Remote teams roundup', action:'Show how a remote-first team coordinates work, handoffs, and decisions in Acme.', evidence:'The answer emphasizes visibility, handoffs, and asynchronous collaboration.' },
 { city:'Berlin', country:'Germany', flag:'de', engine:'gemini', question:'Which project management tool is a good fit for a lean SaaS team?', answer:'Linear and Notion are favored for focused product teams. Acme is not listed.', source:'SaaS tools comparison', action:'Show Acme’s lean SaaS workflow from planning through delivery, with setup proof.', evidence:'The answer favors focus, fast setup, and workflows built around product development.' }
];
let sceneIndex = 0;
function selectScene(index, animate = true) {
 sceneIndex = index;
 const item = sceneQuestions[index];
 $('.discovery-scene').dataset.location = String(index);
 const flag = $('.question-float .scene-country-flag');
 if (flag) {
   flag.src = `/assets/flags/${item.flag}.svg`;
   flag.alt = '';
 }
 $('.question-float .card-label > span').textContent = item.country;
 $('.question-float p').textContent = item.question;
 $('.answer-float .card-label img').src = `/assets/brands/${item.engine}.svg`;
 $('.answer-float .card-label > span').textContent = 'Answer';
 $('.answer-float p').textContent = item.answer;
 $('.citation-pill').innerHTML = `${icon('link')} ${item.source}`;
 $('.signal-float strong').textContent = item.action;
 $('.signal-float span').textContent = 'Click a message to explore the evidence.';
 document.querySelectorAll('[data-globe-question]').forEach((b) => {
   const active = Number(b.dataset.globeQuestion) === index;
   b.setAttribute('aria-pressed', String(active));
   b.setAttribute('aria-label', `${sceneQuestions[Number(b.dataset.globeQuestion)]?.country || 'Country'} question${active ? ', selected' : ''}`);
 });
 document.dispatchEvent(new CustomEvent("mentionloom:scene", {detail:{index,item,animate}}));
 if (!animate || $(".discovery-scene").classList.contains("connected-scene")) return;
 const pin = $(`[data-globe-question="${index}"]`).getBoundingClientRect();
 for (const [i, card] of [...document.querySelectorAll('.question-float,.answer-float')].entries()) {
   const rect = card.getBoundingClientRect();
   card.getAnimations().forEach(a=>a.cancel());
   card.animate(reduced.matches || document.body.classList.contains('reduce-motion') ? [{opacity:.4},{opacity:1}] : [{opacity:0,transform:`translate(${pin.x-rect.x-rect.width/2}px,${pin.y-rect.y-rect.height/2}px) scale(.25)`},{opacity:1,transform:'translate(0,0) scale(1)'}], {duration:reduced.matches || document.body.classList.contains('reduce-motion') ? 150 : 650,fill:'backwards',delay:reduced.matches || document.body.classList.contains('reduce-motion') ? 0 : i*420,easing:'cubic-bezier(.22,1,.36,1)'});
 }
}
function openScene() {
 const item = sceneQuestions[sceneIndex];
 const provider = ENGINES.find((entry) => entry.id === item.engine)?.name || item.engine;
 $('#scene-detail-content').innerHTML=`
   <div class="scene-chat" aria-label="Monitored buyer question and AI answer">
     <div class="message sent scene-question-message">
       <div class="scene-message-label">${icon('chat')}<span>Buyer question</span></div>
       <p id="scene-detail-title">${item.question}</p>
     </div>
     <div class="message scene-answer-message">
       <div class="scene-message-label scene-answer-meta">
         <img src="/assets/brands/${item.engine}.svg" width="20" height="20" alt="">
         <span>${provider}</span>
         <span class="scene-message-location"><img src="/assets/flags/${item.flag}.svg" width="18" height="12" alt="">${item.city}</span>
       </div>
       <p>${item.answer}</p>
       <div class="scene-answer-source">${icon('link')}<span>${item.source}</span></div>
     </div>
   </div>
   <section class="scene-takeaway" aria-label="Mentionloom takeaway">
     <div class="scene-takeaway-heading">${icon('spark')}<span>Mentionloom takeaway</span></div>
     <div class="scene-takeaway-grid">
       <article class="scene-takeaway-item">
         <span class="scene-takeaway-icon">${icon('target')}</span>
         <div><h3>Why it matters</h3><p>${item.evidence}</p></div>
       </article>
       <article class="scene-takeaway-item">
         <span class="scene-takeaway-icon">${icon('arrow')}</span>
         <div><h3>Next action</h3><p>${item.action}</p></div>
       </article>
     </div>
   </section>`;
 const dialog = $('#scene-detail');
 if (ready && window.OrbitMotion) openDialog(dialog);
 else dialog.showModal();
 if (ready && !paused && !reduced.matches) {
   const questionMessage = dialog.querySelector('.scene-question-message');
   const answerMessage = dialog.querySelector('.scene-answer-message');
   const takeawayHeading = dialog.querySelector('.scene-takeaway-heading');
   const takeawayItems = [...dialog.querySelectorAll('.scene-takeaway-item')];
   animate(questionMessage, [{opacity:0,transform:'translate(8px, 5px) scale(.985)'},{opacity:1,transform:'translate(0,0) scale(1)'}], 320, {delay:70,fill:'backwards'});
   animate(answerMessage, [{opacity:0,transform:'translate(-8px, 5px) scale(.985)'},{opacity:1,transform:'translate(0,0) scale(1)'}], 360, {delay:160,fill:'backwards'});
   animate(takeawayHeading, [{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}], 260, {delay:310,fill:'backwards'});
   takeawayItems.forEach((item,index)=>animate(item,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],320,{delay:380+index*80,fill:'backwards'}));
 }
}
let sceneManualUntil = 0;
document.querySelectorAll('[data-globe-question]').forEach((b) => b.addEventListener('click', () => {
  const index = Number(b.dataset.globeQuestion);
  sceneManualUntil = performance.now() + 12000;
  trackKobbe("globe_country_click", { country: sceneQuestions[index]?.country || index });
  selectScene(index);
}));
$('.globe-explore').addEventListener('click',()=> {
  sceneManualUntil = performance.now() + 12000;
  selectScene((sceneIndex+1)%sceneQuestions.length);
});
document.querySelectorAll('[data-scene-detail]').forEach(b=>b.addEventListener('click',openScene));
$('[data-scene-close]').addEventListener('click',()=>{
  const dialog = $('#scene-detail');
  if (ready && window.OrbitMotion) closeDialog(dialog);
  else dialog.close();
});
selectScene(0,false);
const discoveryScene = $('.discovery-scene');
let sceneVisible = false, sceneTimer;
function scheduleScene() {
 clearTimeout(sceneTimer);
 if (!sceneVisible || document.hidden || paused || reduced.matches || performance.now() < sceneManualUntil || $('#scene-detail').open || discoveryScene.matches(':hover') || discoveryScene.contains(document.activeElement) || discoveryScene.querySelector('.globe-wrap')?.classList.contains('is-dragging')) return;
 sceneTimer = setTimeout(() => {
   selectScene((sceneIndex + 1) % sceneQuestions.length);
   scheduleScene();
 }, discoveryScene.classList.contains("connected-scene") ? 9000 : 6500);
}
const sceneObserver = new IntersectionObserver(([entry]) => {
 sceneVisible = entry.isIntersecting;
 scheduleScene();
}, {threshold:.25});
sceneObserver.observe(discoveryScene);
['pointerenter','pointerleave','focusin'].forEach(event => discoveryScene.addEventListener(event, scheduleScene));
discoveryScene.addEventListener('focusout', () => setTimeout(scheduleScene, 0));
discoveryScene.addEventListener('mentionloom:globe-drag-end', scheduleScene);
$('#scene-detail').addEventListener('close', scheduleScene);
document.addEventListener('visibilitychange', scheduleScene);
reduced.addEventListener('change', scheduleScene);
window.addEventListener('pagehide', () => clearTimeout(sceneTimer));

// cloudflare deploy sync: insight motion 2026-09-21
