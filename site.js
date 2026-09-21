import { select } from "./app/lib/model.js";
import { ACTIONS, ENGINES, QUESTIONS } from "./app/lib/data.js";
import { initializeOrbit, enhance, number } from "./app/lib/ui.js";
import { mountGlobe } from "./assets/globe.js";

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
function chart() {
  const width = Math.max(270, $("#visibility-chart").clientWidth || 530),
    height = 140,
    pad = 32,
    right = width - 10,
    top = 10,
    bottom = 115;
  const point = (value, index) => [
    pad + (index / (report.series.length - 1)) * (right - pad),
    bottom - (value / 100) * (bottom - top),
  ];
  const path = (key) =>
    report.series
      .map((r, i) => {
        const [x, y] = point(
          key === "previous" ? r.previous.visibility : r.visibility,
          i,
        );
        return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const main = path("visibility");
  $("#visibility-chart").innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Acme's daily share of monitored answers, on a zero to 100 percent scale. Move the pointer across the chart to read a date."><defs><linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".18"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${[
      0, 50, 100,
    ]
      .map((v) => {
        const y = point(v, 0)[1];
        return `<line class="plot-grid" x1="${pad}" y1="${y}" x2="${right}" y2="${y}"/><text class="plot-axis" x="0" y="${y + 4}">${v}%</text>`;
      })
      .join(
        "",
      )}<path d="${main} L${right},${bottom} L${pad},${bottom} Z" fill="url(#landing-chart-fill)"/><path class="plot-previous" d="${path("previous")}"/><path class="plot-current" d="${main}"/><line id="chart-cursor" x1="${right}" x2="${right}" y1="${top}" y2="${bottom}" stroke="var(--sky-3)" stroke-dasharray="3 3"/><circle id="chart-dot" r="4" fill="var(--accent-text)" stroke="white" stroke-width="2"/><text class="plot-axis" x="${pad}" y="138">Aug 11</text><text class="plot-axis" text-anchor="end" x="${right}" y="138">Sep 9</text></svg>`;
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
    $("#visibility-chart svg").setAttribute(
      "aria-label",
      `${label}: Acme ${r.visibility.toFixed(1)} percent, previous period ${r.previous.visibility.toFixed(1)} percent.`,
    );
  }
  let chartInteractionTracked = false;
  $("#visibility-chart svg").addEventListener("pointermove", (e) => {
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
      ) * 29,
    );
    inspect(index);
  });
  inspect(29);
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
function render(initialReport) {
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
  chart();
  $("#competitor-rows").innerHTML = report.competitors
    .filter((c) => c.name !== "Monday")
    .map(
      (c) =>
        `<div class="competitor-row ${c.self ? "self" : ""}" style="--share:${c.share.toFixed(1)}%"><span>${c.self ? '<span class="acme-mark" aria-hidden="true"><img src="/assets/brands/acme.svg" width="32" height="32" alt=""></span>' : logo(c.name.toLowerCase())}${c.name}${c.self ? " <small>you</small>" : ""}</span><b>${c.share.toFixed(1)}%</b></div>`,
    )
    .join("");
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
    render();
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

try {
  await initializeOrbit();
  ready = true;
  await enhance($(".engine-controls"));
  await enhance($(".faq-list"));
  await enhance($("#opportunity-rows"));
  window.OrbitMotion.prepare($(".story-nav"));
  // Build and animate components only as they enter the viewport.
  const revealTargets = [
    ...document.querySelectorAll(
      "#product .section-heading,.story-nav,.product-stage,.value-trio>div,#insights .section-heading,.feature-card,#approach .section-heading,.steps-grid article,#faq>div,.faq-list details,.early-access-card",
    ),
  ];
  revealTargets.forEach((el) => el.setAttribute("data-reveal", ""));
  document.body.classList.add("motion-ready");

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        reveal.unobserve(target);
        target.classList.add("is-visible", "step-revealed");
        if (!paused && !reduced.matches) window.OrbitMotion.enter(target);
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );
  revealTargets.forEach((el) => reveal.observe(el));

  // Looping motion only runs while its section is on screen.
  const inView = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.dataset.inView = String(isIntersecting);
      }
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(
      "#product,#approach,#insights,.provider-strip,.discovery-scene,.early-access-section",
    )
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
 $('.question-float .card-label > span').textContent = item.country;
 $('.question-float p').textContent = item.question;
 $('.answer-float .card-label img').src = `/assets/brands/${item.engine}.svg`;
 $('.answer-float .card-label > span').textContent = 'Answer';
 $('.answer-float p').textContent = item.answer;
 $('.citation-pill').innerHTML = `${icon('link')} ${item.source}`;
 $('.signal-float strong').textContent = item.action;
 $('.signal-float span').textContent = 'Click a message to explore the evidence.';
 document.querySelectorAll('[data-globe-question]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.globeQuestion)===index)));
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
 const item=sceneQuestions[sceneIndex];
 $('#scene-detail-content').innerHTML=`<h2 id="scene-detail-title">${item.question}</h2><div class="scene-answer"><span>${item.city} · ${item.engine}</span><p>${item.answer}</p></div><h3>Why it matters</h3><p>${item.evidence}</p><h3>Next action</h3><p>${item.action}</p><a class="button" href="/app/questions/">Explore buyer questions ${icon('arrow')}</a>`;
 $('#scene-detail').showModal();
}
document.querySelectorAll('[data-globe-question]').forEach(b=>b.addEventListener('click',()=>selectScene(Number(b.dataset.globeQuestion))));
$('.globe-explore').addEventListener('click',()=>{ selectScene((sceneIndex+1)%sceneQuestions.length); });
document.querySelectorAll('[data-scene-detail]').forEach(b=>b.addEventListener('click',openScene));
$('[data-scene-close]').addEventListener('click',()=>$('#scene-detail').close());
selectScene(0,false);
const discoveryScene = $('.discovery-scene');
let sceneVisible = false, sceneTimer;
function scheduleScene() {
 clearTimeout(sceneTimer);
 if (!sceneVisible || document.hidden || paused || reduced.matches || $('#scene-detail').open || discoveryScene.matches(':hover') || discoveryScene.contains(document.activeElement) || discoveryScene.querySelector('.globe-wrap')?.classList.contains('is-dragging')) return;
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
