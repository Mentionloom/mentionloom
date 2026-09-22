import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGlobe } from '../marketing/globe.js';

function fixture(t, reduce = false) {
  const classList = () => {
    const values = new Set();
    return {
      add: (...names) => names.forEach(name => values.add(name)),
      remove: (...names) => names.forEach(name => values.delete(name)),
      contains: name => values.has(name),
      toggle(name, on) { on ? values.add(name) : values.delete(name); },
    };
  };
  const element = () => Object.assign(new EventTarget(), {
    style: {}, dataset: {}, classList: classList(),
    getBoundingClientRect: () => ({ width: 590 }),
    getAnimations: () => [], animate() {},
  });
  const cards = [element(), element()];
  const pins = Array.from({ length: 8 }, element);
  const scene = element();
  scene.querySelectorAll = () => cards;
  const surface = element();
  const wrap = element();
  wrap.querySelector = selector => selector === '.globe-explore' ? surface : null;
  wrap.querySelectorAll = () => pins;
  const context = new Proxy({}, { get: (_, key) => key === 'createRadialGradient'
    ? () => ({ addColorStop() {} }) : () => {} });
  const canvas = element();
  canvas.parentElement = wrap;
  canvas.closest = () => scene;
  canvas.getContext = () => context;
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const reduced = Object.assign(new EventTarget(), { matches: reduce });
  let observer;
  let now = 100;
  let nextId = 0;
  const frames = new Map();
  const globals = {
    document: doc, devicePixelRatio: 1,
    matchMedia: () => reduced,
    requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class {
      constructor(fn) { observer = fn; }
      observe() {} disconnect() {}
    },
  };
  const restore = [];
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    restore.push(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  const settled = [];
  wrap.addEventListener('mentionloom:globe-settled', e => settled.push(e.detail.index));
  const globe = mountGlobe(canvas);
  t.after(() => { globe.destroy(); restore.forEach(fn => fn()); });
  return {
    cards, pins, scene, settled, doc, reduced,
    visible: value => observer([{ isIntersecting: value }]),
    select: (index, animate = true) => doc.dispatchEvent(new CustomEvent('mentionloom:scene', { detail: { index, animate } })),
    advance(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 16) {
        now += 16;
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach(fn => fn(now));
      }
    },
  };
}

test('opening globe makes a full turn before exposing cards, even with late site initialization', t => {
  const f = fixture(t);
  f.visible(true);
  f.advance(16);
  const start = f.pins[0].style.transform;
  assert.ok(f.cards.every(card => card.inert));
  f.select(0, false);
  f.advance(1280);
  assert.equal(f.pins[0].dataset.facing, 'back');
  assert.equal(f.scene.classList.contains('scene-ready'), false);
  assert.deepEqual(f.settled, []);
  f.advance(1400);
  assert.equal(f.pins[0].dataset.facing, 'front');
  assert.ok(f.cards.every(card => !card.inert));
  assert.deepEqual(f.settled, [0]);
  const position = value => [...value.matchAll(/translate\(([-\d.]+)px, ([-\d.]+)px\)/g)][0].slice(1).map(Number);
  const [x1, y1] = position(start), [x2, y2] = position(f.pins[0].style.transform);
  assert.ok(Math.hypot(x2 - x1, y2 - y1) < 0.1);
});

test('offscreen intro pauses and rapid country changes reveal only the final front-facing pin', t => {
  const f = fixture(t);
  f.visible(true);
  f.advance(700);
  f.visible(false);
  const position = f.pins[0].style.transform;
  f.advance(5000);
  assert.equal(f.pins[0].style.transform, position);
  assert.deepEqual(f.settled, []);
  f.visible(true);
  f.advance(2200);
  f.select(2);
  f.advance(300);
  f.select(5);
  f.advance(500);
  assert.equal(f.scene.classList.contains('scene-ready'), false);
  f.advance(500);
  assert.deepEqual(f.settled, [0, 5]);
  assert.equal(f.pins[5].dataset.facing, 'front');
});

test('reduced motion immediately reveals the selected country without a spin', t => {
  const f = fixture(t, true);
  f.visible(true);
  assert.deepEqual(f.settled, [0]);
  f.select(6);
  assert.deepEqual(f.settled, [0, 6]);
  assert.equal(f.pins[6].dataset.facing, 'front');
  assert.ok(f.cards.every(card => !card.inert));
});
