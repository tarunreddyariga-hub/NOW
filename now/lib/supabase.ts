import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// null when Supabase is not configured; the app then runs without accounts.
export const supabase = url && key ? createClient(url, key) : null;
