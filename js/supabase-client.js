// Same Supabase project as the mobile app (see green-startup/.env). The
// publishable/anon key is meant to be public — it's already embedded in the
// app bundle — access is enforced by RLS policies, not by hiding this key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ckyvveuqnamezqzcqobr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ht9N0WTK5TOG65VbxPC-Bg_lUR6DHsn';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
