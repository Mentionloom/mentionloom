import { select } from "./app/lib/model.js";
import { ACTIONS, ENGINES, QUESTIONS } from "./app/lib/data.js";
import { initializeOrbit, enhance, number, animate, openDialog, closeDialog } from "./app/lib/ui.js";
import { mountGlobe } from "./assets/globe.js?v=20260921-3";

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
  question = "q2",
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
  const oldCurrent = oldSvg?.querySelector(".plot-current")?.getAttribute("d") || "";
  const oldPrevious = oldSvg?.querySelector(".plot-previous")?.getAttribute("d") || "";
  const oldFill = oldSvg?.querySelector(".plot-fill")?.getAttribute("d") || "";
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
          { opacity: 0.48, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(5px)" },
        ],
        300,
        { fill: "both" },
      );
    if (currentPath) {
      const length = currentPath.getTotalLength();
      animate(
        currentPath,
        [
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: length, opacity: 0.58 },
          { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0, opacity: 1 },
        ],
        820,
        { delay: 80, fill: "backwards" },
      );
    }
    previousPath &&
      animate(
        previousPath,
        [{ opacity: 0 }, { opacity: 1 }],
        460,
        { delay: 150, fill: "backwards" },
      );
    fillPath &&
      animate(
        fillPath,
        [
          { opacity: 0, transform: "scaleX(.04)" },
          { opacity: 1, transform: "scaleX(1)" },
        ],
        650,
        { delay: 140, fill: "backwards" },
      );
    [$("#chart-cursor"), $("#chart-dot")].forEach((el, index) =>
      animate(
        el,
        [
          { opacity: 0, transform: "translateY(4px) scale(.92)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        240,
        { delay: 760 + index * 35, fill: "backwards" },
      ),
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
function renderQuestions() {
  const ids = ["q2", "q1", "q6", "q8"];
  $("#question-rows").innerHTML = ids
    .map((id) => {
      const q = report.questions.find((q) => q.id === id);
      return `<button class="question-row" data-question="${id}" aria-pressed="${id === question}" aria-controls="sample-answer"><span>${q.text}</span><span>${q.visibility.toFixed(0)}%</span></button>`;
    })
    .join("");
  const q = report.questions.find((q) => q.id === question),
    record = q.rows.filter((r) => r.engine === (engine || "chatgpt")).at(-1),
    e = ENGINES.find((e) => e.id === record.engine);
  $("#sample-answer").innerHTML =
    `<div class="card-label">${logo(e.id)}<span>${e.name} · Answer</span></div><p>${record.mention ? "<mark>Acme</mark> " + q.excerpt : q.missing}</p><div class="citation-pill">${icon("link")} ${record.cited ? "acme.work" + q.page : record.external}</div><span class="badge ${record.mention ? "green" : "neutral"}">${record.mention ? "Acme mentioned" : "Acme not mentioned"}</span><p class="answer-note">${record.date} · Monitored prompt response.</p>`;
  $("#question-rows")
    .querySelectorAll("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        question = b.dataset.question;
        trackKobbe("product_question_click", { question, engine: engine || "all" });
        renderQuestions();
        $(`[data-question="${question}"]`).focus({ preventScroll: true });
        motion($("#sample-answer"));
      }),
    );
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
    .filter((c) => c.name !== "Monday")
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
          row.style.setProperty("--share", row.dataset.share);
          animate(
            row,
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            300,
            { delay: 90 + index * 55, fill: "backwards" },
          );
        }),
      ),
    );
  }
  renderQuestions();
  $("#opportunity-rows").innerHTML = ACTIONS.map((a) => {
    const q = report.questions.find((q) => q.id === a.question);
    return `<details class="opportunity-item"><summary><div><span>${a.label} · ${q.visibility.toFixed(0)}% visibility</span>${a.title}</div>${icon("plus")}</summary><p>${a.body}</p></details>`;
  }).join("");
  $("#opportunity-rows").querySelectorAll("details").forEach((details, index) => {
    details.addEventListener("toggle", () => {
      trackKobbe(details.open ? "product_opportunity_open" : "product_opportunity_close", {
        opportunity: ACTIONS[index]?.id || ACTIONS[index]?.label || String(index + 1),
        engine: engine || "all",
      });
    });
  });
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
  $("#scoped-demo").href =
    `/app/?days=30${engine ? "&engine=" + engine : ""}${story === "questions" ? "#questions" : story === "opportunities" ? "#actions" : ""}`;
  if (next === "visibility") chart();
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

