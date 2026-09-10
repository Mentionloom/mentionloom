import { list, get } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
const rows = []; let cursor;
do {
  const page = await list({ prefix: 'subscribers/', limit: 100, cursor });
  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: 'private', useCache: false });
    if (result) rows.push(await new Response(result.stream).json());
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
rows.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
const columns = ['email','joined_at','stage','website','role','goal','cta_source','utm_source','utm_medium','utm_campaign','ref','referrer','email_verified','consent_at'];
// Neutralize formula prefixes before writing spreadsheet-compatible CSV.
const cell = value => { let str = String(value ?? ''); if (/^[\s]*[=+@-]/.test(str)) str = "'" + str; return '"' + str.replaceAll('"', '""') + '"'; };
const data = rows.map(r => [r.email,r.createdAt,r.stage,r.profile?.website,r.profile?.role,r.profile?.goal,r.source,r.attribution?.utm_source,r.attribution?.utm_medium,r.attribution?.utm_campaign,r.attribution?.ref,r.attribution?.referrer,r.emailVerified,r.consent?.at]);
await mkdir('exports', { recursive: true });
const filename = `exports/waitlist-${new Date().toISOString().replaceAll(':','-')}.csv`;
await writeFile(filename, [columns,...data].map(row => row.map(cell).join(',')).join('\r\n'), { mode: 0o600 });
const qualified = rows.filter(r => r.stage === 'qualified').length;
const bySource = Object.fromEntries([...new Set(rows.map(r => r.source))].map(source => [source, rows.filter(r => r.source === source).length]));
console.log(JSON.stringify({ file: filename, joined: rows.length, qualified, qualificationRate: rows.length ? `${Math.round(qualified/rows.length*100)}%` : '0%', bySource }, null, 2));
