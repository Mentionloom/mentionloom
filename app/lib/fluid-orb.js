const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
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
  float shade = clamp(g + (f - 0.5) * 0.62 * anchor, 0.0, 1.0);

  vec3 white = vec3(0.995, 0.998, 1.0);
  vec3 light = mix(white, u_color, 0.18);
  vec3 dark = mix(white, u_color, 0.66);

  vec3 col = white;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, dark, smoothstep(0.60, 0.90, shade));

  float edge = 1.0 - smoothstep(0.487, 0.5, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(col * edge, edge);
}
`;

function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0.56, 0.72, 0.96];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, source) {
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

export function mountFluidOrb(host, { color = "#8FB8F4" } = {}) {
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
  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!program || !vert || !frag) {
    host.classList.add("fluid-orb-fallback");
    return { destroy() {} };
  }

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Fluid orb program unavailable:", gl.getProgramInfoLog(program));
    host.classList.add("fluid-orb-fallback");
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
    ...hexToRgb(host.dataset.color || color),
  );

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
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
    gl.uniform1f(uTime, reduced.matches ? 0 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = 0;
    if (!reduced.matches && visible && !document.hidden) raf = requestAnimationFrame(render);
  };

  const wake = () => {
    if (!destroyed && !raf) raf = requestAnimationFrame(render);
  };

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(wake) : null;
  resizeObserver?.observe(host);

  const visibilityObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) wake();
          else if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        }, { threshold: 0.05 })
      : null;
  visibilityObserver?.observe(host);

  const onVisibility = () => {
    if (!document.hidden) wake();
  };
  const onReduced = () => wake();

  document.addEventListener("visibilitychange", onVisibility);
  reduced.addEventListener?.("change", onReduced);
  wake();

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener?.("change", onReduced);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    },
  };
}
