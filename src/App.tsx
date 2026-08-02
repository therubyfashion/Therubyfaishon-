import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';
import SplashScreen from './components/SplashScreen';
import PageLoader from './components/PageLoader';
import { AnimatePresence } from 'framer-motion';
import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

import { useVisitorTracking } from './hooks/useVisitorTracking';
import { trackPixelEvent } from './lib/pixel';

// Lazy load pages
import Home from './pages/Home';
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
const VerifyCOD = React.lazy(() => import('./pages/VerifyCOD'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));
const FAQ = React.lazy(() => import('./pages/FAQ'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const ReturnPolicy = React.lazy(() => import('./pages/ReturnPolicy'));
const ShippingPolicy = React.lazy(() => import('./pages/ShippingPolicy'));

const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();
  if (loading) return <PageLoader variant="minimal" message="Verifying access" />;
  return isAdmin ? <>{children}</> : <Navigate to="/" />;
};

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <WishlistProvider>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
let isOneSignalNativeInitialized = false;

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');
  const [showSplash, setShowSplash] = useState(true);

  // Clear old stale caches to ensure fresh data from Supabase
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('ruby_shop_cache_') || key.startsWith('ruby_product_cache_')) {
          localStorage.removeItem(key);
        }
      });
      console.log("[Cache Cleaner] Cleared stale product and shop caches.");
    } catch (e) {
      console.warn("Failed to clear stale caches:", e);
    }
  }, []);
  
  // Track live visitors
  useVisitorTracking();

  // Meta Pixel Route Tracking
  useEffect(() => {
    trackPixelEvent('PageView');
  }, [location.pathname]);

  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const { createNotification, notifications } = useNotifications();

  // Handle unverified email redirect
  useEffect(() => {
    if (authLoading) return;
    
    const publicPaths = ['/login', '/signup', '/verify-prompt', '/verify-email', '/verify-cod', '/about', '/contact', '/faq', '/checkout', '/cart', '/track', '/order-success', '/privacy-policy', '/terms-of-service', '/return-policy', '/shipping-policy', '/privacy', '/terms', '/returns', '/shipping', '/refund-policy'];
    // Home ('/') is NOT public for logged-in but unverified users
    const isPublicPath = publicPaths.includes(location.pathname) || location.pathname.startsWith('/product/') || location.pathname.startsWith('/track/');
    
    if (user && profile && !profile.isVerified && !isPublicPath) {
      navigate(`/verify-prompt?email=${encodeURIComponent(user.email || '')}&uid=${user.uid}`, { replace: true });
    }
  }, [user, profile, location.pathname, authLoading, navigate]);

  // Initialize OneSignal
  useEffect(() => {
    if (settingsLoading) return;
    
    const syncOneSignalIdToSupabase = async (userId: string, subId: string) => {
      if (!userId || !subId) return;
      console.log(`📝 [OneSignal Sync] Attempting Supabase profiles sync -> userId: ${userId}, subId: ${subId}`);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ onesignal_id: subId })
          .eq('id', userId)
          .select();
        if (error) {
          console.error("❌ Failed to sync OneSignal ID to Supabase profiles:", error.message);
        } else {
          console.log("✅ Successfully synced OneSignal ID to Supabase profiles:", subId, "Result:", data);
        }
      } catch (err: any) {
        console.error("❌ Failed to sync OneSignal ID to Supabase:", err.message);
      }
    };
    
    const initOneSignal = async () => {
      try {
        let appId = (settings?.oneSignalAppId || '').trim();
        const envAppId = ((import.meta as any).env.VITE_ONESIGNAL_APP_ID || '').trim();
        
        const isPlaceholder = (id: string) => !id || id === 'dummy-id' || id === 'YOUR_ONESIGNAL_APP_ID' || id.length < 10;
        
        if (isPlaceholder(appId) && !isPlaceholder(envAppId)) {
          appId = envAppId;
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
          const OS = OneSignal as any;
          
          // Native App Initialization (Only Once)
          if (!isOneSignalNativeInitialized) {
            try {
              if (typeof OS.setAppId === 'function') {
                OS.setAppId(appId);
              } else if (typeof OS.initialize === 'function') {
                OS.initialize(appId);
              }

              // Support modern v5 permission request
              if (OS.Notifications && typeof OS.Notifications.requestPermission === 'function') {
                OS.Notifications.requestPermission(true).then((accepted: any) => {
                  console.log("🚀 OneSignal v5 Permission Response:", accepted);
                }).catch((err: any) => {
                  console.warn("OneSignal v5 requestPermission error:", err);
                });
              } else if (OS.promptForPushNotificationsWithUserResponse) {
                OS.promptForPushNotificationsWithUserResponse((accepted: any) => {
                  console.log("🚀 OneSignal: Permission Response:", accepted);
                });
              }

              // Explicitly force system tray display of push notifications on the device even when app is open in foreground!
              if (OS.Notifications && typeof OS.Notifications.addEventListener === 'function') {
                OS.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
                  console.log("🔔 OneSignal: Foreground display hook matched:", event);
                  try {
                    if (event && event.getNotification) {
                      const notification = event.getNotification();
                      if (notification && typeof notification.display === 'function') {
                        console.log("📣 Forcible system notification drawer display invoked");
                        notification.display();
                      }
                    }
                  } catch (e) {
                    console.error("Failed to display foreground notification natively:", e);
                  }
                });
              }

              isOneSignalNativeInitialized = true;
              console.log("✅ OneSignal: Native Initialization Completed");
            } catch (e) {
              console.error("❌ OneSignal: Native Init Error:", e);
              // Treat as initialized to prevent breaking subsequent runs
              isOneSignalNativeInitialized = true;
            }
          }

          // User login & sync (Runs reliably when auth state changes)
          if (user) {
            try {
              const targetUserId = user.id || user.uid;
              console.log("🚀 OneSignal: Syncing User ID:", targetUserId);
              if (OS.setExternalUserId) OS.setExternalUserId(targetUserId);
              else if (OS.login) OS.login(targetUserId);

              const tags = {
                "role": isAdmin ? 'admin' : 'customer',
                "email": user.email || '',
                "verified": profile?.isVerified ? "true" : "false"
              };
              
              if (OS.sendTags) OS.sendTags(tags);
              else if (OS.User?.addTags) OS.User.addTags(tags);

              // Sync native subscription ID
              if (typeof OS.getDeviceState === 'function') {
                OS.getDeviceState((state: any) => {
                  const subId = state?.userId;
                  if (subId) {
                    syncOneSignalIdToSupabase(targetUserId, subId);
                  }
                });
              } else if (OS.User?.pushSubscription?.id) {
                const subId = OS.User.pushSubscription.id;
                syncOneSignalIdToSupabase(targetUserId, subId);
              } else if (OS.User?.PushSubscription?.id) {
                const subId = OS.User.PushSubscription.id;
                syncOneSignalIdToSupabase(targetUserId, subId);
              }
            } catch (e) {
              console.error("❌ OneSignal: Native User Sync Error:", e);
            }
          }
        } else {
          // Web SDK Initialization
          const runWebSync = async (OneSignalWeb: any) => {
            if (!isOneSignalWebInitialized) {
              try {
                await OneSignalWeb.init({
                  appId: appId,
                  allowLocalhostAsSecureOrigin: true,
                });
                isOneSignalWebInitialized = true;
                console.log("✅ OneSignal: Web SDK Initialized Successfully");
              } catch (initErr: any) {
                isOneSignalWebInitialized = true;
                console.warn("OneSignal Web SDK Init note:", initErr.message || initErr);
              }
            }
            
            if (user) {
              try {
                const targetUserId = user.id || user.uid;
                if (typeof OneSignalWeb.login === 'function') {
                  await OneSignalWeb.login(targetUserId);
                  console.log("✅ OneSignal Web sync login success:", targetUserId);
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

                // Helper to query and sync subscription ID
                const checkAndSyncSubId = async () => {
                  let subId = null;
                  if (OneSignalWeb.User?.pushSubscription?.id) {
                    subId = OneSignalWeb.User.pushSubscription.id;
                  } else if (OneSignalWeb.User?.PushSubscription?.id) {
                    subId = OneSignalWeb.User.PushSubscription.id;
                  } else if (OneSignalWeb.User?.pushSubscriptionId) {
                    subId = OneSignalWeb.User.pushSubscriptionId;
                  } else if (typeof OneSignalWeb.getUserId === 'function') {
                    subId = await OneSignalWeb.getUserId();
                  }

                  if (subId) {
                    console.log("====================================================");
                    console.log("🔔 [OneSignal Device Audit] Subscribed! Subscription ID:", subId);
                    console.log("====================================================");
                    await syncOneSignalIdToSupabase(targetUserId, subId);
                    return true;
                  } else {
                    console.log("⚠️ [OneSignal Device Audit] No subscription ID found yet (pending permission/registration).");
                    return false;
                  }
                };

                // Immediate check
                await checkAndSyncSubId();

                // Add permissionChange listener
                if (OneSignalWeb.Notifications?.addEventListener) {
                  OneSignalWeb.Notifications.addEventListener("permissionChange", async (permission: any) => {
                    console.log("🔔 [OneSignal] Permission status change detected:", permission);
                    if (permission === true || permission === 'granted' || permission?.to === 'granted') {
                      setTimeout(checkAndSyncSubId, 1000);
                      setTimeout(checkAndSyncSubId, 3000);
                    }
                  });
                }

                // Add real-time event listener for subscription changes
                if (OneSignalWeb.User?.pushSubscription?.addEventListener) {
                  OneSignalWeb.User.pushSubscription.addEventListener("change", async (event: any) => {
                    const newSubId = event.current?.id || event.current?.token;
                    console.log("🔔 [OneSignal Listener] Subscription change event fired, newSubId:", newSubId);
                    if (newSubId) {
                      await syncOneSignalIdToSupabase(targetUserId, newSubId);
                    }
                  });
                } else if (OneSignalWeb.User?.PushSubscription?.addEventListener) {
                  OneSignalWeb.User.PushSubscription.addEventListener("change", async (event: any) => {
                    const newSubId = event.current?.id || event.current?.token;
                    console.log("🔔 [OneSignal Listener] Subscription change event fired, newSubId:", newSubId);
                    if (newSubId) {
                      await syncOneSignalIdToSupabase(targetUserId, newSubId);
                    }
                  });
                }

                // Add real-time event listeners for tracking delivered and clicked statuses
                if (OneSignalWeb.Notifications && typeof OneSignalWeb.Notifications.addEventListener === 'function') {
                  OneSignalWeb.Notifications.addEventListener("click", async (event: any) => {
                    console.log("🔔 [OneSignal Web Event] Push notification click detected:", event);
                    const notificationId = event.notification?.notificationId;
                    if (notificationId) {
                      try {
                        await fetch('/api/notifications/track-clicked', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notificationId })
                        });
                      } catch (err) {
                        console.error("Failed to track clicked push status:", err);
                      }
                    }
                  });

                  OneSignalWeb.Notifications.addEventListener("foregroundWillDisplay", async (event: any) => {
                    console.log("🔔 [OneSignal Web Event] Push notification display detected:", event);
                    const notificationId = event.notification?.notificationId;
                    if (notificationId) {
                      try {
                        await fetch('/api/notifications/track-delivered', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notificationId })
                        });
                      } catch (err) {
                        console.error("Failed to track delivered push status:", err);
                      }
                    }
                  });
                }
              } catch (syncErr: any) {
                console.warn("OneSignal Web Sync User/Tags failed/skipped:", syncErr.message || syncErr);
              }
            }
          };

          // @ts-ignore
          const OSWebDirect = window.OneSignal;
          if (OSWebDirect) {
            await runWebSync(OSWebDirect);
          } else {
            // @ts-ignore
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            // @ts-ignore
            window.OneSignalDeferred.push(async (OneSignalWeb) => {
              await runWebSync(OneSignalWeb);
            });
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

      // Apply og:title & twitter:title
      const ogTitleVal = settings.ogTitle || settings.siteTitle;
      if (ogTitleVal) {
        let ogTitle = document.querySelector('meta[property="og:title"]');
        if (!ogTitle) {
          ogTitle = document.createElement('meta');
          ogTitle.setAttribute('property', 'og:title');
          document.head.appendChild(ogTitle);
        }
        ogTitle.setAttribute('content', ogTitleVal);

        let twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (!twitterTitle) {
          twitterTitle = document.createElement('meta');
          twitterTitle.setAttribute('name', 'twitter:title');
          document.head.appendChild(twitterTitle);
        }
        twitterTitle.setAttribute('content', ogTitleVal);
      }

      // Apply og:description & twitter:description
      const ogDescVal = settings.ogDescription || settings.metaDescription;
      if (ogDescVal) {
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (!ogDesc) {
          ogDesc = document.createElement('meta');
          ogDesc.setAttribute('property', 'og:description');
          document.head.appendChild(ogDesc);
        }
        ogDesc.setAttribute('content', ogDescVal);

        let twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (!twitterDesc) {
          twitterDesc = document.createElement('meta');
          twitterDesc.setAttribute('name', 'twitter:description');
          document.head.appendChild(twitterDesc);
        }
        twitterDesc.setAttribute('content', ogDescVal);
      }

      // Apply og:image & twitter:image
      const ogImgVal = settings.ogImage || settings.storeLogo;
      if (ogImgVal) {
        let ogImg = document.querySelector('meta[property="og:image"]');
        if (!ogImg) {
          ogImg = document.createElement('meta');
          ogImg.setAttribute('property', 'og:image');
          document.head.appendChild(ogImg);
        }
        ogImg.setAttribute('content', ogImgVal);

        let twitterImg = document.querySelector('meta[name="twitter:image"]');
        if (!twitterImg) {
          twitterImg = document.createElement('meta');
          twitterImg.setAttribute('name', 'twitter:image');
          document.head.appendChild(twitterImg);
        }
        twitterImg.setAttribute('content', ogImgVal);
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
      {!isAdminPath && <Navbar />}

      <main className="flex-grow">
        <Suspense fallback={<PageLoader variant="minimal" message="Gathering Collections" />}>
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
            <Route path="/verify-cod" element={<VerifyCOD />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/return-policy" element={<ReturnPolicy />} />
            <Route path="/shipping-policy" element={<ShippingPolicy />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/returns" element={<ReturnPolicy />} />
            <Route path="/refund-policy" element={<ReturnPolicy />} />
            <Route path="/shipping" element={<ShippingPolicy />} />
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
