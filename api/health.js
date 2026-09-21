import { isDatabaseConfigured } from '../lib/supabase.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  return res.status(200).json({
    ok: true,
    databaseConfigured: isDatabaseConfigured(),
    workerConfigured: Boolean(process.env.CRON_SECRET),
  });
}
