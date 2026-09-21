import createGlobe from "cobe";
import { COUNTRY_LOCATIONS, locationVector, projectVector } from "./globe-coordinates.js";

export function mountGlobe(canvas, { isPaused = () => false } = {}) {
  const wrap = canvas.parentElement;
  const dragSurface = wrap.querySelector(".globe-explore") || canvas;
  const pins = [...wrap.querySelectorAll("[data-globe-question]")];
  const vectors = COUNTRY_LOCATIONS.map(locationVector);
  let size = Math.max(240, Math.round(wrap.getBoundingClientRect().width || wrap.clientWidth || 590));
  let fallback, fallbackContext, land = [];
  const blue = canvas.dataset.palette === "blue";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let globe,
    frame = 0,
    visible = false,
    phi = 2.3,
    theta = 0.22,
    last = 0,
    started = false,
    disposed = false,
    scrollTimer,
    resumeTimer,
    dragging = false,
    pointerId = null,
    pointerX = 0,
    pointerY = 0,
    dragMoved = false,
    holdUntil = 0;

  // Cobe requires numeric backing-buffer dimensions; keep them in physical pixels.
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const pixelSize = () => Math.max(1, Math.round(size * dpr));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let resizeTimer;

  function sizeCanvas() {
    const pixels = pixelSize();
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
  }

  async function restartWebGL() {
    if (disposed || !globe) return;
    globe.destroy();
    globe = null;
    started = false;
    sizeCanvas();
    await start();
  }

  const resize = new ResizeObserver(() => {
    const next = Math.max(240, Math.round(wrap.getBoundingClientRect().width || wrap.clientWidth || size));
    if (Math.abs(next - size) < 2) return;
    size = next;
    sizeCanvas();
    if (fallback) {
      fallback.width = pixelSize();
      fallback.height = pixelSize();
    }
    drawFallback();
    positionPins();
    if (globe) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => void restartWebGL(), 120);
    }
  });
  sizeCanvas();
  resize.observe(wrap);

  function positionPins() {
    pins.forEach((pin, i) => {
      const vector = vectors[i];
      if (!vector) {
        pin.style.visibility = "hidden";
        return;
      }
      const point = projectVector(vector, phi, theta);
      pin.style.setProperty("--pin-x", `${point.x * size}px`);
      pin.style.setProperty("--pin-y", `${point.y * size}px`);
      pin.style.opacity = point.visible ? "1" : "0";
      pin.style.pointerEvents = point.visible ? "auto" : "none";
      pin.style.visibility = point.visible ? "visible" : "hidden";
      pin.dataset.facing = point.visible ? "front" : "back";
    });
  }

  function drawFallback() {
    if (!fallbackContext) return;
    const ctx = fallbackContext;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const fill = ctx.createRadialGradient(size * .36, size * .3, 0, size * .5, size * .5, size * .4);
    fill.addColorStop(0, "#fff");
    fill.addColorStop(.65, blue ? "#eaf4ff" : "#f0eeff");
    fill.addColorStop(1, "#b7d1f1");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * .4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#34496e";
    ctx.beginPath();
    for (const vector of land) {
      const p = projectVector(vector, phi, theta);
      if (!p.visible) continue;
      const r = Math.max(.65, size * .002) * Math.min(1, p.depth * 2);
      ctx.moveTo(p.x * size + r, p.y * size);
      ctx.arc(p.x * size, p.y * size, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function renderOrientation() {
    drawFallback();
    positionPins();
  }

  async function startFallback() {
    if (fallback || disposed) return;
    fallback = document.createElement("canvas");
    fallback.setAttribute("aria-hidden", "true");
    fallback.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    fallback.width = pixelSize();
    fallback.height = pixelSize();
    fallbackContext = fallback.getContext("2d");
    wrap.insertBefore(fallback, wrap.querySelector(".engine-network") || dragSurface);
    const mask = getComputedStyle(wrap.querySelector(".css-globe"), "::before").maskImage;
    const source = mask.match(/url\(["']?(data:image\/png;base64,[^"')]+)["']?\)/)?.[1];
    wrap.classList.add("globe-ready");
    renderOrientation();
    sync();
    if (!source) return;
    const image = new Image();
    image.src = source;
    try {
      await image.decode();
      if (disposed) return;
      const map = document.createElement("canvas");
      map.width = 256;
      map.height = 128;
      const ctx = map.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, 256, 128);
      const pixels = ctx.getImageData(0, 0, 256, 128).data;
      for (let i = 0; i < 6000; i++) {
        const lat = Math.asin(1 - 2 * (i + .5) / 6000) * 180 / Math.PI;
        const lon = ((i * 137.50776405) % 360) - 180;
        const x = Math.floor((lon + 180) / 360 * 256) % 256;
        const y = Math.min(127, Math.floor((90 - lat) / 180 * 128));
        if (pixels[(y * 256 + x) * 4] > 128) land.push(locationVector([lat, lon]));
      }
      drawFallback();
    } catch {}
  }

  async function start() {
    if (started || disposed) return;
    started = true;
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (disposed) return;
    try {
      const context = { alpha: true, antialias: true };
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2", context) || probe.getContext("webgl", context);
      if (!gl) {
        void startFallback();
        return;
      }
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "";
      if (/swiftshader|llvmpipe|softpipe|software/i.test(renderer)) {
        void startFallback();
        return;
      }

      size = Math.max(240, Math.round(wrap.getBoundingClientRect().width || wrap.clientWidth || size));
      sizeCanvas();
      const renderSize = pixelSize();
      const markerSizes = [.045, .04, .038, .04, .042, .04, .038, .04];
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: renderSize,
        height: renderSize,
        phi,
        theta,
        dark: 0,
        diffuse: 1.4,
        mapSamples: 14000,
        mapBrightness: 5.8,
        baseColor: blue ? [0.87, 0.94, 1] : [0.91, 0.9, 0.98],
        markerColor: [0.18, 0.38, 0.84],
        glowColor: blue ? [0.95, 0.98, 1] : [0.98, 0.97, 1],
        markerElevation: 0,
        markers: COUNTRY_LOCATIONS.map((location, i) => ({ location, size: markerSizes[i] || .026 })),
        arcs: [
          { from: COUNTRY_LOCATIONS[0], to: COUNTRY_LOCATIONS[1] },
          { from: COUNTRY_LOCATIONS[1], to: COUNTRY_LOCATIONS[3] },
          { from: COUNTRY_LOCATIONS[3], to: COUNTRY_LOCATIONS[7] },
          { from: COUNTRY_LOCATIONS[7], to: COUNTRY_LOCATIONS[4] },
          { from: COUNTRY_LOCATIONS[4], to: COUNTRY_LOCATIONS[2] },
          { from: COUNTRY_LOCATIONS[2], to: COUNTRY_LOCATIONS[6] },
          { from: COUNTRY_LOCATIONS[0], to: COUNTRY_LOCATIONS[5] },
        ],
        arcColor: blue ? [0.26, 0.57, 0.94] : [0.57, 0.55, 0.9],
        arcWidth: 0.5,
        arcHeight: 0.22,
        opacity: 1,
        onRender: (state) => {
          if (visible && !document.hidden && !isPaused() && !reduced.matches && !dragging && performance.now() >= holdUntil) {
            phi += 0.00075;
          }
          state.phi = phi;
          state.theta = theta;
          positionPins();
        },
      });
      wrap.classList.add("globe-ready");
      renderOrientation();
      sync();
    } catch {
      void startFallback();
    }
  }

  function tick(now) {
    frame = 0;
    if ((!globe && !fallback) || !visible || document.hidden || isPaused()) return;
    if (dragging || now < holdUntil || reduced.matches) {
      last = now;
      if (!reduced.matches) frame = requestAnimationFrame(tick);
      return;
    }
    phi += Math.min(now - (last || now), 40) * 0.000085;
    last = now;
    renderOrientation();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (fallback && visible && !document.hidden && !isPaused() && !reduced.matches)
      frame = requestAnimationFrame(tick);
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging = true;
    dragMoved = false;
    pointerId = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    holdUntil = Infinity;
    wrap.classList.add("is-dragging");
    try { dragSurface.setPointerCapture(pointerId); } catch {}
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - pointerX;
    const dy = event.clientY - pointerY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > .5) dragMoved = true;
    phi += dx * 0.009;
    theta = clamp(theta + dy * 0.0045, -0.6, 0.65);
    renderOrientation();
  }

  function endDrag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    try { dragSurface.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
    holdUntil = performance.now() + 1400;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(sync, 1450);
    wrap.dispatchEvent(new CustomEvent("mentionloom:globe-drag-end", { bubbles: true }));
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

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    canvas.closest(".discovery-scene").classList.toggle("scene-visible", visible);
    sync();
    if (visible && !started) {
      if (reduced.matches || isPaused()) {
        started = true;
        void startFallback();
      } else {
        void start();
      }
    }
  });
  observer.observe(canvas);

  function onScroll() {
    clearTimeout(scrollTimer);
    if (visible && !started && !reduced.matches && !isPaused())
      scrollTimer = setTimeout(() => {
        if (visible && !disposed) void start();
      }, 180);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("webglcontextlost", () => {
    cancelAnimationFrame(frame);
    globe = null;
    void startFallback();
  });

  positionPins();

  return {
    sync,
    destroy() {
      disposed = true;
      clearTimeout(scrollTimer);
      clearTimeout(resumeTimer);
      clearTimeout(resizeTimer);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      dragSurface.removeEventListener("pointerdown", onPointerDown);
      dragSurface.removeEventListener("pointermove", onPointerMove);
      dragSurface.removeEventListener("pointerup", endDrag);
      dragSurface.removeEventListener("pointercancel", endDrag);
      dragSurface.removeEventListener("click", suppressDraggedClick, true);
      globe?.destroy();
      fallback?.remove();
    },
  };
}
