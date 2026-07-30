import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface SettingsContextType {
  settings: any | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
});

const DEFAULT_CLIENT_SETTINGS = {
  storeName: 'The Ruby Fashion',
  storeLogo: '',
  fromEmail: 'support@therubyfashion.shop',
  resendApiKey: '',
  smtpUser: '',
  smtpPass: '',
  oneSignalAppId: String((import.meta as any).env.VITE_ONESIGNAL_APP_ID || '').trim(),
  oneSignalRestApiKey: '',
  razorpayKeyId: String((import.meta as any).env.VITE_RAZORPAY_KEY_ID || '').trim(),
  razorpayKeySecret: '',
  otpMonthlyLimit: 9999,
  buy2Get1Free: false,
  buy2GetPercentEnabled: false,
  buy2GetPercentOff: 0,
  ogTitle: '',
  ogDescription: '',
  ogImage: ''
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<any | null>(DEFAULT_CLIENT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('settings').select('*').limit(1);
        if (data && data.length > 0) {
          setSettings({
            ...DEFAULT_CLIENT_SETTINGS,
            ...data[0]
          });
        } else {
          setSettings(DEFAULT_CLIENT_SETTINGS);
        }
      } catch (error: any) {
        console.error("Error fetching settings from Supabase:", error);
        setSettings(DEFAULT_CLIENT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
