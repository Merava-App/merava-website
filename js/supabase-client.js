// Values come from js/config.js, generated from .env by `npm run build` /
// scripts/generate-config.js and committed — GitHub Pages serves this repo
// with no build step, so the generated file has to be checked in for the
// site to work. It only holds the public anon key; see generate-config.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
