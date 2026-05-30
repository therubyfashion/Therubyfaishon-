import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

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
  buy2GetPercentOff: 0
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<any | null>(DEFAULT_CLIENT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = query(collection(db, 'settings'), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setSettings({
            ...DEFAULT_CLIENT_SETTINGS,
            ...querySnapshot.docs[0].data()
          });
        } else {
          setSettings(DEFAULT_CLIENT_SETTINGS);
        }
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          console.warn("Firestore Quota exceeded. Using local defaults.");
        } else {
          console.error("Error fetching settings:", error);
        }
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
