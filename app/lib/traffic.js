import { END, DAY, ENGINES, visits } from './data.js';

export const TRAFFIC_SOURCES = [
  ...ENGINES.map(e => ({ id: e.id, name: e.name, kind: 'llm', logo: e.id })),
  { id: 'cursor', name: 'Cursor', kind: 'ide', glyph: 'code' },
  { id: 'copilot', name: 'GitHub Copilot', kind: 'ide', glyph: 'code' },
  { id: 'x', name: 'X', kind: 'social', glyph: 'chat' },
  { id: 'linkedin', name: 'LinkedIn', kind: 'social', glyph: 'people' },
  { id: 'search', name: 'Google Search', kind: 'search', logo: 'google' },
  { id: 'email', name: 'Newsletter', kind: 'email', glyph: 'mail' },
  { id: 'direct', name: 'Direct', kind: 'direct', glyph: 'globe' },
];
export const SOURCE_GROUPS = { llm: 'LLMs', ide: 'IDEs', social: 'Social' };
export const COUNTRIES = [
  { id: 'US', name: 'United States', cities: ['New York', 'San Francisco', 'Austin'] },
  { id: 'GB', name: 'United Kingdom', cities: ['London', 'Bristol'] },
  { id: 'DE', name: 'Germany', cities: ['Berlin', 'Munich'] },
  { id: 'GR', name: 'Greece', cities: ['Athens', 'Thessaloniki'] },
  { id: 'CA', name: 'Canada', cities: ['Toronto', 'Vancouver'] },
  { id: 'BR', name: 'Brazil', cities: ['São Paulo', 'Rio de Janeiro'] },
  { id: 'IN', name: 'India', cities: ['Bengaluru', 'Mumbai'] },
  { id: 'NL', name: 'Netherlands', cities: ['Amsterdam', 'Rotterdam'] },
  { id: 'unknown', name: 'Unknown', cities: ['Unknown'] },
];
export const DEVICES = ['Desktop', 'Mobile', 'Tablet'];
export const TRAFFIC_METRICS = { referrals: 'Visits', visitors: 'Visitors', pageviews: 'Page views', leads: 'Leads' };
export const MILESTONES = [
  { id: 'community-post', date: '2026-08-29', label: 'Shared on X', source: 'x', title: 'Community post', post: 'A small team does not need a complicated project tool. We have been trying Acme for tasks, docs and client feedback. Here is our setup.', campaign: 'community-post' },
  { id: 'product-email', date: '2026-09-04', label: 'Product email', source: 'email', title: 'Product update', post: 'Less setup, more project work. Explore the new Acme templates for small creative teams.', campaign: 'product-email' },
];
export const source = id => TRAFFIC_SOURCES.find(s => s.id === id);
export const sourceLabel = id => SOURCE_GROUPS[id] || source(id)?.name || 'All sources';
export const countryLabel = id => COUNTRIES.find(c => c.id === id)?.name || 'All countries';
const hash = value => { let n = 2166136261; for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const dayString = time => new Date(time).toISOString().slice(0, 10);
const raw = visits.map(v => ({ ...v, source: v.engine, campaign: '' }));
// Illustrative website sessions, separate from the scheduled answer samples.
for (let day = 0; day < 180; day++) {
  const date = dayString(Date.parse(END + 'T00:00:00Z') - (179 - day) * DAY);
  const extras = [0, 1, 0, 2, 1, 3, 0, 0, 2, 0, 1, 0, 2, 0, 1][day % 15];
  for (let i = 0; i < extras; i++) {
    const id = `web-${date}-${i}`, n = hash(id);
    const origin = ['direct', 'search', 'direct', 'cursor', 'copilot', 'linkedin', 'search'][n % 7];
    const engaged = n % 10 < 6;
    raw.push({ id, date, source: origin, page: ['/', '/product', '/pricing', '/guides/migrate'][n % 4], engaged, lead: engaged && n % 31 === 0, method: ['cursor', 'copilot'].includes(origin) ? 'UTM source' : origin === 'direct' ? 'No referrer' : 'Referrer', campaign: '' });
  }
}
for (const event of MILESTONES) {
  for (let i = 0; i < (event.source === 'x' ? 18 : 8); i++) {
    raw.push({ id: `${event.id}-${i}`, date: dayString(Date.parse(event.date + 'T00:00:00Z') + (i % 5 === 4 ? DAY : 0)), source: event.source, page: '/product', engaged: i % 3 !== 0, lead: i === 5, method: 'UTM source', campaign: event.campaign });
  }
}
raw.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
const seen = [];
export const trafficVisits = raw.map((v, i) => {
  const n = hash(v.id), visitor = n % 5 === 0 && seen.length ? seen[n % seen.length] : `visitor-${v.id}`;
  const profile = hash(visitor), country = COUNTRIES[[0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 8][profile % 12]];
  const device = DEVICES[profile % 10 < 6 ? 0 : profile % 10 < 9 ? 1 : 2];
  const os = device === 'Desktop' ? ['macOS', 'Windows', 'Linux'][profile % 3] : profile % 2 ? 'iOS' : 'Android';
  const browsers = { iOS: ['Safari', 'Chrome'], Android: ['Chrome', 'Firefox'], macOS: ['Safari', 'Chrome', 'Firefox'], Windows: ['Chrome', 'Edge', 'Firefox'], Linux: ['Chrome', 'Firefox'] }[os];
  const browser = browsers[profile % browsers.length];
  const returning = seen.includes(visitor);
  seen.push(visitor);
  const journey = [v.page];
  if (v.engaged && n % 3 !== 0 && v.page !== '/product') journey.push('/product');
  if (v.engaged && (n % 4 === 0 || v.lead)) {
    if (journey.at(-1) !== '/pricing') journey.push('/pricing');
    if (n % 3 === 0 || v.lead) journey.push('/signup');
  }
  if (v.lead) journey.push('/thank-you');
  return { ...v, visitor, country: country.id, city: country.cities[profile % country.cities.length], device, os, browser, returning, journey, seconds: v.engaged ? 45 + n % 240 : 3 + n % 18 };
});
export function parseTrafficState(search) {
  const params = new URLSearchParams(search), candidate = params.get('source') ?? params.get('engine') ?? '';
  return {
    source: source(candidate) || SOURCE_GROUPS[candidate] ? candidate : '',
    country: COUNTRIES.some(c => c.id === params.get('country')) ? params.get('country') : '',
    device: DEVICES.includes(params.get('device')) ? params.get('device') : '',
  };
}
export function trafficMetrics(rows) {
  return {
    referrals: rows.length,
    visitors: new Set(rows.map(v => v.visitor)).size,
    visitorIds: [...new Set(rows.map(v => v.visitor))],
    pageviews: rows.reduce((n, v) => n + v.journey.length, 0),
    leads: rows.filter(v => v.lead).length,
    engaged: rows.filter(v => v.engaged).length,
    seconds: rows.length ? Math.round(rows.reduce((n, v) => n + v.seconds, 0) / rows.length) : 0,
    returning: new Set(rows.filter(v => v.returning).map(v => v.visitor)).size,
  };
}
export function trafficBreakdown(rows, key) {
  const map = new Map();
  for (const row of rows) { const id = row[key]; const group = map.get(id) || []; group.push(row); map.set(id, group); }
  return [...map].map(([id, visits]) => ({ id, ...trafficMetrics(visits) })).sort((a, b) => b.referrals - a.referrals || String(a.id).localeCompare(String(b.id)));
}
export function funnelRows(rows) {
  const engaged = rows.filter(v => v.engaged),
    pricing = engaged.filter(v => v.journey.includes('/pricing')),
    signup = pricing.filter(v => v.journey.indexOf('/signup') > v.journey.indexOf('/pricing'));
  return [
    { id: 'visits', name: 'Visits', rows },
    { id: 'engaged', name: 'Engaged', rows: engaged },
    { id: 'pricing', name: 'Pricing', rows: pricing },
    { id: 'signup', name: 'Signup', rows: signup },
    { id: 'leads', name: 'Leads', rows: signup.filter(v => v.lead) },
  ];
}
export function pageBreakdown(rows, mode = 'landing') {
  const counts = new Map();
  for (const v of rows) {
    const pages = mode === 'all' ? v.journey : [mode === 'exit' ? v.journey.at(-1) : v.page];
    for (const path of pages) {
      const p = counts.get(path) || { id: path, count: 0, visitors: new Set(), sources: new Set() };
      p.count++; p.visitors.add(v.visitor); p.sources.add(v.source); counts.set(path, p);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}
export function selectTraffic(state, records = trafficVisits) {
  const end = Date.parse(END + 'T00:00:00Z'), start = end - (state.days - 1) * DAY;
  const scope = records.filter(v => (!state.country || v.country === state.country) && (!state.device || v.device === state.device) && (!state.source || v.source === state.source || source(v.source)?.kind === state.source));
  const rows = scope.filter(v => v.date >= dayString(start) && v.date <= END),
    prior = scope.filter(v => v.date >= dayString(start - state.days * DAY) && v.date < dayString(start));
  const series = Array.from({ length: state.days }, (_, i) => {
    const date = dayString(start + i * DAY), priorDate = dayString(start + (i - state.days) * DAY);
    return { date, ...trafficMetrics(rows.filter(v => v.date === date)), previous: trafficMetrics(prior.filter(v => v.date === priorDate)) };
  });
  return { rows, prior, series, current: trafficMetrics(rows), previous: trafficMetrics(prior), start: dayString(start), end: END,
    sources: trafficBreakdown(rows, 'source'), countries: trafficBreakdown(rows, 'country'), devices: trafficBreakdown(rows, 'device'),
    milestones: MILESTONES.filter(e => e.date >= dayString(start) && e.date <= END && rows.some(v => v.campaign === e.campaign)),
    funnel: funnelRows(rows) };
}
