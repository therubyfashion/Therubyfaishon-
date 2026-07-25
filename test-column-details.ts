import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sisadgjewaccylwyyvar.supabase.co';
const supabaseAnonKey = 'sb_publishable__YF1MVR1Y-893LjkuiNgQg_RYlCOfgX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  if (!res.ok) {
    console.error("OpenAPI fetch failed:", res.status, res.statusText);
    return;
  }
  const schema = await res.json();
  const addressDefinition = schema.definitions?.addresses;
  const reviewDefinition = schema.definitions?.reviews;
  
  if (addressDefinition) {
    console.log("Addresses Properties:", JSON.stringify(addressDefinition.properties, null, 2));
  } else {
    console.log("No definitions for addresses found in OpenAPI schema.");
  }

  if (reviewDefinition) {
    console.log("Reviews Properties:", JSON.stringify(reviewDefinition.properties, null, 2));
  } else {
    console.log("No definitions for reviews found in OpenAPI schema.");
  }
}

test();
