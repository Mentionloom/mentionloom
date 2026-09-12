import createGlobe from "cobe";
export function mountGlobe(canvas, { isPaused = () => false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let globe,
    frame = 0,
    visible = false,
    phi = 2.3,
    last = 0,
    started = false,
    disposed = false,
    scrollTimer;
  const measure = () => Math.max(240, canvas.parentElement.clientWidth);
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const resize = new ResizeObserver(() =>
    globe?.update({ width: measure() * dpr, height: measure() * dpr }),
  );
  async function start() {
    if (started || disposed) return;
    started = true;
    // Let readable content paint before compiling a decorative WebGL scene.
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    if (disposed) return;
    try {
      const context = { alpha: true, antialias: true };
      const gl =
        canvas.getContext("webgl2", context) ||
        canvas.getContext("webgl", context);
      if (!gl) return;
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "";
      // Software renderers keep the lightweight CSS globe rather than blocking
      // navigation with expensive shader compilation and continuous CPU drawing.
      if (/swiftshader|llvmpipe|softpipe|software/i.test(renderer)) return;
      globe = createGlobe(canvas, {
        context,
        devicePixelRatio: dpr,
        width: measure() * dpr,
        height: measure() * dpr,
        phi,
        theta: 0.22,
        dark: 0,
        diffuse: 1.4,
        mapSamples: 14000,
        mapBrightness: 5.8,
        baseColor: [0.91, 0.9, 0.98],
        markerColor: [0.39, 0.32, 0.74],
        glowColor: [0.98, 0.97, 1],
        markers: [
          { location: [37.77, -122.42], size: 0.035 },
          { location: [51.51, -0.12], size: 0.03 },
          { location: [35.68, 139.69], size: 0.03 },
          { location: [1.35, 103.82], size: 0.025 },
          { location: [-23.55, -46.63], size: 0.03 },
          { location: [-33.87, 151.21], size: 0.025 },
        ],
        arcs: [
          { from: [37.77, -122.42], to: [51.51, -0.12] },
          { from: [51.51, -0.12], to: [1.35, 103.82] },
        ],
        arcColor: [0.57, 0.55, 0.9],
        arcWidth: 0.5,
        arcHeight: 0.22,
        opacity: 1,
      });
      canvas.parentElement.classList.add("globe-ready");
      resize.observe(canvas.parentElement);
      sync();
    } catch {
      canvas.parentElement.classList.remove("globe-ready");
    }
  }
  function tick(now) {
    frame = 0;
    if (!globe || !visible || document.hidden || reduced.matches || isPaused())
      return;
    phi += Math.min(now - (last || now), 40) * 0.000085;
    last = now;
    globe.update({ phi });
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (globe && visible && !document.hidden && !reduced.matches && !isPaused())
      frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    canvas
      .closest(".discovery-scene")
      .classList.toggle("scene-visible", visible);
    sync();
    if (visible && !started && !reduced.matches && !isPaused()) void start();
  });
  observer.observe(canvas);
  // Upgrade the visible CSS globe after the visitor has settled from scrolling.
  // Initial reading and signup never wait for decorative shader compilation.
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
    canvas.parentElement.classList.remove("globe-ready");
  });
  return {
    sync,
    destroy() {
      disposed = true;
      clearTimeout(scrollTimer);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      globe?.destroy();
    },
  };
}
