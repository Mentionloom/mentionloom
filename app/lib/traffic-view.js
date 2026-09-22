import { fmt, pct } from './model.js';
import { icon, escape as esc, engineIcon } from './ui.js';
import { source, countryLabel, trafficBreakdown, pageBreakdown } from './traffic.js';
export const sourceMark = id => { const s = source(id); return s?.logo ? engineIcon({ id: s.logo, color: 'neutral' }) : `<span class="traffic-source-icon">${icon(s?.glyph || 'globe')}</span>`; };
export const duration = seconds => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
const ratio = (n, total) => total ? n / total * 100 : 0;
const empty = '<div class="traffic-empty">No visits</div>';
const flagEmoji = id => {
  if (!id || id === 'unknown' || !/^[A-Z]{2}$/.test(id)) return '◌';
  return String.fromCodePoint(...[...id].map(char => 127397 + char.charCodeAt(0)));
};
const trafficGlyph = (kind, label = '') => {
  const paths = {
    desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.3"/><path d="M10.5 18.5h3"/>',
    tablet: '<rect x="5" y="2.5" width="14" height="19" rx="2.3"/><circle cx="12" cy="18.4" r=".7"/>',
    browser: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 9h16.4M8 20.2 12 9l4 11.2"/>',
    system: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 8h3v3H8zm5 0h3v3h-3zM8 13h3v3H8zm5 0h3v3h-3z"/>',
    home: '<path d="m4 11 8-7 8 7v9H5v-9"/><path d="M9 20v-6h6v6"/>',
    product: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    pricing: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',
    guide: '<path d="M5 4h9l5 5v11H5Z"/><path d="M14 4v5h5M8 13h8M8 16h5"/>',
    signup: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M17 11v6m-3-3h6"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    page: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4"/>',
  };
  return `<span class="traffic-mark traffic-mark-${kind}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${paths[kind] || paths.page}</svg></span>`;
};
const deviceMark = (id, mode) => {
  if (mode === 'device') return trafficGlyph({ Desktop:'desktop', Mobile:'mobile', Tablet:'tablet' }[id] || 'desktop');
  if (mode === 'browser') return trafficGlyph('browser');
  return trafficGlyph('system');
};
const pageMark = path => {
  const kind = path === '/' ? 'home'
    : path.startsWith('/product') ? 'product'
    : path.startsWith('/pricing') ? 'pricing'
    : path.startsWith('/guides') || path.startsWith('/compare') ? 'guide'
    : path.startsWith('/signup') ? 'signup'
    : path.startsWith('/thank') ? 'success'
    : 'page';
  return trafficGlyph(kind);
};
const sourceKindLabel = kind => ({ llm:'AI engine', ide:'AI IDE', social:'Social', search:'Search', email:'Email', direct:'Direct' }[kind] || 'Source');

