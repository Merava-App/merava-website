-- Waitlist signups for the merava marketing site (both "For You" and
-- "For Businesses" pages). Run this in the Supabase SQL editor for the
-- project referenced in js/supabase-client.js — safe to re-run.
--
-- The table is now named "Waitlist_signups" (capital W, matching the rest
-- of the schema's PascalCase convention — Profiles, Studios, Class_info,
-- etc). Postgres folds unquoted identifiers to lowercase, so every
-- reference below is double-quoted to preserve the capital letter.
--
-- This also adds an explicit GRANT for the anon role. RLS policies and
-- base table grants are two separate layers — a passing RLS policy with
-- no underlying GRANT still gets rejected with "permission denied", before
-- RLS is even evaluated. That's what was actually blocking every waitlist
-- signup: the original version of this script only had the RLS policy.

create table if not exists public."Waitlist_signups" (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  audience text not null check (audience in ('customer', 'business')),
  created_at timestamptz not null default now()
);

-- One waitlist entry per email per audience (someone can join both the
-- customer and business waitlists with the same address).
create unique index if not exists waitlist_signups_email_audience_key
  on public."Waitlist_signups" (lower(email), audience);

alter table public."Waitlist_signups" enable row level security;

-- The site uses the public anon key, so anyone can insert a signup row —
-- but nothing lets the anon key read, update, or delete rows back out.
grant insert on public."Waitlist_signups" to anon;

drop policy if exists "Anyone can join the waitlist" on public."Waitlist_signups";
create policy "Anyone can join the waitlist"
  on public."Waitlist_signups"
  for insert
  to anon
  with check (true);
