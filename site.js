import { select } from "./app/lib/model.js";
import { ACTIONS, ENGINES, QUESTIONS } from "./app/lib/data.js";
import { initializeOrbit, enhance, number, animate, openDialog, closeDialog } from "./app/lib/ui.js";
import { mountGlobe } from "./assets/globe.js?v=20260922-4";

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

const valueAnimationFrames = new WeakMap();

function animateNumericLabel(el, next, { duration = 720, decimals = 1, suffix = "%" } = {}) {
  if (!el) return;
  const target = Number(next);
  if (!Number.isFinite(target)) return;

  const previous = Number(el.dataset.numericValue ?? String(el.textContent || "").replace(/[^\d.-]/g, ""));
  el.dataset.numericValue = String(target);

  const renderValue = (value) => {
    el.textContent = `${value.toFixed(decimals)}${suffix}`;
  };

  const existing = valueAnimationFrames.get(el);
  if (existing) cancelAnimationFrame(existing);

  if (!ready || paused || reduced.matches || !Number.isFinite(previous) || Math.abs(previous - target) < 0.01) {
    renderValue(target);
    return;
  }

  const started = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    renderValue(previous + (target - previous) * eased);
    if (progress < 1) {
      valueAnimationFrames.set(el, requestAnimationFrame(step));
    } else {
      valueAnimationFrames.delete(el);
      renderValue(target);
    }
  };
  valueAnimationFrames.set(el, requestAnimationFrame(step));
}

function animateListReorder(container, nodes, previousRects, duration = 640) {
  nodes.forEach((node) => container.append(node));
  if (!ready || paused || reduced.matches) return;

  nodes.forEach((node) => {
    const before = previousRects.get(node.dataset.key || node.dataset.question || node.dataset.opportunity || node.dataset.competitor);
    if (!before) return;
    const after = node.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    node.getAnimations().forEach((animation) => animation.cancel());
    animate(
      node,
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      duration,
      { easing: LANDING_EASE, fill: "both" },
    );
  });
}

function updateSampleAnswer(q, record, engineRecord, animateUpdate = false) {
  const host = $("#sample-answer");
  if (!host || !q) return;

  const providerId = engineRecord?.id || record?.engine || "chatgpt";
  const providerName = engineRecord?.name || "ChatGPT";
  const answer = answerForEngine(q, record, providerId);
  const html =
    `<div class="card-label">${logo(providerId)}<span>${providerName} · Answer</span></div><p>${record?.mention ? "<mark>Acme</mark> " : ""}${answer}</p><div class="citation-pill">${icon("link")} ${record?.cited ? "acme.work" + q.page : record?.external || "External source"}</div><span class="badge ${record?.mention ? "green" : "neutral"}">${record?.mention ? "Acme mentioned" : "Acme not mentioned"}</span><p class="answer-note">${record?.date || report.end} · Monitored prompt response.</p>`;

  if (!animateUpdate || paused || reduced.matches || !ready) {
    host.innerHTML = html;
    return;
  }

  const transitionId = Number(host.dataset.transitionId || 0) + 1;
  host.dataset.transitionId = String(transitionId);
  host.getAnimations().forEach((animation) => animation.cancel());

  const out = animate(host, [{ opacity: 1 }, { opacity: 0.35 }], 150, {
    easing: "ease-out",
    fill: "forwards",
  });
  Promise.resolve(out?.finished)
    .catch(() => {})
    .then(() => {
      if (Number(host.dataset.transitionId) !== transitionId) return;
      host.innerHTML = html;
      animate(host, [{ opacity: 0.35 }, { opacity: 1 }], 280, {
        easing: LANDING_EASE,
        fill: "forwards",
      });
    });
}

