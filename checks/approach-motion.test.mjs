import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../site.js', import.meta.url), 'utf8');
const score = source.slice(source.indexOf('const APPROACH_SCORE'), source.indexOf('// Product structures stay rendered'));

function fixture(reduce = false) {
  const animations = [];
  const timers = new Map();
  let timerId = 0;
  const node = () => ({ style: {}, dataset: {} });
  const company = Array.from({ length: 4 }, node);
  const questions = Array.from({ length: 3 }, (_, index) => ({ ...node(), offsetTop: index * 61 }));
  const checks = Array.from({ length: 3 }, node);
  const ranks = Array.from({ length: 2 }, node);
  const fills = Array.from({ length: 2 }, node);
  const questionViewport = node();
  const brief = node();
  const lists = { '.company-intel-row': company, '.generated-question': questions, '.question-check': checks, '.mini-rank-row': ranks, '.mini-rank-fill': fills };
  const steps = ['company', 'questions', 'action'].map(kind => ({
    classList: { contains: name => name === `clearer-step-${kind}` },
    querySelectorAll: selector => lists[selector] || [],
    querySelector: selector => selector === '.generated-questions' ? questionViewport : selector === '.brief-build > strong' ? brief : node(),
  }));
  const reduced = Object.assign(new EventTarget(), { matches: reduce });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const context = {
    reduced, document, paused: false, window: { OrbitMotion: {} },
    approachMotionPlayed: new WeakSet(), motionEnter() {},
    storyAnimate: (el, frames, duration, options) => animations.push({ el, frames, duration, ...options }),
    setTimeout: (cb, at) => { timers.set(++timerId, { cb, at }); return timerId; },
    clearTimeout: id => timers.delete(id),
  };
  runInNewContext(score + '\nthis.play = playApproachCardMotion;', context);
  const play = () => steps.forEach(context.play);
  const advance = time => {
    for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= time && timers.has(id)) { timers.delete(id); timer.cb(); }
    }
  };
  return { animations, timers, company, checks, brief, questionViewport, play, advance, reduced, document };
}

test('onboarding shares an opening beat while company and action finish together', () => {
  const f = fixture();
  f.play();
  assert.ok(f.company.every(row => row.dataset.state === 'pending'));
  f.advance(400);
  assert.equal(f.company[0].dataset.state, 'loading');
  f.advance(3699);
  assert.equal(f.company[3].dataset.state, 'loading');
  f.advance(3700);
  assert.ok(f.company.every(row => row.dataset.state === 'complete'));
  for (const el of [f.brief]) {
    const animation = f.animations.find(item => item.el === el);
    assert.equal(animation.delay, 3700);
    assert.equal(animation.duration, 280);
    assert.equal(animation.easing, 'ease-out');
  }
  const questions = f.animations.find(item => item.el === f.questionViewport);
  assert.equal(questions.delay, 400);
  assert.equal(questions.duration, 280);
  assert.ok(questions.frames.every(frame => !('transform' in frame)), 'reveal must not override the scrolling track');
  const count = f.animations.length;
  f.play();
  assert.equal(f.animations.length, count, 'observer callbacks must not replay the score');
});

test('reduced motion skips the score and interruption completes company rows', () => {
  const reduced = fixture(true);
  reduced.play();
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.timers.size, 0);
  for (const kind of ['reduced', 'document']) {
    const f = fixture();
    f.play();
    f.advance(400);
    if (kind === 'reduced') { f.reduced.matches = true; f.reduced.dispatchEvent(new Event('change')); }
    else { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
    assert.ok(f.company.every(row => row.dataset.state === 'complete'));
    assert.equal(f.timers.size, 0);
  }
});
