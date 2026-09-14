import createGlobe from "cobe";
import { COUNTRY_LOCATIONS, locationVector, projectVector } from "./globe-coordinates.js";
export function mountGlobe(canvas, { isPaused = () => false } = {}) {
  // Capture the outer container before Cobe wraps its canvas.
  const wrap = canvas.parentElement;
  const pins = [...wrap.querySelectorAll('[data-globe-question]')];
  const vectors = COUNTRY_LOCATIONS.map(locationVector);
  let size = Math.max(240, wrap.clientWidth);
  let fallback, fallbackContext, land = [];
  const blue = canvas.dataset.palette === "blue";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let globe,
    frame = 0,
    visible = false,
    phi = 2.3,
    last = 0,
    started = false,
    disposed = false,
    scrollTimer;
  const measure = () => size;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const resize = new ResizeObserver(() => {
    size = Math.max(240, wrap.clientWidth);
    globe?.update({ width: size, height: size });
    if (fallback) { fallback.width = size * dpr; fallback.height = size * dpr; }
    drawFallback();
    positionPins();
  });
  resize.observe(wrap);
  // Pins and land use the exact same rotation, tilt, and projection as WebGL.
  function positionPins() {
    pins.forEach((pin, i) => {
      const point = projectVector(vectors[i], phi);
      pin.style.left = '0px';
      pin.style.top = '0px';
      pin.style.transform = `translate(${point.x * size}px, ${point.y * size}px) translate(-50%, -50%)`;
      pin.style.visibility = point.visible ? 'visible' : 'hidden';
      pin.dataset.facing = point.visible ? 'front' : 'back';
    });
  }
  function drawFallback() {
    if (!fallbackContext) return;
    const ctx = fallbackContext;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const fill = ctx.createRadialGradient(size*.36,size*.3,0,size*.5,size*.5,size*.4);
    fill.addColorStop(0,'#fff'); fill.addColorStop(.65,blue?'#eaf4ff':'#f0eeff'); fill.addColorStop(1,'#b7d1f1');
    ctx.fillStyle=fill; ctx.beginPath();ctx.arc(size/2,size/2,size*.4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#34496e';
    ctx.beginPath();
    for (const vector of land) {
      const p=projectVector(vector,phi);
      if (!p.visible) continue;
      const r=Math.max(.65,size*.002)*Math.min(1,p.depth*2);
      ctx.moveTo(p.x*size+r,p.y*size);ctx.arc(p.x*size,p.y*size,r,0,Math.PI*2);
    }
    ctx.fill();
  }
  async function startFallback() {
    if (fallback || disposed) return;
    fallback=document.createElement('canvas');fallback.setAttribute('aria-hidden','true');
    fallback.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    fallback.width=size*dpr;fallback.height=size*dpr;
    fallbackContext=fallback.getContext('2d');
    wrap.insertBefore(fallback,wrap.querySelector('.engine-network') || wrap.querySelector('.globe-explore'));
    // Reuse the installed Cobe land mask already supplied for the CSS fallback.
    const mask=getComputedStyle(wrap.querySelector('.css-globe'),'::before').maskImage;
    const source=mask.match(/url\(["']?(data:image\/png;base64,[^"')]+)["']?\)/)?.[1];
    wrap.classList.add('globe-ready');
    drawFallback();positionPins();sync();
    if (!source) return;
    const image=new Image();image.src=source;
    try {
      await image.decode(); if(disposed)return;
      const map=document.createElement('canvas');map.width=256;map.height=128;
      const ctx=map.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,256,128);
      const pixels=ctx.getImageData(0,0,256,128).data;
      for(let i=0;i<6000;i++) {
        const lat=Math.asin(1-2*(i+.5)/6000)*180/Math.PI;
        const lon=((i*137.50776405)%360)-180;
        const x=Math.floor((lon+180)/360*256)%256;
        const y=Math.min(127,Math.floor((90-lat)/180*128));
        if(pixels[(y*256+x)*4]>128)land.push(locationVector([lat,lon]));
      }
      drawFallback();
    } catch { /* The sphere and accurately projected pins remain available. */ }
  }
  positionPins();
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
      if (!gl) { void startFallback(); return; }
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : "";
      // Software renderers use a lightweight 2D globe with the same geographic
      // projection instead of compiling the WebGL map shader.
      if (/swiftshader|llvmpipe|softpipe|software/i.test(renderer)) { void startFallback(); return; }
      globe = createGlobe(canvas, {
        context,
        devicePixelRatio: dpr,
        width: measure(),
        height: measure(),
        phi,
        theta: 0.22,
        dark: 0,
        diffuse: 1.4,
        mapSamples: 14000,
        mapBrightness: 5.8,
        baseColor: blue ? [0.87, 0.94, 1] : [0.91, 0.9, 0.98],
        markerColor: blue ? [0.12, 0.38, 0.85] : [0.39, 0.32, 0.74],
        glowColor: blue ? [0.95, 0.98, 1] : [0.98, 0.97, 1],
        markerElevation: 0,
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
        arcColor: blue ? [0.26, 0.57, 0.94] : [0.57, 0.55, 0.9],
        arcWidth: 0.5,
        arcHeight: 0.22,
        opacity: 1,
      });
      wrap.classList.add("globe-ready");
      positionPins();
      sync();
    } catch {
      void startFallback();
    }
  }
  function tick(now) {
    frame = 0;
    if ((!globe && !fallback) || !visible || document.hidden || reduced.matches || isPaused())
      return;
    phi += Math.min(now - (last || now), 40) * 0.000085;
    last = now;
    globe?.update({ phi });
    drawFallback();
    positionPins();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if ((globe || fallback) && visible && !document.hidden && !reduced.matches && !isPaused())
      frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    canvas
      .closest(".discovery-scene")
      .classList.toggle("scene-visible", visible);
    sync();
    if (visible && !started) {
      if(reduced.matches || isPaused()) { started=true;void startFallback(); }
      else void start();
    }
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
    void startFallback();
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
      fallback?.remove();
    },
  };
}
