import test from 'node:test';
import assert from 'node:assert/strict';
import { trafficVisits, selectTraffic, trafficMetrics, pageBreakdown, parseTrafficState, MILESTONES, source, funnelRows, trafficBreakdown } from '../app/lib/traffic.js';
import { pageURL } from '../app/lib/navigation.js';
const base = { days: 30, source: '', country: '', device: '' };
test('website traffic retains the original AI sessions and adds IDE and other website origins', () => {
  const data = selectTraffic(base), ai = selectTraffic({ ...base, source: 'llm' }), ide = selectTraffic({ ...base, source: 'ide' });
  assert.equal(ai.current.referrals, 54);
  assert.ok(ide.current.referrals > 0);
  assert.ok(data.current.referrals > 54 && data.current.referrals < 200);
  assert.ok(data.series.some(d => d.referrals === 0));
  assert.ok(data.sources.some(s => s.id === 'x'));
  assert.ok(data.rows.every(v => source(v.source)));
});
test('country, device and source filters compose through the current and prior period', () => {
  const example = selectTraffic(base).rows.find(v => v.source === 'chatgpt');
  const data = selectTraffic({ ...base, source: 'llm', country: example.country, device: example.device });
  for (const v of [...data.rows, ...data.prior]) {
    assert.equal(v.country, example.country); assert.equal(v.device, example.device); assert.equal(source(v.source).kind, 'llm');
  }
  assert.equal(data.current.referrals, data.rows.length);
  assert.equal(data.current.leads, data.rows.filter(v => v.lead).length);
});
test('page views, source and location totals reconcile; unique visitors are deduplicated', () => {
  for (const days of [7, 30, 90]) {
    const d = selectTraffic({ ...base, days });
    for (const key of ['referrals', 'pageviews', 'leads']) assert.equal(d.series.reduce((n,v)=>n+v[key],0),d.current[key]);
    for (const key of ['sources','countries','devices']) assert.equal(d[key].reduce((n,v)=>n+v.referrals,0),d.current.referrals);
    assert.equal(pageBreakdown(d.rows,'all').reduce((n,p)=>n+p.count,0),d.current.pageviews);
    assert.equal(pageBreakdown(d.rows,'landing').reduce((n,p)=>n+p.count,0),d.current.referrals);
    assert.equal(pageBreakdown(d.rows,'exit').reduce((n,p)=>n+p.count,0),d.current.referrals);
    assert.equal(d.current.visitors,new Set(d.rows.map(v=>v.visitor)).size);
  }
});
test('funnel stages are nested and every lead has an ordered pricing-to-signup path', () => {
  const funnel = funnelRows(trafficVisits);
  for(let i=1;i<funnel.length;i++) assert.ok(funnel[i].rows.every(v=>funnel[i-1].rows.includes(v)));
  assert.equal(funnel.at(-1).rows.length,trafficVisits.filter(v=>v.lead).length);
  assert.ok(trafficVisits.filter(v=>v.lead).every(v=>v.journey.indexOf('/signup')>v.journey.indexOf('/pricing')));
});
test('milestones only appear with matching campaign visits and filters', () => {
  const all = selectTraffic(base);
  assert.equal(all.milestones.length, 2);
  assert.equal(selectTraffic({...base,source:'ide'}).milestones.length,0);
  for(const e of MILESTONES) assert.ok(all.rows.some(v=>v.campaign===e.campaign && v.source===e.source));
});
test('empty filters are zero-safe and traffic URLs preserve their own scope', () => {
  const empty=selectTraffic({...base,source:'grok'});
  assert.equal(empty.current.referrals,0); assert.equal(empty.current.seconds,0); assert.equal(empty.milestones.length,0);
  assert.equal(trafficMetrics([]).visitors,0);
  const state={...base,days:90,source:'ide',country:'DE',device:'Desktop',metric:'pageviews'};
  const url=new URL(pageURL('traffic',state),'https://example.test');
  assert.deepEqual(parseTrafficState(url.search),{source:'ide',country:'DE',device:'Desktop'});
  assert.equal(url.searchParams.get('metric'),'pageviews');
  assert.ok(!pageURL('traffic', { ...base, engine: 'chatgpt', source: '' }).includes('source='));
  assert.deepEqual(parseTrafficState('?country=bogus&source=bogus&device=bogus'),{source:'',country:'',device:''});
});

test('every lower traffic breakdown uses the same combined filter scope, including empty results', () => {
  for (const state of [
    { ...base, source: 'llm', country: 'US', device: 'Desktop' },
    { ...base, days: 7, source: 'direct', country: 'GB' },
    { ...base, days: 90, source: 'ide', device: 'Mobile' },
    { ...base, source: 'grok' },
  ]) {
    const data = selectTraffic(state);
    for (const key of ['sources', 'countries', 'devices']) {
      assert.equal(data[key].reduce((sum, row) => sum + row.referrals, 0), data.current.referrals, key);
    }
    for (const key of ['city', 'browser', 'os', 'campaign']) {
      assert.equal(trafficBreakdown(data.rows, key).reduce((sum, row) => sum + row.referrals, 0), data.current.referrals, key);
    }
    for (const mode of ['landing', 'exit', 'all']) {
      assert.equal(pageBreakdown(data.rows, mode).reduce((sum, row) => sum + row.count, 0), mode === 'all' ? data.current.pageviews : data.current.referrals, mode);
    }
    assert.equal(data.funnel[0].rows.length, data.current.referrals);
    assert.equal(data.funnel.at(-1).rows.length, data.current.leads);
    assert.ok(data.funnel.every(stage => stage.rows.every(row => data.rows.includes(row))));
    assert.ok(data.milestones.every(event => data.rows.some(row => row.campaign === event.campaign)));
    assert.equal(data.series.reduce((sum, day) => sum + day.referrals, 0), data.current.referrals);
    assert.equal(data.series.reduce((sum, day) => sum + day.previous.referrals, 0), data.previous.referrals);
  }
});
