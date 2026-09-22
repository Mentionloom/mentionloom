import { COUNTRY_LOCATIONS, locationVector, projectVector } from "./globe-coordinates.js";

export function mountGlobe(canvas, { isPaused = () => false } = {}) {
  const wrap = canvas.parentElement;
  const scene = canvas.closest(".discovery-scene");
  const cards = [...scene.querySelectorAll(".question-float,.answer-float")];
  const dragSurface = wrap.querySelector(".globe-explore") || canvas;
  const cssGlobe = wrap.querySelector(".css-globe");
  const pins = [...wrap.querySelectorAll("[data-globe-question]")];
  const vectors = COUNTRY_LOCATIONS.map(locationVector);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const arcs = [
    [0, 1],
    [1, 3],
    [3, 7],
    [7, 4],
    [4, 2],
    [2, 6],
    [0, 5],
  ];

  let size = Math.max(
    240,
    Math.round(wrap.getBoundingClientRect().width || wrap.clientWidth || 590),
  );
  let context = canvas.getContext("2d");
  let land = [];
  let frame = 0;
  let visible = false;
  let disposed = false;
  const initialPhi = 0.565;
  let phi = initialPhi;
  let theta = 0.22;
  let last = 0;
  let dragging = false;
  let pointerId = null;
  let pointerX = 0;
  let pointerY = 0;
  let dragMoved = false;
  let firstReveal = true;
  let activeIndex = 0;
  let turn = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function sizeCanvas() {
    size = Math.max(
      240,
      Math.round(wrap.getBoundingClientRect().width || wrap.clientWidth || size),
    );
    const pixels = Math.max(1, Math.round(size * dpr));
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
  }

  function positionPins() {
    pins.forEach((pin, index) => {
      const vector = vectors[index];
      if (!vector) {
        pin.style.visibility = "hidden";
        return;
      }
      const point = projectVector(vector, phi, theta);
      pin.style.left = "0px";
      pin.style.top = "0px";
      pin.style.transform =
        `translate(${point.x * size}px, ${point.y * size}px) translate(-50%, -50%)`;
      pin.style.opacity = point.visible ? "1" : "0";
      pin.style.visibility = point.visible ? "visible" : "hidden";
      pin.style.pointerEvents = point.visible ? "auto" : "none";
      pin.dataset.facing = point.visible ? "front" : "back";
    });
  }

  function drawArc(ctx, from, to) {
    const a = projectVector(vectors[from], phi, theta);
    const b = projectVector(vectors[to], phi, theta);
    if (!a.visible || !b.visible) return;

    const x1 = a.x * size;
    const y1 = a.y * size;
    const x2 = b.x * size;
    const y2 = b.y * size;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const lift = Math.min(size * 0.08, length * 0.18);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(
      mx - (dy / length) * lift,
      my + (dx / length) * lift,
      x2,
      y2,
    );
    ctx.stroke();
  }

  function draw() {
    if (!context) return;
    const ctx = context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const radius = size * 0.4;
    const fill = ctx.createRadialGradient(
      size * 0.36,
      size * 0.30,
      0,
      size * 0.50,
      size * 0.50,
      radius,
    );
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(0.62, "#eef1ff");
    fill.addColorStop(1, "#b7d1f1");

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = "rgba(71, 111, 216, .055)";
    ctx.lineWidth = 0.75;
    for (const y of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.ellipse(
        size / 2,
        size / 2 + radius * y,
        radius,
        radius * Math.sqrt(1 - y * y) * 0.34,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    for (const squash of [0.26, 0.52, 0.78]) {
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, radius * squash, radius, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(71, 111, 216, .26)";
    ctx.lineWidth = 1;
    for (const [from, to] of arcs) drawArc(ctx, from, to);

    ctx.fillStyle = "#34496e";
    ctx.beginPath();
    for (const vector of land) {
      const p = projectVector(vector, phi, theta);
      if (!p.visible) continue;
      const dot = Math.max(0.65, size * 0.0018) * Math.min(1, p.depth * 2);
      ctx.moveTo(p.x * size + dot, p.y * size);
      ctx.arc(p.x * size, p.y * size, dot, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = "rgba(74, 112, 193, .14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.stroke();

    positionPins();
  }

  async function loadLand() {
    if (!cssGlobe || disposed) return;
    const mask = getComputedStyle(cssGlobe, "::before").maskImage;
    const source = mask.match(
      /url\(["']?(data:image\/png;base64,[^"')]+)["']?\)/,
    )?.[1];
    if (!source) return;

    const image = new Image();
    image.src = source;
    try {
      await image.decode();
      if (disposed) return;

      const map = document.createElement("canvas");
      map.width = 256;
      map.height = 128;
      const mapContext = map.getContext("2d", { willReadFrequently: true });
      if (!mapContext) return;

      mapContext.drawImage(image, 0, 0, 256, 128);
      const pixels = mapContext.getImageData(0, 0, 256, 128).data;
      const nextLand = [];

      for (let i = 0; i < 9000; i++) {
        const lat =
          (Math.asin(1 - (2 * (i + 0.5)) / 9000) * 180) / Math.PI;
        const lon = ((i * 137.50776405) % 360) - 180;
        const x = Math.floor(((lon + 180) / 360) * 256) % 256;
        const y = Math.min(127, Math.floor(((90 - lat) / 180) * 128));
        if (pixels[(y * 256 + x) * 4] > 128) {
          nextLand.push(locationVector([lat, lon]));
        }
      }

      land = nextLand;
      draw();
    } catch {
      // The globe remains usable with the radial sphere and country dots.
    }
  }

  function tick(now) {
    frame = 0;
    if (!visible || disposed || document.hidden || isPaused()) return;

    if (turn) {
      turn.elapsed += last ? Math.max(0, now - last) : 0;
      const t = Math.min(1, turn.elapsed / turn.duration);
      // A deliberate opening revolution, followed by shorter country-to-country turns.
      const eased = turn.intro ? t * t * (3 - 2 * t) : 1 - Math.pow(1 - t, 3);
      phi = turn.phi + turn.delta * eased;
      theta = turn.theta + (turn.targetTheta - turn.theta) * eased;
      if (t === 1) turn = null;
    }
    last = now;
    draw();
    if (turn) frame = requestAnimationFrame(tick);
    else if (!dragging) revealCards();
  }

  function hideCards() {
    scene.classList.add("scene-pending");
    scene.classList.remove("scene-ready");
    cards.forEach((card) => {
      card.inert = true;
      card.getAnimations().forEach((animation) => animation.cancel());
    });
  }

  function revealCards() {
    if (firstReveal || scene.classList.contains("scene-ready")) return;
    scene.classList.remove("scene-pending");
    scene.classList.add("scene-ready");
    cards.forEach((card, index) => {
      card.inert = false;
      if (!reduced.matches && !isPaused()) {
        card.animate([
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 240, delay: index * 60, fill: "backwards", easing: "cubic-bezier(.16,1,.3,1)" });
      }
    });
    wrap.dispatchEvent(new CustomEvent("mentionloom:globe-settled", {
      bubbles: true, detail: { index: activeIndex },
    }));
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (turn && (reduced.matches || isPaused())) {
      phi = turn.phi + turn.delta;
      theta = turn.targetTheta;
      turn = null;
      draw();
      revealCards();
    }
    if (
      visible &&
      !disposed &&
      !document.hidden &&
      !isPaused() &&
      !reduced.matches
    ) {
      frame = requestAnimationFrame(tick);
    } else {
      draw();
    }
  }

  function focusPhi(vector) {
    return Math.atan2(-vector[0], vector[2]);
  }

  function shortestTurn(from, to) {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  function focusLocation(index, smooth = true, intro = false) {
    const vector = vectors[index];
    if (!vector || disposed) return;

    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    hideCards();

    const startPhi = phi;
    const targetPhi = focusPhi(vector);
    const delta = intro ? Math.PI * 2 : shortestTurn(startPhi, targetPhi);
    const targetTheta = clamp(vector[1] * 0.34, -0.28, 0.34);
    const startTheta = theta;

    if (!smooth || reduced.matches || isPaused()) {
      turn = null;
      phi = startPhi + delta;
      theta = targetTheta;
      draw();
      revealCards();
      return;
    }

    turn = { phi: startPhi, theta: startTheta, delta, targetTheta,
      elapsed: 0, duration: intro ? 2600 : 900, intro };
    sync();
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (firstReveal || turn) return;
    dragging = true;
    dragMoved = false;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    hideCards();
    wrap.classList.add("is-dragging");
    try {
      dragSurface.setPointerCapture(pointerId);
    } catch {}
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - pointerX;
    const dy = event.clientY - pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) dragMoved = true;
    phi += dx * 0.009;
    theta = clamp(theta + dy * 0.0045, -0.6, 0.65);
    draw();
  }

  function endDrag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    try {
      dragSurface.releasePointerCapture(pointerId);
    } catch {}
    pointerId = null;
    focusLocation(activeIndex, dragMoved);
    wrap.dispatchEvent(
      new CustomEvent("mentionloom:globe-drag-end", { bubbles: true }),
    );
  }

  function suppressDraggedClick(event) {
    if (!dragMoved) return;
    dragMoved = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  dragSurface.addEventListener("pointerdown", onPointerDown);
  dragSurface.addEventListener("pointermove", onPointerMove);
  dragSurface.addEventListener("pointerup", endDrag);
  dragSurface.addEventListener("pointercancel", endDrag);
  dragSurface.addEventListener("click", suppressDraggedClick, true);

  const resize = new ResizeObserver(() => {
    const previous = size;
    sizeCanvas();
    if (Math.abs(previous - size) > 1) draw();
  });
  resize.observe(wrap);

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    canvas.closest(".discovery-scene")?.classList.toggle("scene-visible", visible);

    if (visible && firstReveal) {
      // Start and end on the selected country after exactly one full revolution.
      firstReveal = false;
      phi = focusPhi(vectors[activeIndex]);
      theta = clamp(vectors[activeIndex][1] * 0.34, -0.28, 0.34);
      focusLocation(activeIndex, true, true);
    }

    sync();
  });
  observer.observe(canvas);

  function onSceneChange(event) {
    const index = Number(event?.detail?.index);
    // Site initialization may announce the initial question while the intro is running.
    if (turn?.intro) return;
    if (Number.isInteger(index) && vectors[index]) {
      activeIndex = index;
      if (!firstReveal) focusLocation(index, event?.detail?.animate !== false);
    }
    else draw();
  }

  document.addEventListener("mentionloom:scene", onSceneChange);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);

  sizeCanvas();
  hideCards();
  wrap.classList.add("globe-ready");
  draw();
  void loadLand();
  sync();

  return {
    sync,
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("mentionloom:scene", onSceneChange);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      dragSurface.removeEventListener("pointerdown", onPointerDown);
      dragSurface.removeEventListener("pointermove", onPointerMove);
      dragSurface.removeEventListener("pointerup", endDrag);
      dragSurface.removeEventListener("pointercancel", endDrag);
      dragSurface.removeEventListener("click", suppressDraggedClick, true);
    },
  };
}
