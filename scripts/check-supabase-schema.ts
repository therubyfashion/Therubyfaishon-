import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sisadgjewaccylwyyvar.supabase.co';
const supabaseAnonKey = 'sb_publishable__YF1MVR1Y-893LjkuiNgQg_RYlCOfgX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const commonTables = ['profiles', 'users', 'orders', 'notifications', 'settings', 'otp_verifications', 'otp_verification', 'email_otps'];
  for (const t of commonTables) {
    const { data, error } = await supabase.from(t).select('count').limit(1);
    if (error) {
      console.log(`Table '${t}': error -> ${error.message}`);
    } else {
      console.log(`Table '${t}': EXISTS! ✅ (Data:`, data, `)`);
    }
  }
}

checkSchema();
