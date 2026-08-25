-- Waitlist signups for the merava marketing site (both "For You" and
-- "For Businesses" pages). Run this once in the Supabase SQL editor for
-- the project referenced in js/supabase-client.js.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  audience text not null check (audience in ('customer', 'business')),
  created_at timestamptz not null default now()
);

-- One waitlist entry per email per audience (someone can join both the
-- customer and business waitlists with the same address).
create unique index if not exists waitlist_signups_email_audience_key
  on public.waitlist_signups (lower(email), audience);

alter table public.waitlist_signups enable row level security;

-- The site uses the public anon key, so anyone can insert a signup row —
-- but nothing lets the anon key read, update, or delete rows back out.
create policy "Anyone can join the waitlist"
  on public.waitlist_signups
  for insert
  to anon
  with check (true);
