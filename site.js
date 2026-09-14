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
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Acme's daily share of monitored answers, on a zero to 100 percent scale. Use the date slider below for exact values."><defs><linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)" stop-opacity=".18"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${[
      0, 50, 100,
    ]
      .map((v) => {
        const y = point(v, 0)[1];
        return `<line class="plot-grid" x1="${pad}" y1="${y}" x2="${right}" y2="${y}"/><text class="plot-axis" x="0" y="${y + 4}">${v}%</text>`;
      })
      .join(
        "",
      )}<path d="${main} L${right},${bottom} L${pad},${bottom} Z" fill="url(#landing-chart-fill)"/><path class="plot-previous" d="${path("previous")}"/><path class="plot-current" d="${main}"/><line id="chart-cursor" x1="${right}" x2="${right}" y1="${top}" y2="${bottom}" stroke="var(--sky-3)" stroke-dasharray="3 3"/><circle id="chart-dot" r="4" fill="var(--accent-text)" stroke="white" stroke-width="2"/><text class="plot-axis" x="${pad}" y="138">Aug 11</text><text class="plot-axis" text-anchor="end" x="${right}" y="138">Sep 9</text></svg><div class="chart-scrubber"><label for="chart-day" class="sr-only">Inspect a date on the visibility chart</label><input id="chart-day" type="range" min="0" max="29" step="1" value="29"><output id="chart-readout" for="chart-day"></output></div>`;
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
    $("#chart-readout").textContent = `${label} · ${r.visibility.toFixed(1)}%`;
    $("#chart-day").setAttribute(
      "aria-valuetext",
      `${label}, Acme ${r.visibility.toFixed(1)} percent, previous period ${r.previous.visibility.toFixed(1)} percent`,
    );
  }
  $("#chart-day").addEventListener("input", (e) =>
    inspect(Number(e.target.value)),
  );
  $("#visibility-chart svg").addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
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
    $("#chart-day").value = index;
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
    `<div class="card-label">${logo(e.id)}<span>${e.name} · Sample answer</span></div><p>${record.mention ? "<mark>Acme</mark> " + q.excerpt : q.missing}</p><div class="citation-pill">${icon("link")} ${record.cited ? "acme.work" + q.page : record.external}</div><span class="badge ${record.mention ? "green" : "neutral"}">${record.mention ? "Acme mentioned" : "Acme not mentioned"}</span><p class="answer-note">${record.date} · Illustrative response to a monitored prompt, not a private conversation.</p>`;
  $("#question-rows")
    .querySelectorAll("button")
    .forEach((b) =>
      b.addEventListener("click", () => {
        question = b.dataset.question;
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
  const scopeStatus = $("#scope-status");
  if (scopeStatus)
    scopeStatus.textContent =
      `12 monitored questions · ${engine ? ENGINES.find((e) => e.id === engine).name : `${ENGINES.length} engines`} · ${format(report.a.length)} sample answers`;
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
  .forEach((b) => b.addEventListener("click", () => setStory(b.dataset.story)));
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
    document.querySelectorAll("[data-engine]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", x === b);
      if (x.closest("#extra-engines")) x.setAttribute("aria-checked", String(x === b));
    });
    const extra = b.closest('#extra-engines');
    $('#more-engine-label').textContent = extra ? b.getAttribute('aria-label') : '+6 engines';
    if (extra) { extra.hidden = true; extra.previousElementSibling.setAttribute('aria-expanded', 'false'); extra.previousElementSibling.focus(); }
    render();
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
try {
  await initializeOrbit();
  ready = true;
  await enhance($(".engine-controls"));
  await enhance($(".faq-list"));
  await enhance($("#opportunity-rows"));
  window.OrbitMotion.prepare($(".story-nav"));
  // Animate on entry once; content stays visible without JS or motion support.
  document.body.classList.add("motion-ready");
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        reveal.unobserve(target);
        target.classList.add("step-revealed");
        if (!paused && !reduced.matches) window.OrbitMotion.enter(target);
      }
    },
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(".feature-card,.steps-grid article,.early-access-card")
    .forEach((el) => reveal.observe(el));
} catch (error) {
  console.warn(
    "Orbit enhancements unavailable; native controls remain usable.",
    error,
  );
}
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) globe.destroy();
});

// The scene is a browsable set of illustrative questions, not live geolocation.
const sceneQuestions = [
 { city:'San Francisco', country:'United States', engine:'chatgpt', question:'What’s the best project tool for a small team?', answer:'Asana makes the shortlist. Acme is missing from this answer.', source:'G2 comparison', action:'Explain which team sizes Acme supports.', evidence:'The sample answer discusses team size and setup effort, but does not mention Acme.' },
 { city:'London', country:'United Kingdom', engine:'claude', question:'Which Notion alternative is best for project tracking?', answer:'ClickUp is recommended for task dependencies. Acme is not mentioned.', source:'Product comparison', action:'Show how dependencies work in Acme.', evidence:'The sample answer focuses on dependency tracking and project views. A clear comparison page would help explain Acme’s fit.' },
 { city:'Singapore', country:'Singapore', engine:'perplexity', question:'What is an affordable tool for a growing remote team?', answer:'Notion appears for its entry price. Acme is missing from the comparison.', source:'Pricing guide', action:'Make the per-seat cost easy to compare.', evidence:'The sample answer compares entry plans. Explain included features and the cost as a team grows.' }
];
let sceneIndex = 0;
function selectScene(index, animate = true) {
 sceneIndex = index;
 const item = sceneQuestions[index];
 $('.discovery-scene').dataset.location = String(index);
 $('.question-float .card-label img').src = `/assets/brands/${item.engine}.svg`;
 $('.question-float .card-label > span').textContent = item.city === item.country ? item.city : `${item.city} · ${item.country}`;
 $('.question-float p').textContent = item.question;
 $('.answer-float .card-label img').src = `/assets/brands/${item.engine}.svg`;
 $('.answer-float .card-label > span').textContent = 'Illustrative answer';
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
 $('#scene-detail-content').innerHTML=`<h2 id="scene-detail-title">${item.question}</h2><div class="scene-answer"><span>${item.city} · ${item.engine} · illustrative</span><p>${item.answer}</p></div><h3>Why it matters</h3><p>${item.evidence}</p><h3>Next action</h3><p>${item.action}</p><a class="button" href="/app/questions/">Explore buyer questions ${icon('arrow')}</a>`;
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
 if (!sceneVisible || document.hidden || paused || reduced.matches || $('#scene-detail').open || discoveryScene.matches(':hover') || discoveryScene.contains(document.activeElement)) return;
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
$('#scene-detail').addEventListener('close', scheduleScene);
document.addEventListener('visibilitychange', scheduleScene);
reduced.addEventListener('change', scheduleScene);
window.addEventListener('pagehide', () => clearTimeout(sceneTimer));
const workflow = {
 domain:['Website ready','Acme and its competitors are ready to compare.','Open the sample workspace','/app/overview/'],
 prompt:['Questions selected','Compare discovery, alternatives and pricing questions.','Explore buyer questions','/app/questions/'],
 insight:['Opportunity found','Review a comparison gap and the steps to improve it.','Review opportunities','/app/opportunities/']
};
document.querySelectorAll('[data-workflow]').forEach(b=>b.addEventListener('click',()=>{
 const [title,copy,cta,url]=workflow[b.dataset.workflow];
 document.querySelectorAll('[data-workflow]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 b.getAnimations().forEach(a=>a.cancel());
 b.animate(reduced.matches || document.body.classList.contains('reduce-motion') ? [{opacity:.6},{opacity:1}] : [{transform:'translateY(0)'},{transform:'translateY(-4px)'},{transform:'translateY(0)'}],{duration:350,easing:'ease-out'});
 $('#workflow-preview').hidden=false;
 $('#workflow-preview').innerHTML=`<div><strong>${title}</strong><p>${copy}</p></div><a class="button" href="${url}">${cta} ${icon('arrow')}</a>`;
}));
