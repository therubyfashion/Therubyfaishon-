import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ChatWidget from './components/ChatWidget';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence } from 'framer-motion';
import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';

import { useVisitorTracking } from './hooks/useVisitorTracking';
import { trackPixelEvent } from './lib/pixel';

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home'));
const Shop = React.lazy(() => import('./pages/Shop'));
const ProductDetail = React.lazy(() => import('./pages/ProductDetail'));
const Cart = React.lazy(() => import('./pages/Cart'));
const Wishlist = React.lazy(() => import('./pages/Wishlist'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const About = React.lazy(() => import('./pages/About'));
const Contact = React.lazy(() => import('./pages/Contact'));
const MyOrders = React.lazy(() => import('./pages/MyOrders'));
const OrderSuccess = React.lazy(() => import('./pages/OrderSuccess'));
const TrackOrder = React.lazy(() => import('./pages/TrackOrder'));
const Notifications = React.lazy(() => import('./pages/Notifications'));
import AdminDashboard from './pages/AdminDashboard';
const Search = React.lazy(() => import('./pages/Search'));
import Profile from './pages/Profile';
const Settings = React.lazy(() => import('./pages/Settings'));
const Addresses = React.lazy(() => import('./pages/Addresses'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));
const VerifyPrompt = React.lazy(() => import('./pages/VerifyPrompt'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));
const FAQ = React.lazy(() => import('./pages/FAQ'));

const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  return isAdmin ? <>{children}</> : <Navigate to="/" />;
};

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <WishlistProvider>
              <Router>
                <AppContent />
              </Router>
            </WishlistProvider>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

let isOneSignalWebInitialized = false;

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');
  const [showSplash, setShowSplash] = useState(true);
  
  // Track live visitors
  useVisitorTracking();

  // Meta Pixel Route Tracking
  useEffect(() => {
    trackPixelEvent('PageView');
  }, [location.pathname]);

  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  // Handle unverified email redirect
  useEffect(() => {
    if (authLoading) return;
    
    const publicPaths = ['/login', '/signup', '/verify-prompt', '/verify-email', '/about', '/contact', '/faq', '/checkout', '/cart', '/track', '/order-success'];
    // Home ('/') is NOT public for logged-in but unverified users
    const isPublicPath = publicPaths.includes(location.pathname) || location.pathname.startsWith('/product/') || location.pathname.startsWith('/track/');
    
    if (user && profile && !profile.isVerified && !isPublicPath) {
      navigate(`/verify-prompt?email=${encodeURIComponent(user.email || '')}&uid=${user.uid}`);
    }
  }, [user, profile, location.pathname, authLoading, navigate]);

  // Initialize OneSignal
  useEffect(() => {
    if (settingsLoading) return;
    
    const initOneSignal = async () => {
      try {
        let appId = ((import.meta as any).env.VITE_ONESIGNAL_APP_ID || '').trim();
        const settingsAppId = (settings?.oneSignalAppId || '').trim();
        
        const isPlaceholder = (id: string) => !id || id === 'dummy-id' || id === 'YOUR_ONESIGNAL_APP_ID' || id.length < 10;
        
        if (isPlaceholder(appId) && !isPlaceholder(settingsAppId)) {
          appId = settingsAppId;
        }
        
        if (!appId) {
          console.warn("OneSignal App ID is missing. Push notifications will not work.");
          return;
        }

        if (!Capacitor.isNativePlatform() && !(window as any).OneSignal) {
          await new Promise<void>((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => {
              console.error("Failed to load OneSignal Web SDK");
              resolve();
            };
            document.head.appendChild(script);
          });
        }

        if (Capacitor.isNativePlatform()) {
          console.log("🚀 OneSignal: Initializing Native Plugin with ID:", appId);
          // Native App Initialization
          try {
            const OS = OneSignal as any;
            if (typeof OS.setAppId === 'function') {
              OS.setAppId(appId);
            } else if (typeof OS.initialize === 'function') {
              OS.initialize(appId);
            }

            // In v5+ we need to opt-in or check permission
            if (OS.promptForPushNotificationsWithUserResponse) {
              OS.promptForPushNotificationsWithUserResponse((accepted: any) => {
                console.log("🚀 OneSignal: Permission Response:", accepted);
              });
            }

            if (user) {
              console.log("🚀 OneSignal: Syncing User ID:", user.uid);
              if (OS.setExternalUserId) OS.setExternalUserId(user.uid);
              else if (OS.login) OS.login(user.uid);

              const tags = {
                "role": isAdmin ? 'admin' : 'customer',
                "email": user.email || '',
                "verified": profile?.isVerified ? "true" : "false"
              };
              
              if (OS.sendTags) OS.sendTags(tags);
              else if (OS.User?.addTags) OS.User.addTags(tags);
            }
            
            console.log("✅ OneSignal: Native Initialization Completed");
          } catch (e) {
            console.error("❌ OneSignal: Native Init Error:", e);
          }
        } else {
          // Web SDK Initialization
          // @ts-ignore
          const OneSignalWeb = window.OneSignal;
          if (OneSignalWeb) {
            if (!isOneSignalWebInitialized) {
              try {
                await OneSignalWeb.init({
                  appId: appId,
                  allowLocalhostAsSecureOrigin: true,
                });
                isOneSignalWebInitialized = true;
                console.log("✅ OneSignal: Web SDK Initialized Successfully");
              } catch (initErr: any) {
                console.warn("OneSignal Web SDK Init skipped or restricted (expected in local/dev previews):", initErr.message || initErr);
                const errMsg = String(initErr.message || initErr || "").toLowerCase();
                if (errMsg.includes("already initialized") || errMsg.includes("already-exists")) {
                  isOneSignalWebInitialized = true;
                }
              }
            }
            
            if (isOneSignalWebInitialized && user) {
              try {
                if (typeof OneSignalWeb.login === 'function') {
                  await OneSignalWeb.login(user.uid);
                }
                // Set tags for web
                const tags = {
                  "role": isAdmin ? 'admin' : 'customer',
                  "email": user.email || '',
                  "verified": profile?.isVerified ? "true" : "false"
                };
                if (OneSignalWeb.User?.addTags) {
                   await OneSignalWeb.User.addTags(tags);
                } else if (OneSignalWeb.sendTags) {
                   await OneSignalWeb.sendTags(tags);
                }
              } catch (syncErr: any) {
                console.warn("OneSignal Web Sync User/Tags failed/skipped:", syncErr.message || syncErr);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error initializing OneSignal:", error);
      }
    };

    initOneSignal();
  }, [user, isAdmin, settings, settingsLoading, profile]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Apply SEO settings globally
  useEffect(() => {
    if (settingsLoading || !settings) return;
    
    try {
      // Apply Title
      if (settings.siteTitle) {
        document.title = settings.siteTitle;
      }
      
      // Apply Meta Description
      if (settings.metaDescription) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', settings.metaDescription);
      }
      
      // Apply Favicon
      if (settings.favicon) {
        const links = document.querySelectorAll("link[rel*='icon']");
        links.forEach(link => link.parentNode?.removeChild(link));
        
        const link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = settings.favicon;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    } catch (error) {
      console.error('Error applying SEO settings:', error);
    }
  }, [settings, settingsLoading]);
  
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>
      <ScrollToTop />
      <main className="flex-grow">
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/track" element={<TrackOrder />} />
            <Route path="/track/:id" element={<TrackOrder />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/addresses" element={<Addresses />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-prompt" element={<VerifyPrompt />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/:slug" element={<InfoPage />} />
            <Route 
              path="/admin/*" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
          </Routes>
        </Suspense>
      </main>
      {!isAdminPath && <Footer />}
      {!isAdminPath && <BottomNav />}
      {!isAdminPath && <ChatWidget />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