export function trafficList(rows, { name, mark = () => '', action, value = r => r.referrals, limit = 5 } = {}) {
  const max = Math.max(1, ...rows.map(value));
  return rows.slice(0, limit).map(r => `<button class="rank-row" ${action(r)} style="--share:${value(r) / max * 100}%">${mark(r)}<span class="rank-name">${esc(name(r))}</span><strong class="rank-value">${fmt(value(r))}</strong>${icon('right')}</button>`).join('') || empty;
}
export function usageHTML(data) {
  const c = data.current;
  return [ ['Engagement', pct(ratio(c.engaged, c.referrals))], ['Avg. visit', duration(c.seconds)], ['Pages/visit', c.referrals ? (c.pageviews / c.referrals).toFixed(1) : '0'], ['Returning', `${c.returning} / ${c.visitors}`] ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}
export function funnelHTML(data) {
  return data.funnel.map((s, i) => `<button class="traffic-funnel-step" data-funnel-stage="${s.id}"><span class="funnel-order">${i + 1}</span><span class="traffic-funnel-label">${s.name}<span class="traffic-funnel-track"><span style="width:${ratio(s.rows.length, data.rows.length)}%"></span></span></span><strong>${fmt(s.rows.length)}</strong><span class="funnel-percent">${pct(ratio(s.rows.length, data.rows.length))}</span></button>`).join('');
}
export function sourcesHTML(data, limit = 4) {
  const total = Math.max(1, data.current?.referrals || data.sources.reduce((sum, row) => sum + row.referrals, 0));
  return data.sources.slice(0, limit).map(r => {
    const item = source(r.id);
    const share = ratio(r.referrals, total);
    return `<button class="rank-row traffic-source-row" data-traffic-source="${esc(r.id)}" style="--share:${share}%">${sourceMark(r.id)}<span class="rank-name">${esc(item?.name || r.id)}<small>${esc(sourceKindLabel(item?.kind))}</small></span><span class="traffic-share">${pct(share)}</span><strong class="rank-value">${fmt(r.referrals)}</strong>${icon('right')}</button>`;
  }).join('') || empty;
}
export function sourcesTableHTML(data) {
  const total = Math.max(1, data.current?.referrals || data.rows.length);
  const rows = data.sources.map(row => {
    const item = source(row.id);
    const visits = data.rows.filter(v => v.source === row.id);
    const entries = new Map();
    visits.forEach(v => entries.set(v.page, (entries.get(v.page) || 0) + 1));
    const entry = [...entries].sort((a,b) => b[1] - a[1])[0]?.[0] || '—';
    return `<button class="source-table-row" data-traffic-source="${esc(row.id)}">
      <span class="source-table-name">${sourceMark(row.id)}<span><strong>${esc(item?.name || row.id)}</strong><small>${esc(sourceKindLabel(item?.kind))}</small></span></span>
      <span class="source-table-type">${esc(item?.kind === 'llm' ? 'AI' : sourceKindLabel(item?.kind))}</span>
      <strong class="source-table-visits">${fmt(row.referrals)}</strong>
      <span class="source-table-share">${pct(ratio(row.referrals, total))}</span>
      <span class="source-table-entry">${entry === '—' ? '' : pageMark(entry)}<span>${esc(entry)}</span></span>
      ${icon('right')}
    </button>`;
  }).join('');
  return `<div class="source-table"><div class="source-table-head"><span>Source</span><span>Type</span><span>Visits</span><span>Share</span><span>Top entry</span><span></span></div>${rows}</div>`;
}
export function locationsHTML(data, mode = 'country', limit = 5) {
  const rows = mode === 'country' ? data.countries : trafficBreakdown(data.rows, 'city');
  return trafficList(rows, {
    name: r => mode === 'country' ? countryLabel(r.id) : r.id,
    mark: r => mode === 'country'
      ? `<span class="country-flag" aria-hidden="true">${flagEmoji(r.id)}</span>`
      : trafficGlyph('globe'),
    action: r => mode === 'country' ? `data-traffic-country="${esc(r.id)}"` : `data-traffic-dimension="city" data-traffic-value="${esc(r.id)}"`,
    limit
  });
}
export function devicesHTML(data, mode = 'device', limit = 5) {
  return trafficList(trafficBreakdown(data.rows, mode), {
    name: r => r.id,
    mark: r => deviceMark(r.id, mode),
    action: r => mode === 'device' ? `data-traffic-device="${esc(r.id)}"` : `data-traffic-dimension="${mode}" data-traffic-value="${esc(r.id)}"`,
    limit
  });
}
export function pagesHTML(data, mode = 'landing', limit = 5) {
  return trafficList(pageBreakdown(data.rows, mode), {
    name: r => r.id,
    mark: r => pageMark(r.id),
    value: r => r.count,
    action: r => `data-traffic-page="${esc(r.id)}" data-page-mode="${mode}"`,
    limit
  });
}
export function journeys(data) {
  const groups = new Map();
  for (const v of data.rows) {
    const end = v.lead ? 'Lead' : v.journey.length === 1 ? 'Exit' : v.journey.at(-1), id = JSON.stringify([v.source, v.page, end]);
    const group = groups.get(id) || { id, source: v.source, page: v.page, end, rows: [] };
    group.rows.push(v); groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}
export function journeysHTML(data, limit = 5) {
  return journeys(data).slice(0, limit).map(j => `<button class="traffic-journey" data-traffic-journey="${esc(j.id)}"><span class="journey-source">${sourceMark(j.source)}${esc(source(j.source)?.name)}</span><span class="journey-path">${esc(j.page)}${icon('right')}<span>${esc(j.end)}</span></span><strong>${j.rows.length}</strong></button>`).join('') || empty;
}
export function sessionsHTML(rows) {
  return `<div class="traffic-session-list">${rows.slice(0, 30).map(v => `<div class="traffic-session"><div>${sourceMark(v.source)}<strong>${esc(source(v.source)?.name)}</strong><span>${esc(v.date)}</span>${v.lead ? '<span class="badge neutral">Lead</span>' : ''}</div><p>${esc(countryLabel(v.country))} · ${esc(v.city)} · ${esc(v.device)} · ${duration(v.seconds)}</p><div class="session-path">${v.journey.map(p => `<span>${esc(p)}</span>`).join(icon('right'))}</div></div>`).join('') || empty}</div>${rows.length > 30 ? `<p class="small-label">Latest 30 of ${fmt(rows.length)} visits</p>` : ''}`;
}
export function trafficTableHTML(data, key, label, compare = false) {
  const short = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `<table class="data-table"><thead><tr><th>Date</th><th>${esc(label)}</th>${compare ? '<th>Prior date</th><th>Value</th>' : ''}</tr></thead><tbody>${data.series.map(d => `<tr><td>${short(d.date)}</td><td>${fmt(d[key])}</td>${compare ? `<td>${short(new Date(Date.parse(d.date + 'T00:00:00Z') - data.series.length * 86400000).toISOString().slice(0, 10))}</td><td>${fmt(d.previous[key])}</td>` : ''}</tr>`).join('')}</tbody></table>`;
}