function renderQuestions({ animateReorder = false, animateAnswer = false } = {}) {
  const container = $("#question-rows");
  const candidates = report.questions
    .filter((q) => BUYER_QUESTION_IDS.includes(q.id))
    .sort((a, b) => a.visibility - b.visibility)
    .slice(0, 4);

  if (!candidates.some((q) => q.id === question)) question = candidates[0]?.id || report.questions[0]?.id;
  if (!container) return;

  const previousRects = new Map(
    [...container.querySelectorAll(".question-row")].map((node) => [
      node.dataset.question,
      node.getBoundingClientRect(),
    ]),
  );
  const existing = new Map(
    [...container.querySelectorAll(".question-row")].map((node) => [node.dataset.question, node]),
  );

  const nodes = candidates.map((q) => {
    let button = existing.get(q.id);
    if (!button) {
      button = document.createElement("button");
      button.className = "question-row";
      button.type = "button";
      button.dataset.question = q.id;
      button.dataset.key = q.id;
      button.setAttribute("aria-controls", "sample-answer");
      button.innerHTML = "<span></span><span></span>";
      button.addEventListener("click", () => {
        if (question === button.dataset.question) return;
        question = button.dataset.question;
        trackKobbe("product_question_click", { question, engine: engine || "all" });
        renderQuestions({ animateReorder: false, animateAnswer: true });
        button.focus({ preventScroll: true });
      });
    }
    existing.delete(q.id);
    button.setAttribute("aria-pressed", String(q.id === question));
    button.querySelector(":scope > span:first-child").textContent = q.text;
    button.querySelector(":scope > span:last-child").textContent = `${q.visibility.toFixed(0)}%`;
    return button;
  });

  existing.forEach((node) => node.remove());
  animateListReorder(container, nodes, animateReorder ? previousRects : new Map(), 620);

  const q = report.questions.find((entry) => entry.id === question) || candidates[0];
  if (!q) return;
  const activeEngine = engine || "chatgpt";
  const record = q.rows.filter((row) => row.engine === activeEngine).at(-1) || q.rows.at(-1);
  const provider = ENGINES.find((entry) => entry.id === (record?.engine || activeEngine));
  updateSampleAnswer(q, record, provider, animateAnswer);
}

function renderOpportunities({ animateReorder = false } = {}) {
  const container = $("#opportunity-rows");
  if (!container) return;

  const items = ACTIONS.map((action) => ({
    action,
    question: report.questions.find((q) => q.id === action.question),
  }))
    .filter((item) => item.question)
    .sort((a, b) => a.question.visibility - b.question.visibility);

  const previousRects = new Map(
    [...container.querySelectorAll(".opportunity-item")].map((node) => [
      node.dataset.opportunity,
      node.getBoundingClientRect(),
    ]),
  );
  const existing = new Map(
    [...container.querySelectorAll(".opportunity-item")].map((node) => [node.dataset.opportunity, node]),
  );

  const nodes = items.map(({ action, question: buyerQuestion }) => {
    let details = existing.get(action.id);
    if (!details) {
      details = document.createElement("details");
      details.className = "opportunity-item";
      details.dataset.opportunity = action.id;
      details.dataset.key = action.id;
      details.innerHTML = `<summary><div><span></span><strong></strong><small></small></div>${icon("plus")}</summary><p></p>`;
      details.addEventListener("toggle", () => {
        trackKobbe(details.open ? "product_opportunity_open" : "product_opportunity_close", {
          opportunity: details.dataset.opportunity,
          engine: engine || "all",
        });
      });
    }
    existing.delete(action.id);
    details.querySelector("summary span").textContent =
      `${action.label} · ${buyerQuestion.visibility.toFixed(0)}% visibility`;
    details.querySelector("summary strong").textContent = action.title;
    details.querySelector("summary small").textContent = buyerQuestion.text;
    details.querySelector(":scope > p").textContent = action.body;
    return details;
  });

  existing.forEach((node) => node.remove());
  animateListReorder(container, nodes, animateReorder ? previousRects : new Map(), 620);
}

