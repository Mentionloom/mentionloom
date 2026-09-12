import { fmt, pct } from './model.js';
import { icon, escape as esc, engineIcon } from './ui.js';
import { source, countryLabel, trafficBreakdown, pageBreakdown } from './traffic.js';
export const sourceMark = id => { const s = source(id); return s?.logo ? engineIcon({ id: s.logo, color: 'neutral' }) : `<span class="traffic-source-icon">${icon(s?.glyph || 'globe')}</span>`; };
export const duration = seconds => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
const ratio = (n, total) => total ? n / total * 100 : 0;
const empty = '<div class="traffic-empty">No visits</div>';
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
export function sourcesHTML(data, limit = 5) {
  return trafficList(data.sources, { name: r => source(r.id)?.name || r.id, mark: r => sourceMark(r.id), action: r => `data-traffic-source="${esc(r.id)}"`, limit });
}
export function locationsHTML(data, mode = 'country', limit = 5) {
  const rows = mode === 'country' ? data.countries : trafficBreakdown(data.rows, 'city');
  return trafficList(rows, { name: r => mode === 'country' ? countryLabel(r.id) : r.id, mark: r => mode === 'country' ? `<span class="country-code">${r.id === 'unknown' ? '—' : r.id}</span>` : '', action: r => mode === 'country' ? `data-traffic-country="${esc(r.id)}"` : `data-traffic-dimension="city" data-traffic-value="${esc(r.id)}"`, limit });
}
export function devicesHTML(data, mode = 'device', limit = 5) {
  return trafficList(trafficBreakdown(data.rows, mode), { name: r => r.id, action: r => mode === 'device' ? `data-traffic-device="${esc(r.id)}"` : `data-traffic-dimension="${mode}" data-traffic-value="${esc(r.id)}"`, limit });
}
export function pagesHTML(data, mode = 'landing', limit = 5) {
  return trafficList(pageBreakdown(data.rows, mode), { name: r => r.id, mark: () => icon('file'), value: r => r.count, action: r => `data-traffic-page="${esc(r.id)}" data-page-mode="${mode}"`, limit });
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
