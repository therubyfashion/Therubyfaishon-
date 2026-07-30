import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../supabase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility to sync data to Google Sheets
export const syncToGoogleSheets = async (orderData: any) => {
  let scriptUrl = '';
  let apiKey = '';
  
  // 1. Try to fetch from Supabase settings FIRST
  try {
    const { data: setts } = await supabase.from('settings').select('*').limit(1);
    if (setts && setts.length > 0) {
      scriptUrl = (setts[0].google_sheet_url || setts[0].googleSheetUrl || '').trim();
      apiKey = setts[0].google_sheet_api_key || setts[0].googleSheetApiKey || '';
    }
  } catch (e) {
    console.warn('Failed to fetch Google Sheet settings from Supabase:', e);
  }

  // 2. Fallback to env var if Firestore is empty
  if (!scriptUrl) {
    scriptUrl = ((import.meta as any).env.VITE_GOOGLE_SHEET_SCRIPT_URL || '').trim();
  }
  
  if (!scriptUrl) {
    console.warn('Google Sheet Script URL is missing. Please set it in Admin Settings.');
    return;
  }

  // If only the Deployment ID is provided, construct the full URL
  if (scriptUrl && !scriptUrl.startsWith('http')) {
    scriptUrl = `https://script.google.com/macros/s/${scriptUrl}/exec`;
  }

  try {
    // Using a simpler fetch approach for Google Apps Script to avoid CORS preflight issues
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', // Crucial for Google Apps Script
      cache: 'no-cache',
      redirect: 'follow',
      body: JSON.stringify({
        apiKey: apiKey,
        orderId: orderData.orderId,
        customerName: orderData.address?.name || 'Guest',
        email: orderData.address?.email || 'N/A',
        phone: orderData.address?.number || 'N/A',
        address: orderData.address?.address || 'N/A',
        landmark: orderData.address?.landmark || 'N/A',
        city: orderData.address?.city || 'N/A',
        state: orderData.address?.state || 'N/A',
        pincode: orderData.address?.pincode || 'N/A',
        total: orderData.total,
        paymentMethod: orderData.paymentMethod || 'N/A',
        shippingMethod: orderData.shippingMethod || 'N/A',
        status: orderData.status || 'Confirmed',
        items: orderData.items?.map((item: any) => `${item.name} (x${item.quantity})`).join(', '),
        createdAt: orderData.createdAt || new Date().toISOString()
      }),
    });
    console.log('Sheets Sync: Request sent to', scriptUrl);
  } catch (error) {
    console.error("Sheets Sync Network Error:", error);
    // If it fails, it might be a malformed URL
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error("Check if the Google Script URL is correct and deployed as 'Anyone'. URL:", scriptUrl);
    }
  }
};
