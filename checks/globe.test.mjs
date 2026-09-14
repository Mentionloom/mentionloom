import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_LOCATIONS, locationVector, projectVector } from '../marketing/globe-coordinates.js';

test('country pins return to the same geographic point after a full turn', () => {
  for (const location of COUNTRY_LOCATIONS) {
    const v = locationVector(location);
    const a = projectVector(v, 2.3);
    const b = projectVector(v, 2.3 + Math.PI * 2);
    assert.ok(Math.abs(a.x - b.x) < 1e-12);
    assert.ok(Math.abs(a.y - b.y) < 1e-12);
    assert.equal(a.visible, b.visible);
    const moved = projectVector(v, 2.6);
    assert.ok(Math.hypot(a.x - moved.x, a.y - moved.y) > .01);
  }
});

test('front country becomes hidden after half a turn', () => {
  const v = locationVector([0, -90]);
  assert.deepEqual(projectVector(v, 0, 0), {x:.5, y:.5, depth:1, visible:true});
  assert.equal(projectVector(v, Math.PI, 0).visible, false);
});

test('projection matches Cobe’s 80-percent diameter and viewport scaling', () => {
  const edge = projectVector(locationVector([0, 0]), 0, 0);
  assert.equal(edge.x, .9);
  assert.equal(edge.y, .5);
  const pole = projectVector(locationVector([90, 0]), 0, 0);
  assert.ok(Math.abs(pole.y - .1) < 1e-12);
  for (const width of [310, 520, 590]) {
    assert.ok(Math.abs(edge.x * width - width/2 - width*.4) < 1e-10);
  }
});
