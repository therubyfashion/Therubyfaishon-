/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sisadgjewaccylwyyvar.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__YF1MVR1Y-893LjkuiNgQg_RYlCOfgX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