function updateCompetitorRows({ animateReorder = false } = {}) {
  const container = $("#competitor-rows");
  if (!container) return;

  const competitors = report.competitors.filter((item) => item.name !== "Monday");
  const previousRects = new Map(
    [...container.querySelectorAll(".competitor-row")].map((node) => [
      node.dataset.competitor,
      node.getBoundingClientRect(),
    ]),
  );
  const existing = new Map(
    [...container.querySelectorAll(".competitor-row")].map((node) => [node.dataset.competitor, node]),
  );

  const nodes = competitors.map((competitor) => {
    let row = existing.get(competitor.name);
    if (!row) {
      row = document.createElement("div");
      row.className = "competitor-row";
      row.dataset.competitor = competitor.name;
      row.dataset.key = competitor.name;
      row.innerHTML = "<span></span><b></b>";
    }
    existing.delete(competitor.name);

    row.classList.toggle("self", Boolean(competitor.self));
    row.dataset.share = `${competitor.share.toFixed(1)}%`;
    const label = row.querySelector(":scope > span");
    if (competitor.self) {
      label.innerHTML =
        '<span class="acme-mark" aria-hidden="true"><img src="/assets/brands/acme.svg" width="32" height="32" alt=""></span><span class="competitor-name">Acme <small>you</small></span>';
    } else {
      label.innerHTML = `${logo(competitor.name.toLowerCase())}<span class="competitor-name">${competitor.name}</span>`;
    }

    const value = row.querySelector(":scope > b");
    animateNumericLabel(value, competitor.share, { duration: 720, decimals: 1, suffix: "%" });

    requestAnimationFrame(() => {
      row.style.setProperty("--share", `${competitor.share.toFixed(1)}%`);
    });
    return row;
  });

  existing.forEach((node) => node.remove());
  animateListReorder(container, nodes, animateReorder ? previousRects : new Map(), 700);
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
  updateCompetitorRows({ animateReorder: animateChart });
  renderQuestions({
    animateReorder: animateChart && story === "questions",
    animateAnswer: animateChart && story === "questions",
  });
  renderOpportunities({ animateReorder: animateChart && story === "opportunities" });

  const scopeStatus = $("#scope-status");
  if (scopeStatus)
    scopeStatus.textContent =
      `12 monitored questions · ${engine ? ENGINES.find((e) => e.id === engine).name : `${ENGINES.length} engines`} · ${format(report.a.length)} answers`;
  $("#scoped-demo").href =
    `/app/?days=30${engine ? "&engine=" + engine : ""}${story === "questions" ? "#questions" : story === "opportunities" ? "#actions" : ""}`;
}
function setStory(next) {
  if (next === story) return;

  const outgoing = document.querySelector(".story-panel:not([hidden])");
  const incoming = $(`#story-panel-${next}`);
  story = next;

  document.querySelectorAll("[data-story]").forEach((button) => {
    const active = button.dataset.story === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active);
    button.tabIndex = active ? 0 : -1;
  });

  const context = PRODUCT_CONTEXT[next];
  const heading = $(".product-context-heading");
  const applyContext = () => {
    if (!context) return;
    $("#product-context-eyebrow").textContent = context.eyebrow;
    $("#product-context-title").innerHTML = context.title;
    $("#product-context-copy").textContent = context.copy;
  };

  if (!ready || paused || reduced.matches || !outgoing || !incoming) {
    if (outgoing) outgoing.hidden = true;
    if (incoming) incoming.hidden = false;
    applyContext();
  } else {
    const stage = $(".product-stage");
    const transitionId = Number(stage?.dataset.storyTransition || 0) + 1;
    if (stage) stage.dataset.storyTransition = String(transitionId);

    heading?.getAnimations().forEach((animation) => animation.cancel());
    const headingOut = heading
      ? animate(heading, [{ opacity: 1 }, { opacity: 0.62 }], 140, {
          easing: "ease-out",
          fill: "forwards",
        })
      : null;

    Promise.resolve(headingOut?.finished)
      .catch(() => {})
      .then(() => {
        if (stage && Number(stage.dataset.storyTransition) !== transitionId) return;
        applyContext();
        if (heading) {
          animate(heading, [{ opacity: 0.62 }, { opacity: 1 }], 260, {
            easing: LANDING_EASE,
            fill: "forwards",
          });
        }
      });

    outgoing.getAnimations().forEach((animation) => animation.cancel());
    incoming.getAnimations().forEach((animation) => animation.cancel());
    const panelOut = animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], 160, {
      easing: "ease-out",
      fill: "forwards",
    });

    Promise.resolve(panelOut?.finished)
      .catch(() => {})
      .then(() => {
        if (stage && Number(stage.dataset.storyTransition) !== transitionId) return;
        outgoing.hidden = true;
        outgoing.style.removeProperty("opacity");
        incoming.hidden = false;
        animate(incoming, [{ opacity: 0 }, { opacity: 1 }], 300, {
          easing: LANDING_EASE,
          fill: "forwards",
        });
        if (next === "visibility") requestAnimationFrame(() => chart(false));
      });
  }

  $("#scoped-demo").href =
    `/app/?days=30${engine ? "&engine=" + engine : ""}${story === "questions" ? "#questions" : story === "opportunities" ? "#actions" : ""}`;

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
    const nextEngine = b.dataset.engine;
    if (nextEngine === engine) return;
    engine = nextEngine;
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

  storyAnimate(
    success,
    [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
    480,
    { fill: "backwards" },
  );
  motionEnter(success.querySelector(".action-success-kicker"), 80, 4, 360, 1);
  motionEnter(success.querySelector(":scope > strong"), 160, 4, 400, 1);
  [...success.querySelectorAll(".success-brand img")].forEach((brand, index) =>
    storyAnimate(
      brand,
      [
        { opacity: 0, transform: "translateY(6px) scale(.96)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      480,
      { delay: 240 + index * 70, fill: "backwards" },
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
  if (bar) {
    bar.style.width = "100%";
    bar.style.transform = `scaleX(${inputs.length ? n / inputs.length : 0})`;
  }

  const resolved = n === inputs.length && inputs.length > 0;
  visual.classList.toggle("gap-resolved", resolved);

  clearTimeout(visual._successTimer);
  if (!resolved) {
    visual.classList.remove("show-success");
    visual.querySelector(".action-success")?.setAttribute("aria-hidden", "true");
    return;
  }

  if (animateResolution) {
    visual._successTimer = setTimeout(() => showActionSuccess(visual), paused || reduced.matches ? 0 : 450);
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

const LANDING_EASE =
  getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() ||
  "cubic-bezier(.22, 1, .36, 1)";
function motionAnimate(el, frames, duration = 320, extra = {}) {
  return animate(el, frames, Math.round(duration * 1.25), {
    easing: LANDING_EASE,
    ...extra,
  });
}

// Narrative demos use literal timings so cursor arrivals and state changes stay in sync.
function storyAnimate(el, frames, duration, extra = {}) {
  return animate(el, frames, duration, {
    easing: "cubic-bezier(.25,1,.5,1)",
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

  // Data is already rendered before the card enters view. Avoid a second state
  // change here; entrance motion only reveals the existing structure.
  setTimeout(() => {
    stage.dataset.motionState = "complete";
  }, 1050);
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

    const rolls = [];
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

      const animation = animate(
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
      if (animation) rolls.push(animation.finished);
    });
    Promise.all(rolls).then(() => {
      // Return to the same large, plain-text value once every digit has landed.
      el.textContent = formatted;
      el.classList.remove("rolling-number");
      el.removeAttribute("role");
      el.removeAttribute("aria-label");
    }).catch(() => {});
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
  // Keep the information architecture visible and perfectly stable.
  // Only the numeric glyphs roll and the bar fills build in-place.
  // Hiding/revealing the stat and funnel rows caused the empty-card flash
  // and vertical jumps visible in the production recording.
  animateMetricText(card.querySelector("#referral-number"), base.current.referrals, 1800, 120);
  animateMetricText(card.querySelector("#lead-number"), base.current.leads, 1800, 180);

  const steps = [...card.querySelectorAll(".marketing-funnel-step")];
  steps.forEach((step, index) => {
    const bar = step.querySelector(".marketing-funnel-track > span");
    if (!bar) return;
    bar.style.transformOrigin = "left center";
    motionAnimate(
      bar,
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      1800,
      { delay: 260 + index * 110, fill: "backwards" },
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
  const cursorHost = cursor.offsetParent;
  let x = Math.max(0, cursorHost.clientWidth - 26);
  let y = Math.max(0, cursorHost.clientHeight - 26);
  cursor.style.opacity = "1";
  cursor.style.transform = `translate(${x}px,${y}px)`;

  const cancel = () => {
    cancelled = true;
    cursor.getAnimations().forEach((animation) => animation.cancel());
    motionAnimate(cursor, [{ opacity: 1 }, { opacity: 0 }], 120, { fill: "forwards" });
  };
  visual.addEventListener("pointerdown", cancel, { once: true });
  visual.addEventListener("keydown", cancel, { once: true });

  choices.forEach((choice, index) => {
    const moveAt = 780 + index * 900;
    setTimeout(() => {
      if (cancelled || !visual.isConnected) return;
      const vr = cursorHost.getBoundingClientRect();
      const cr = choice.querySelector("input").getBoundingClientRect();
      const nextX = Math.max(0, Math.min(cursorHost.clientWidth - 22, cr.left - vr.left + cr.width / 2 - 4));
      const nextY = Math.max(0, Math.min(cursorHost.clientHeight - 22, cr.top - vr.top + cr.height / 2 - 4));
      cursor.getAnimations().forEach((animation) => animation.cancel());
      storyAnimate(
        cursor,
        [
          { opacity: 1, transform: `translate(${x}px,${y}px) scale(1)` },
          { opacity: 1, transform: `translate(${nextX}px,${nextY}px) scale(1)` },
        ],
        560,
        { fill: "forwards" },
      );
      x = nextX;
      y = nextY;
      choice.classList.add("demo-hover");
    }, moveAt);

    setTimeout(() => {
      if (cancelled || !visual.isConnected) return;
      storyAnimate(
        cursor,
        [
          { transform: `translate(${x}px,${y}px) scale(1)` },
          { transform: `translate(${x}px,${y}px) scale(.88)`, offset: 0.45 },
          { transform: `translate(${x}px,${y}px) scale(1)` },
        ],
        220,
        { fill: "forwards" },
      );
      const input = choice.querySelector("input");
      if (input) {
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setTimeout(() => choice.classList.remove("demo-hover"), 240);
    }, moveAt + 620);
  });

  setTimeout(() => {
    if (!cancelled) motionAnimate(cursor, [{ opacity: 1 }, { opacity: 0 }], 170, { fill: "forwards" });
    visual.removeEventListener("pointerdown", cancel);
    visual.removeEventListener("keydown", cancel);
  }, 780 + (choices.length - 1) * 900 + 850);
}

function playActionCard(card) {
  const visual = card.querySelector(".action-visual");
  motionEnter(card.querySelector(".action-card-heading"), 250, 5, 360, 1);
  motionEnter(card.querySelector(".action-visual h4"), 330, 8, 440, 0.997);
  motionEnter(card.querySelector(".action-task > p"), 410, 5, 360, 1);
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
          storyAnimate(
            thinking,
            [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-4px)" }],
            280,
            { fill: "forwards" },
          );
          setTimeout(() => (thinking.hidden = true), 300);
        }

        if (brandGroup) {
          storyAnimate(brandGroup, [{ opacity: 0.75 }, { opacity: 1 }], 420, { fill: "backwards" });
        }

        const order = [brands[0], brands[1], brands[3], brands[2]].filter(Boolean);
        order.forEach((brand, index) => {
          storyAnimate(
            brand,
            [
              { opacity: 0, transform: "translateY(6px) scale(.97)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            520,
            { delay: index * 180, fill: "forwards" },
          );
        });

        const acmeDelay = Math.max(0, (order.length - 1) * 180 + 520 + 160);
        setTimeout(() => {
          const acme = brands.find((brand) => brand.classList.contains("your-brand"));
          visual.classList.add("is-acme-highlighted");
          visual.classList.remove("is-sequencing");

          brands
            .filter((brand) => brand !== acme)
            .forEach((brand, index) => {
              brand.getAnimations().forEach((animation) => animation.cancel());
              storyAnimate(
                brand,
                [
                  { opacity: 1, filter: "blur(0px)" },
                  { opacity: 0.34, filter: "blur(2.2px)" },
                ],
                680,
                { delay: index * 70, fill: "forwards" },
              );
            });

          if (acme) {
            acme.getAnimations().forEach((animation) => animation.cancel());
            storyAnimate(
              acme,
              [
                { transform: "translateY(0) scale(1)" },
                { transform: "translateY(-7px) scale(1)" },
              ],
              640,
              { fill: "forwards" },
            );
          }
          motionEnter(caption, 220, 4, 400, 1);
        }, acmeDelay);
      }, 1050);
    }, 48);
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

// One four-beat score for all three onboarding illustrations. Literal timings
// avoid the editorial entrance multiplier changing one panel's pace.
const APPROACH_SCORE = { start: 400, beat: 850, work: 750, settle: 280 };
const approachBeat = (index) => APPROACH_SCORE.start + index * APPROACH_SCORE.beat;
const approachComplete = (index) => approachBeat(index) + APPROACH_SCORE.work;

function approachReveal(el, delay, duration = APPROACH_SCORE.settle) {
  if (!el) return;
  return storyAnimate(el, [{ opacity: 0 }, { opacity: 1 }], duration, { delay, fill: "backwards", easing: "ease-out" });
}

function playCompanyLoading(step) {
  const rows = [...step.querySelectorAll(".company-intel-row")];
  const timers = [];
  const finish = () => {
    timers.forEach(clearTimeout);
    rows.forEach((row) => { row.dataset.state = "complete"; });
    reduced.removeEventListener("change", onPreferenceChange);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
  const onPreferenceChange = () => { if (reduced.matches) finish(); };
  const onVisibilityChange = () => { if (document.hidden) finish(); };
  reduced.addEventListener("change", onPreferenceChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  rows.forEach((row, index) => {
    row.dataset.state = "pending";
    timers.push(setTimeout(() => { row.dataset.state = "loading"; }, approachBeat(index)));
    timers.push(setTimeout(() => { row.dataset.state = "complete"; }, approachComplete(index)));
  });
  timers.push(setTimeout(finish, approachComplete(rows.length - 1)));
}

function playApproachCardMotion(step) {
  if (!step || approachMotionPlayed.has(step)) return;
  approachMotionPlayed.add(step);

  if (reduced.matches || paused || !window.OrbitMotion) {
    return;
  }

  // Shared introduction, then four coordinated work/completion beats.
  motionEnter(step.querySelector(".step-number"), 25, 4, 300, 1);
  motionEnter(step.querySelector("h3"), 90, 8, 430, 0.998);
  motionEnter(step.querySelector(":scope > p"), 170, 5, 360, 1);

  if (step.classList.contains("clearer-step-company")) {
    playCompanyLoading(step);
  } else if (step.classList.contains("clearer-step-questions")) {
    // Reveal the viewport, not the scrolling track: its transform belongs to
    // the seamless loop, and each highlight travels with its own full row.
    approachReveal(step.querySelector(".generated-questions"), approachBeat(0));
  } else if (step.classList.contains("clearer-step-action")) {
    approachReveal(step.querySelector(".gap-header"), approachBeat(0));

    const rankRows = [...step.querySelectorAll(".mini-rank-row")];
    rankRows.forEach((row, index) =>
      approachReveal(row, approachBeat(index)),
    );

    [...step.querySelectorAll(".mini-rank-fill")].forEach((fill, index) => {
      fill.style.transformOrigin = "left center";
      storyAnimate(
        fill,
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        APPROACH_SCORE.work,
        { delay: approachComplete(index), fill: "backwards" },
      );
    });

    approachReveal(step.querySelector(".brief-build"), approachBeat(3), APPROACH_SCORE.work);
    approachReveal(step.querySelector(".brief-kicker"), approachBeat(3), APPROACH_SCORE.work);
    approachReveal(step.querySelector(".brief-build > strong"), approachComplete(3));
  }
}

// Product structures stay rendered at all times. Viewport observers below only animate their internal content.
document.querySelectorAll(".question-track").forEach((track) => {
  const sequence = track.querySelector(".question-sequence");
  if (!sequence || track.dataset.loopReady) return;
  const duplicate = sequence.cloneNode(true);
  duplicate.setAttribute("aria-hidden", "true");
  duplicate.dataset.loopDuplicate = "true";
  track.append(duplicate);
  track.dataset.loopReady = "true";
});

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

    const approachCards = [...document.querySelectorAll("#approach .clearer-step")];
    const approachObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // Side-by-side panels share one trigger; stacked panels keep the
          // same score without using up their animation below the viewport.
          const cards = matchMedia("(min-width: 761px)").matches
            ? approachCards : [entry.target.closest(".clearer-step")];
          cards.forEach((card) => {
            observer.unobserve(card.querySelector(".step-visual"));
            card.classList.add("card-visible");
            playApproachCardMotion(card);
          });
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    approachCards.forEach((card) => {
      card.classList.add("motion-card-armed");
      approachObserver.observe(card.querySelector(".step-visual"));
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
  // The globe owns its reveal; cards appear only after its selected pin settles.
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
}
function openScene() {
 if (!$('.discovery-scene').classList.contains('scene-ready')) return;
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
  if (!$('.discovery-scene').classList.contains('scene-ready')) return;
  const index = Number(b.dataset.globeQuestion);
  sceneManualUntil = performance.now() + 12000;
  trackKobbe("globe_country_click", { country: sceneQuestions[index]?.country || index });
  selectScene(index);
}));
$('.globe-explore').addEventListener('click',()=> {
  if (!$('.discovery-scene').classList.contains('scene-ready')) return;
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
 if (!discoveryScene.classList.contains('scene-ready') || !sceneVisible || document.hidden || paused || reduced.matches || performance.now() < sceneManualUntil || $('#scene-detail').open || discoveryScene.matches(':hover') || discoveryScene.contains(document.activeElement) || discoveryScene.querySelector('.globe-wrap')?.classList.contains('is-dragging')) return;
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
discoveryScene.addEventListener('mentionloom:globe-settled', scheduleScene);
['pointerenter','pointerleave','focusin'].forEach(event => discoveryScene.addEventListener(event, scheduleScene));
discoveryScene.addEventListener('focusout', () => setTimeout(scheduleScene, 0));
discoveryScene.addEventListener('mentionloom:globe-drag-end', scheduleScene);
$('#scene-detail').addEventListener('close', scheduleScene);
document.addEventListener('visibilitychange', scheduleScene);
const syncAmbientMotion = () => { document.body.dataset.pageHidden = String(document.hidden); };
document.addEventListener('visibilitychange', syncAmbientMotion);
syncAmbientMotion();
reduced.addEventListener('change', scheduleScene);
window.addEventListener('pagehide', () => clearTimeout(sceneTimer));

// cloudflare deploy sync: insight motion 2026-09-21