$(".action-checks").addEventListener("change", () => {
  const n = $(".action-checks").querySelectorAll("input:checked").length;
  $("#brief-count").textContent = `${n} of 3 brief items ready`;
  $("#brief-bar").style.width = `${(n / 3) * 100}%`;
});
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

let approachMotionPlayed = false;
function playApproachMotion() {
  const section = $("#approach");
  if (!section || approachMotionPlayed) return;
  approachMotionPlayed = true;
  section.dataset.motionState = reduced.matches || paused ? "complete" : "running";
  const statusLabel = section.querySelector("[data-company-status] span");

  if (reduced.matches || paused || !window.OrbitMotion) {
    if (statusLabel) statusLabel.textContent = "Ready";
    return;
  }

  const companyProgress = section.querySelector(".company-progress > span");
  const companyRows = [...section.querySelectorAll(".company-intel-row")];
  const companyReady = section.querySelector(".company-ready");
  const statusDot = section.querySelector(".mini-product-status i");
  animate(companyProgress, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 900, {
    delay: 90,
    fill: "backwards",
  });
  statusDot &&
    animate(
      statusDot,
      [
        { transform: "scale(.8)", boxShadow: "0 0 0 0 var(--accent-soft)" },
        { transform: "scale(1.18)", boxShadow: "0 0 0 6px transparent", offset: 0.55 },
        { transform: "scale(1)", boxShadow: "0 0 0 0 transparent" },
      ],
      900,
      { delay: 120, fill: "backwards" },
    );
  companyRows.forEach((row, index) =>
    animate(
      row,
      [
        { opacity: 0, transform: "translateY(8px) scale(.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      360,
      { delay: 260 + index * 105, fill: "backwards" },
    ),
  );
  companyReady &&
    animate(
      companyReady,
      [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
      320,
      { delay: 770, fill: "backwards" },
    );

  const questionRows = [...section.querySelectorAll(".generated-question")];
  const questionChecks = [...section.querySelectorAll(".question-check")];
  const questionSelection = section.querySelector(".question-selection");
  questionRows.forEach((row, index) =>
    animate(
      row,
      [{ opacity: 0, transform: "translateY(7px)" }, { opacity: 1, transform: "translateY(0)" }],
      320,
      { delay: 650 + index * 90, fill: "backwards" },
    ),
  );
  if (questionSelection && questionRows.length === 3) {
    const y2 = questionRows[1].offsetTop - questionRows[0].offsetTop;
    const y3 = questionRows[2].offsetTop - questionRows[0].offsetTop;
    animate(
      questionSelection,
      [
        { transform: "translateY(0) scale(1)", offset: 0 },
        { transform: "translateY(0) scale(1)", offset: 0.22 },
        { transform: `translateY(${y2}px) scale(.995)`, offset: 0.34 },
        { transform: `translateY(${y2}px) scale(1)`, offset: 0.55 },
        { transform: `translateY(${y3}px) scale(.995)`, offset: 0.68 },
        { transform: `translateY(${y3}px) scale(1)`, offset: 1 },
      ],
      3600,
      { delay: 980, fill: "both" },
    );
  }
  questionChecks.forEach((check, index) =>
    animate(
      check,
      [
        { opacity: 0.18, transform: "scale(.82)" },
        { opacity: 1, transform: "scale(1.08)", offset: 0.68 },
        { opacity: 1, transform: "scale(1)" },
      ],
      380,
      { delay: 1350 + index * 950, fill: "both" },
    ),
  );

  const rankRows = [...section.querySelectorAll(".mini-rank-row")];
  const rankFills = [...section.querySelectorAll(".mini-rank-fill")];
  rankRows.forEach((row, index) =>
    animate(
      row,
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      340,
      { delay: 1180 + index * 120, fill: "backwards" },
    ),
  );
  rankFills.forEach((fill, index) =>
    animate(fill, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 720, {
      delay: 1320 + index * 130,
      fill: "backwards",
    }),
  );
  const brief = section.querySelector(".brief-build");
  brief &&
    animate(
      brief,
      [
        { opacity: 0, transform: "translateY(12px) scale(.985)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      520,
      { delay: 1780, fill: "backwards" },
    );

  setTimeout(() => {
    if (statusLabel) {
      statusLabel.textContent = "Ready";
      window.OrbitMotion.feedback(statusLabel, "Ready");
    }
    section.dataset.motionState = "complete";
  }, 2350);
}

// Viewport motion is independent from Orbit so product content can never disappear
// just because an enhancement module fails.
if ("IntersectionObserver" in window) {
  const buildSections = [$("#insights"), $("#approach")].filter(Boolean);
  const sectionBuild = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.dataset.inView = String(isIntersecting);
        if (!isIntersecting || target.classList.contains("has-built")) continue;
        target.classList.add("has-built");
        requestAnimationFrame(() => target.classList.add("build-visible"));
      }
    },
    { threshold: 0.16, rootMargin: "0px 0px -6% 0px" },
  );
  buildSections.forEach((section) => {
    section.classList.add("motion-armed");
    sectionBuild.observe(section);
  });
}

try {
  await initializeOrbit();
  ready = true;
  await enhance($(".engine-controls"));
  await enhance($(".faq-list"));
  await enhance($("#opportunity-rows"));
  window.OrbitMotion.prepare($(".story-nav"));

  const approach = $("#approach");
  if (approach) {
    const approachObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        playApproachMotion();
      },
      { threshold: 0.32, rootMargin: "0px 0px -4% 0px" },
    );
    approachObserver.observe(approach);
  }

  const simpleReveal = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        simpleReveal.unobserve(target);
        target.classList.add("is-visible");
        if (!paused && !reduced.matches) window.OrbitMotion.enter(target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  document
    .querySelectorAll("#product .section-heading,.story-nav,.product-stage,.value-trio>div,#faq>div,.faq-list details,.early-access-card")
    .forEach((el) => simpleReveal.observe(el));

  const inView = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.dataset.inView = String(isIntersecting);
      }
    },
    { threshold: 0.05 },
  );
  document
    .querySelectorAll("#product,.provider-strip,.discovery-scene,.early-access-section")
    .forEach((el) => inView.observe(el));
} catch (error) {
  console.warn(
    "Orbit enhancements unavailable; native controls remain usable.",
    error,
  );
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) globe.destroy();
});

