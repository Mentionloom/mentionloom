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

const FLUID_ORB_VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FLUID_ORB_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.22;

  vec2 drift = vec2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1)
  );

  vec2 p = vec2(uv.x * 1.8, uv.y * 1.0) + drift * 0.7;
  vec2 q = vec2(fbm(p + drift), fbm(p + vec2(3.2, 1.5) - drift));
  float f = fbm(p + 1.2 * q);

  float g = clamp(1.0 - uv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, uv.y);
  float shade = clamp(g + (f - 0.5) * 0.58 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.995, 0.998, 1.0);
  vec3 light = mix(white, u_color, 0.20);
  vec3 dark = mix(white, u_color, 0.68);

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.60, 0.90, shade));

  float edge = 1.0 - smoothstep(0.487, 0.5, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(col * edge, edge);
}
`;

function fluidOrbHexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0.49, 0.65, 0.93];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileFluidOrbShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Fluid orb shader unavailable:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function mountFluidOrb(host) {
  if (!host) return { destroy() {} };
  const canvas = host.querySelector("canvas");
  if (!canvas) return { destroy() {} };

  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!gl) {
    host.classList.add("fluid-orb-fallback");
    return { destroy() {} };
  }

  const program = gl.createProgram();
  const vert = compileFluidOrbShader(gl, gl.VERTEX_SHADER, FLUID_ORB_VERT);
  const frag = compileFluidOrbShader(gl, gl.FRAGMENT_SHADER, FLUID_ORB_FRAG);
  if (!program || !vert || !frag) return { destroy() {} };

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Fluid orb program unavailable:", gl.getProgramInfoLog(program));
    return { destroy() {} };
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  gl.uniform3f(
    gl.getUniformLocation(program, "u_color"),
    ...fluidOrbHexToRgb(host.dataset.color || "#7EA6EE"),
  );

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const start = performance.now();
  let raf = 0;
  let visible = true;
  let destroyed = false;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
    }
  };

  const render = (now) => {
    if (destroyed) return;
    resize();
    gl.uniform1f(uTime, motion.matches ? 0 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = 0;
    if (!motion.matches && visible && !document.hidden) {
      raf = requestAnimationFrame(render);
    }
  };

  const wake = () => {
    if (destroyed || raf) return;
    raf = requestAnimationFrame(render);
  };

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(wake) : null;
  resizeObserver?.observe(host);

  const visibilityObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) wake();
            else if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          },
          { threshold: 0.08 },
        )
      : null;
  visibilityObserver?.observe(host);

  const onVisibility = () => {
    if (!document.hidden) wake();
  };
  const onMotion = () => wake();
  document.addEventListener("visibilitychange", onVisibility);
  motion.addEventListener?.("change", onMotion);
  wake();

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener?.("change", onMotion);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    },
  };
}

const globe = mountGlobe($("#discovery-globe"), { isPaused: () => paused });
const fluidOrb = mountFluidOrb($("[data-fluid-orb]"));

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

function microReveal(el, delay = 0, duration = 260, scale = 0.985, fromOpacity = 0.55) {
  if (!el) return;
  animate(
    el,
    [
      { opacity: fromOpacity, transform: `scale(${scale})` },
      { opacity: 1, transform: "scale(1)" },
    ],
    duration,
    { delay, fill: "backwards" },
  );
}

function microRevealMany(elements, delay = 0, step = 45, options = {}) {
  [...elements].forEach((el, index) =>
    microReveal(
      el,
      delay + index * step,
      options.duration ?? 260,
      options.scale ?? 0.985,
      options.opacity ?? 0.55,
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
  microReveal(company?.querySelector(".acme-mark"), 0, 240, 0.9, 0.6);
  microReveal(company?.querySelector("strong"), 35, 220, 1, 0.5);
  microReveal(company?.querySelector("span:not(.acme-mark)"), 70, 220, 1, 0.5);

  microRevealMany(stage.querySelectorAll(".engine-controls [data-engine]"), 80, 34, {
    duration: 230,
    scale: 0.94,
    opacity: 0.5,
  });

  const metric = stage.querySelector(".visibility-metric");
  microReveal(metric?.querySelector(":scope > span"), 145, 220, 1, 0.48);
  microReveal(metric?.querySelector(":scope > div > strong"), 175, 280, 0.965, 0.5);
  microReveal(metric?.querySelector(":scope > div > .delta"), 215, 220, 0.9, 0.45);
  microReveal(metric?.querySelector(":scope > p"), 245, 220, 1, 0.5);

  const panel = stage.querySelector(".competitor-panel");
  microReveal(panel?.querySelector(".panel-title h3"), 190, 230, 1, 0.48);
  microReveal(panel?.querySelector(".panel-title > .icon"), 220, 230, 0.88, 0.45);
  microReveal(panel?.querySelector(":scope > p"), 250, 220, 1, 0.5);

  microRevealMany(stage.querySelectorAll(".chart-legend > span"), 430, 45, {
    duration: 220,
    scale: 0.98,
    opacity: 0.5,
  });
  microReveal(stage.querySelector(".stage-bottom .text-link"), 500, 240, 0.98, 0.5);

  // Build the data itself: roll the metric, draw the chart, grow ranked bars.
  setTimeout(() => {
    if (!stage.isConnected) return;
    render(report, true);
  }, 95);

  setTimeout(() => {
    stage.dataset.motionState = "complete";
  }, 980);
}

let insightsMotionPlayed = false;
function playInsightsMotion() {
  const section = $("#insights");
  if (!section || insightsMotionPlayed) return;
  insightsMotionPlayed = true;
  section.dataset.motionState = reduced.matches || paused ? "complete" : "running";
  if (reduced.matches || paused || !window.OrbitMotion) return;

  const enter = (el, delay = 0, distance = 8, duration = 360, scale = 0.992) => {
    if (!el) return;
    microReveal(el, delay, duration, scale, 0.5);
  };
  const enterMany = (elements, delay = 0, step = 70, options = {}) => {
    [...elements].forEach((el, index) =>
      enter(
        el,
        delay + index * step,
        options.distance ?? 8,
        options.duration ?? 360,
        options.scale ?? 0.992,
      ),
    );
  };
  const rollInitial = (el, delay = 0) => {
    if (!el || !window.OrbitNumbers) return;
    const value = Number(el.textContent.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(value)) return;
    setTimeout(() => {
      if (!el.isConnected) return;
      window.OrbitNumbers.set(el, value, { initial: true });
    }, delay);
  };

  const cards = [...section.querySelectorAll(".feature-card")];
  cards.forEach((card, index) => {
    const base = 80 + index * 120;
    enter(card.querySelector(".feature-label"), base, 5, 260, 1);
    enter(card.querySelector(".feature-copy h3"), base + 55, 10, 420, 0.996);
    enter(card.querySelector(".feature-copy > p"), base + 125, 7, 330, 1);
    enter(
      card.querySelector(".source-visual,.funnel-visual,.action-visual,.shortlist-visual"),
      base + 205,
      14,
      520,
      0.988,
    );
  });

  // Cited content — table structure resolves like the product's ranked evidence lists.
  const sourceCard = section.querySelector(".source-card");
  if (sourceCard) {
    const base = 365;
    enter(sourceCard.querySelector(".visual-table-head"), base, 5, 280, 1);
    const rows = [...sourceCard.querySelectorAll(".source-row")];
    enterMany(rows, base + 90, 75, { distance: 6, duration: 320, scale: 0.995 });
    rows.forEach((row, index) => rollInitial(row.querySelector("b"), base + 150 + index * 75));
  }

  // Referrals — roll the outcome numbers, then build the funnel from top to bottom.
  const trafficCard = section.querySelector(".traffic-card");
  if (trafficCard) {
    const base = 470;
    const stats = [...trafficCard.querySelectorAll(".funnel-stats > div")];
    enterMany(stats, base, 95, { distance: 7, duration: 330, scale: 0.995 });
    rollInitial($("#referral-number"), base + 45);
    rollInitial($("#lead-number"), base + 140);
    const steps = [...trafficCard.querySelectorAll(".marketing-funnel-step")];
    enterMany(steps, base + 250, 95, { distance: 7, duration: 320, scale: 0.995 });
    steps.forEach((step, index) => {
      const bar = step.querySelector(".marketing-funnel-track > span");
      if (!bar) return;
      animate(
        bar,
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        720,
        { delay: base + 325 + index * 105, fill: "backwards" },
      );
    });
  }

  // Opportunity — assemble the brief as a real task, not a decorative card.
  const actionCard = section.querySelector(".action-card");
  if (actionCard) {
    const base = 650;
    enter(actionCard.querySelector(".action-card-heading"), base, 5, 280, 1);
    enter(actionCard.querySelector(".action-visual h4"), base + 70, 9, 360, 0.996);
    enter(actionCard.querySelector(".action-visual > p"), base + 135, 6, 300, 1);
    const choices = [...actionCard.querySelectorAll(".action-checks .choice")];
    enterMany(choices, base + 235, 85, { distance: 6, duration: 300, scale: 0.995 });
    choices.forEach((choice, index) => {
      const input = choice.querySelector("input");
      if (!input) return;
      animate(
        input,
        [
          { opacity: 0.45, transform: "scale(.76)" },
          { opacity: 1, transform: "scale(1.08)", offset: 0.72 },
          { opacity: 1, transform: "scale(1)" },
        ],
        300,
        { delay: base + 315 + index * 85, fill: "backwards" },
      );
    });
    enter(actionCard.querySelector(".brief-progress"), base + 520, 6, 300, 1);
    const progress = actionCard.querySelector(".brief-progress > div > span");
    progress &&
      animate(progress, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 650, {
        delay: base + 585,
        fill: "backwards",
      });
  }

  // Competitive context — question first, shortlist assembles, then Acme lands in context.
  const audienceCard = section.querySelector(".audience-card");
  if (audienceCard) {
    const base = 830;
    enter(audienceCard.querySelector(".shortlist-question"), base, 8, 340, 0.992);
    const brandGroup = audienceCard.querySelector(".shortlist-brands");
    brandGroup &&
      animate(
        brandGroup,
        [{ opacity: 0.18 }, { opacity: 1 }],
        430,
        { delay: base + 120, fill: "backwards" },
      );
    const brands = [...audienceCard.querySelectorAll(".shortlist-brands > span")];
    brands.forEach((brand, index) => {
      const isSelf = brand.classList.contains("your-brand");
      animate(
        brand,
        [
          {
            opacity: 0,
            transform: isSelf
              ? "translateY(3px) scale(.78)"
              : "translateY(8px) scale(.82)",
          },
          {
            opacity: 1,
            transform: isSelf
              ? "translateY(-7px) scale(1.06)"
              : "translateY(0) scale(1.04)",
            offset: 0.76,
          },
          {
            opacity: 1,
            transform: isSelf
              ? "translateY(-7px) scale(1)"
              : "translateY(0) scale(1)",
          },
        ],
        430,
        { delay: base + 205 + index * 95, fill: "backwards" },
      );
    });
    enter(audienceCard.querySelector(".your-brand-caption"), base + 640, 6, 300, 1);
  }

  setTimeout(() => {
    section.dataset.motionState = "complete";
  }, 2350);
}

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

  const enter = (el, delay = 0, distance = 8, duration = 360, scale = 0.992) => {
    if (!el) return;
    microReveal(el, delay, duration, scale, 0.5);
  };
  const enterMany = (elements, delay = 0, step = 70, options = {}) => {
    [...elements].forEach((el, index) =>
      enter(
        el,
        delay + index * step,
        options.distance ?? 8,
        options.duration ?? 360,
        options.scale ?? 0.992,
      ),
    );
  };

  // Build the section copy first, then let each miniature assemble itself.
  enter(section.querySelector(".section-heading .eyebrow"), 0, 6, 280, 1);
  enter(section.querySelector(".section-heading h2"), 55, 12, 460, 0.995);
  enter(section.querySelector(".section-heading > p"), 125, 8, 360, 1);

  const steps = [...section.querySelectorAll(".clearer-step")];
  steps.forEach((step, index) => {
    const baseDelay = 230 + index * 135;
    enter(step.querySelector(".step-visual"), baseDelay, 16, 540, 0.988);
    enter(step.querySelector(".step-number"), baseDelay + 95, 6, 260, 1);
    enter(step.querySelector("h3"), baseDelay + 145, 9, 360, 0.995);
    enter(step.querySelector(":scope > p"), baseDelay + 205, 7, 340, 1);
  });

  // 01 — company intelligence assembles from status → scan → discovered profile.
  const companyDelay = 390;
  enter(section.querySelector(".mini-product-heading"), companyDelay, 6, 300, 1);
  const companyProgress = section.querySelector(".company-progress > span");
  companyProgress &&
    animate(companyProgress, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 820, {
      delay: companyDelay + 80,
      fill: "backwards",
    });
  const statusDot = section.querySelector(".mini-product-status i");
  statusDot &&
    animate(
      statusDot,
      [
        { transform: "scale(.78)", boxShadow: "0 0 0 0 var(--accent-soft)" },
        { transform: "scale(1.16)", boxShadow: "0 0 0 6px transparent", offset: 0.58 },
        { transform: "scale(1)", boxShadow: "0 0 0 0 transparent" },
      ],
      820,
      { delay: companyDelay + 105, fill: "backwards" },
    );
  enterMany(section.querySelectorAll(".company-intel-row"), companyDelay + 210, 92, {
    distance: 8,
    duration: 340,
    scale: 0.988,
  });
  enter(section.querySelector(".company-ready"), companyDelay + 650, 5, 300, 1);

  // 02 — question generation: header appears, rows resolve, checks confirm, then intent totals land.
  const questionsDelay = 535;
  enter(section.querySelector(".question-generator-head"), questionsDelay, 6, 300, 1);
  enter(section.querySelector(".generated-questions"), questionsDelay + 70, 10, 420, 0.994);
  const questionRows = [...section.querySelectorAll(".generated-question")];
  enterMany(questionRows, questionsDelay + 165, 105, {
    distance: 7,
    duration: 320,
    scale: 0.994,
  });
  const questionChecks = [...section.querySelectorAll(".question-check")];
  questionChecks.forEach((check, index) =>
    animate(
      check,
      [
        { opacity: 0.16, transform: "scale(.78)" },
        { opacity: 1, transform: "scale(1.1)", offset: 0.7 },
        { opacity: 1, transform: "scale(1)" },
      ],
      360,
      { delay: questionsDelay + 390 + index * 175, fill: "both" },
    ),
  );
  const questionSelection = section.querySelector(".question-selection");
  if (questionSelection && questionRows.length === 3) {
    const y2 = questionRows[1].offsetTop - questionRows[0].offsetTop;
    const y3 = questionRows[2].offsetTop - questionRows[0].offsetTop;
    animate(
      questionSelection,
      [
        { transform: "translateY(0) scale(1)", offset: 0 },
        { transform: "translateY(0) scale(1)", offset: 0.18 },
        { transform: `translateY(${y2}px) scale(.994)`, offset: 0.36 },
        { transform: `translateY(${y2}px) scale(1)`, offset: 0.5 },
        { transform: `translateY(${y3}px) scale(.994)`, offset: 0.72 },
        { transform: `translateY(${y3}px) scale(1)`, offset: 1 },
      ],
      2200,
      { delay: questionsDelay + 470, fill: "both" },
    );
  }
  enterMany(section.querySelectorAll(".question-footer > span"), questionsDelay + 730, 55, {
    distance: 4,
    duration: 260,
    scale: 0.97,
  });

  // 03 — comparison gap resolves into a concrete next move.
  const actionDelay = 680;
  enter(section.querySelector(".gap-header"), actionDelay, 6, 300, 1);
  const rankRows = [...section.querySelectorAll(".mini-rank-row")];
  enterMany(rankRows, actionDelay + 130, 105, {
    distance: 7,
    duration: 330,
    scale: 0.993,
  });
  [...section.querySelectorAll(".mini-rank-fill")].forEach((fill, index) =>
    animate(fill, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 700, {
      delay: actionDelay + 220 + index * 120,
      fill: "backwards",
    }),
  );
  const brief = section.querySelector(".brief-build");
  enter(brief, actionDelay + 500, 13, 500, 0.986);
  enter(section.querySelector(".brief-kicker"), actionDelay + 610, 5, 260, 1);
  enter(section.querySelector(".brief-build > strong"), actionDelay + 675, 7, 320, 0.995);
  enter(section.querySelector(".brief-build > p"), actionDelay + 740, 6, 300, 1);
  enter(section.querySelector(".brief-ready"), actionDelay + 820, 5, 300, 1);

  setTimeout(() => {
    if (statusLabel) window.OrbitMotion.feedback(statusLabel, "Ready");
    section.dataset.motionState = "complete";
  }, 2920);
}

// Product structures stay rendered at all times. Viewport observers below only animate their internal content.\n\ntry {
  await initializeOrbit();
  ready = true;
  await enhance($(".engine-controls"));
  await enhance($(".faq-list"));
  await enhance($("#opportunity-rows"));
  window.OrbitMotion.prepare($(".story-nav"));

  const insights = $("#insights");
  if (insights) {
    const insightsObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        playInsightsMotion();
      },
      { threshold: 0.16, rootMargin: "0px 0px -6% 0px" },
    );
    insightsObserver.observe(insights);
  }

  const approach = $("#approach");
  if (approach) {
    const approachObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        playApproachMotion();
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    approachObserver.observe(approach);
  }

  const productStage = $(".product-stage");
  if (productStage) {
    const productObserver = new IntersectionObserver(
      ([entry], observer) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        playProductMotion();
      },
      { threshold: 0.14, rootMargin: "0px 0px -5% 0px" },
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
    { step: 45 },
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
  registerReveal("#product .story-nav", "button", { step: 38, scale: 0.96 });
  registerReveal("#product .value-trio", ":scope>div>.icon,:scope>div>p", {
    step: 42,
    scale: 0.97,
  });
  registerReveal("#faq", ":scope>div:first-child .eyebrow,:scope>div:first-child h2,:scope>div:first-child p,.faq-list details", {
    step: 38,
    scale: 0.985,
  });
  registerReveal(
    ".early-access-card",
    ":scope>.eyebrow,:scope>h2,:scope>p,.hero-actions .button,.offer-notes>span",
    { step: 42, scale: 0.975 },
  );
  registerReveal(
    ".brand-footer",
    ".brand-footer-label,.brand-footer-col a,.brand-footer-note,.brand-footer-meta>*,.brand-footer-logo",
    { step: 30, scale: 0.98 },
  );

  const structureReveal = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        structureReveal.unobserve(target);
        const plan = revealPlans.get(target);
        if (!plan || paused || reduced.matches) continue;
        microRevealMany(target.querySelectorAll(plan.itemSelector), 0, plan.step ?? 40, {
          duration: plan.duration ?? 250,
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
    .querySelectorAll("#product,.provider-strip,.discovery-scene,.early-access-section")
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
    fluidOrb.destroy();
  }
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
