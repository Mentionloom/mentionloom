revoke all privileges on table public.waitlist_signups from anon, authenticated;
revoke all privileges on table public.waitlist_rate_limits from anon, authenticated;
grant all privileges on table public.waitlist_signups to service_role;
grant all privileges on table public.waitlist_rate_limits to service_role;