// The scene is a browsable set of buyer questions, not live geolocation.
const sceneQuestions = [
 { city:'San Francisco', country:'United States', flag:'us', engine:'chatgpt', question:'What’s the best project tool for a small team?', answer:'Asana makes the shortlist. Acme is missing from this answer.', source:'G2 comparison', action:'Explain which team sizes Acme supports.', evidence:'The answer discusses team size and setup effort, but does not mention Acme.' },
 { city:'London', country:'United Kingdom', flag:'gb', engine:'claude', question:'Which Notion alternative is best for project tracking?', answer:'ClickUp is recommended for task dependencies. Acme is not mentioned.', source:'Product comparison', action:'Show how dependencies work in Acme.', evidence:'The answer focuses on dependency tracking and project views. A clear comparison page would help explain Acme’s fit.' },
 { city:'Singapore', country:'Singapore', flag:'sg', engine:'perplexity', question:'What is an affordable tool for a growing remote team?', answer:'Notion appears for its entry price. Acme is missing from the comparison.', source:'Pricing guide', action:'Make the per-seat cost easy to compare.', evidence:'The answer compares entry plans. Explain included features and the cost as a team grows.' },
 { city:'Madrid', country:'Spain', flag:'es', engine:'gemini', question:'Which project tool is easiest for a small European startup?', answer:'ClickUp is highlighted for flexible setup. Acme is not included.', source:'Startup software guide', action:'Clarify setup time and EU-ready workflows.', evidence:'The answer rewards quick setup and team flexibility. Acme needs clearer proof around both.' },
 { city:'Tokyo', country:'Japan', flag:'jp', engine:'chatgpt', question:'What project tool works well for distributed product teams?', answer:'Notion and Asana are recommended. Acme is missing from the shortlist.', source:'Remote work comparison', action:'Show async handoffs and ownership clearly.', evidence:'The answer emphasizes asynchronous context and clear ownership across time zones.' },
 { city:'São Paulo', country:'Brazil', flag:'br', engine:'claude', question:'What is a good affordable project tool for a growing agency?', answer:'Monday and ClickUp appear for agency workflows. Acme is not mentioned.', source:'Agency tools guide', action:'Make agency workflows and pricing easier to compare.', evidence:'The answer weighs client work, templates, and cost as teams grow.' },
 { city:'Sydney', country:'Australia', flag:'au', engine:'perplexity', question:'Which project tool is best for a remote-first team?', answer:'Asana appears for coordination across remote teams. Acme is absent.', source:'Remote teams roundup', action:'Show remote collaboration patterns.', evidence:'The answer highlights visibility, handoffs, and asynchronous collaboration.' },
 { city:'Berlin', country:'Germany', flag:'de', engine:'gemini', question:'Which project management tool is a good fit for a lean SaaS team?', answer:'Linear and Notion are favored for focused product teams. Acme is not listed.', source:'SaaS tools comparison', action:'Explain Acme’s fit for lean product teams.', evidence:'The answer favors focus, fast setup, and product-development workflows.' }
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
