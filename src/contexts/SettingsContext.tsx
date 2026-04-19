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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = query(collection(db, 'settings'), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setSettings(querySnapshot.docs[0].data());
        }
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          console.warn("Firestore Quota exceeded. Using local defaults.");
        } else {
          console.error("Error fetching settings:", error);
        }
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
