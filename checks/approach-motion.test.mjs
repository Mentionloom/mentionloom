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
  const node = () => ({ style: {}, dataset: {}, setAttribute(name, value) { this[name] = value; } });
  const company = Array.from({ length: 5 }, node);
  const questions = Array.from({ length: 3 }, (_, index) => ({ ...node(), offsetTop: index * 61 }));
  const checks = Array.from({ length: 3 }, node);
  const ranks = Array.from({ length: 2 }, node);
  const fills = Array.from({ length: 2 }, node);
  const questionViewport = node();
  const progress = node();
  const lists = { '.company-intel-row': company, '.generated-question': questions, '.question-check': checks, '.mini-rank-row': ranks, '.mini-rank-fill': fills };
  const steps = ['company', 'questions', 'action'].map(kind => ({
    classList: { contains: name => name === `clearer-step-${kind}` },
    querySelectorAll: selector => lists[selector] || [],
    querySelector: selector => selector === '.generated-questions' ? questionViewport : selector === '.company-progress' ? progress : selector === '.mini-rank-list' ? null : node(),
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
  return { animations, timers, company, checks, progress, questionViewport, play, advance, reduced, document };
}

test('profile completion advances by row while question viewport enters without displacing its list', () => {
  const f = fixture();
  f.play();
  assert.ok(f.company.every(row => row.dataset.state === 'pending'));
  assert.equal(f.progress['aria-valuenow'], '0');
  f.advance(400);
  assert.equal(f.company[0].dataset.state, 'loading');
  f.advance(1150);
  assert.equal(f.company[0].dataset.state, 'complete');
  f.advance(3699);
  assert.equal(f.company[3].dataset.state, 'loading');
  f.advance(3700);
  assert.equal(f.company[3].dataset.state, 'complete');
  f.advance(4550);
  assert.ok(f.company.every(row => row.dataset.state === 'complete'));
  assert.equal(f.progress['aria-valuenow'], '100');
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
    assert.equal(f.progress['aria-valuenow'], '100');
    assert.equal(f.timers.size, 0);
  }
});

test('Acme climbs one rank at a time from fourth place before settling at number one', () => {
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const rows = [
    ['Acme', 3, 45.4, 72.8, true],
    ['Asana', 0, 65.4, 63.1, false],
    ['Notion', 1, 58.2, 55.8, false],
    ['ClickUp', 2, 51.7, 48.6, false],
    ['Monday', 4, 39.4, 42.8, false],
  ].map(([name, startPosition, startShare, targetShare, self], index) => {
    const fill = { style: {} };
    const value = { textContent: `${targetShare}%` };
    const rank = { textContent: '#1' };
    return {
      name,
      dataset: { startPosition: String(startPosition), startShare: String(startShare), targetShare: String(targetShare) },
      offsetTop: index * 50,
      style: {},
      classList: { contains: name => name === 'self' && self },
      querySelector: selector => selector === '.mini-rank-fill' ? fill : selector === '.mini-rank-value' ? value : selector === '.rank-leader' ? rank : null,
      fill,
      value,
      rank,
    };
  });
  const list = {
    dataset: {},
    querySelectorAll: selector => selector === '.mini-rank-row' ? rows : [],
  };
  const step = { querySelector: selector => selector === '.mini-rank-list' ? list : null };
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const context = {
    APPROACH_SCORE: { start: 400, beat: 850, work: 750, settle: 280 },
    reduced,
    document,
    paused: false,
    window: { OrbitMotion: {} },
    storyAnimate() {},
    number: (el, value) => { el.textContent = value; },
    setTimeout: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  };
  runInNewContext(score + '\nthis.playRanking = playOpportunityRanking;', context);
  const advance = duration => {
    const until = now + duration;
    while (true) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }
    now = until;
  };

  context.playRanking(step);
  const acme = rows[0];
  assert.equal(acme.rank.textContent, '#4');
  advance(4550);
  assert.equal(acme.style.transform, 'translateY(100px)', 'the first pass moves Acme into third');
  advance(750);
  assert.equal(acme.rank.textContent, '#3');
  advance(280);
  assert.equal(acme.style.transform, 'translateY(50px)', 'the second pass moves Acme into second');
  advance(750);
  assert.equal(acme.rank.textContent, '#2');
  advance(280);
  assert.equal(acme.style.transform, 'translateY(0px)', 'the final pass moves Acme into first');
  advance(750);
  assert.equal(acme.rank.textContent, '#1');
  advance(280);
  assert.equal(list.dataset.motionStarted, 'false');
  assert.equal(acme.value.textContent, '72.8%');
  assert.equal(rows[4].name, 'Monday', 'the added competitor remains in the lower ranking');
});
