import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ChatWidget from './components/ChatWidget';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence } from 'motion/react';

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
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Search = React.lazy(() => import('./pages/Search'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Addresses = React.lazy(() => import('./pages/Addresses'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));
const VerifyPrompt = React.lazy(() => import('./pages/VerifyPrompt'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));
const FAQ = React.lazy(() => import('./pages/FAQ'));

const ScrollToTop = () => {
  const location = useLocation();
  React.useEffect(() => {
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
        <CartProvider>
          <WishlistProvider>
            <Router>
              <AppContent />
            </Router>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

import { useVisitorTracking } from './hooks/useVisitorTracking';

import { auth, db } from './firebase';
import { getRedirectResult } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPath = location.pathname.startsWith('/admin');
  const [showSplash, setShowSplash] = React.useState(true);
  
  // Track live visitors
  useVisitorTracking();

  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  // Handle unverified email redirect
  React.useEffect(() => {
    if (authLoading) return;
    
    const publicPaths = ['/login', '/signup', '/verify-prompt', '/verify-email', '/about', '/contact', '/faq'];
    // Home ('/') is NOT public for logged-in but unverified users
    const isPublicPath = publicPaths.includes(location.pathname) || location.pathname.startsWith('/product/');
    
    if (user && profile && !profile.isVerified && !isPublicPath) {
      navigate(`/verify-prompt?email=${encodeURIComponent(user.email || '')}&uid=${user.uid}`);
    }
  }, [user, profile, location.pathname, authLoading, navigate]);

  // Initialize OneSignal
  React.useEffect(() => {
    if (settingsLoading) return;
    
    const initOneSignal = async () => {
      try {
        // @ts-ignore
        let appId = (import.meta.env.VITE_ONESIGNAL_APP_ID || '').trim();
        const settingsAppId = (settings?.oneSignalAppId || '').trim();
        
        const isPlaceholder = (id: string) => !id || id === 'dummy-id' || id === 'YOUR_ONESIGNAL_APP_ID' || id.length < 10;
        
        // Prefer settings from DB if env is a placeholder or missing
        if (isPlaceholder(appId) && !isPlaceholder(settingsAppId)) {
          appId = settingsAppId;
        }
        
        if (!appId) {
          console.warn("OneSignal App ID is missing. Push notifications will not work.");
          return;
        }

        // @ts-ignore
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        // @ts-ignore
        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.init({
            appId: appId,
            safari_web_id: "web.onesignal.auto.40e188d7-5f7a-4af3-8ac5-05427adc97a7",
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'OneSignalSDKWorker.js',
          });

          if (user && profile?.isVerified) {
            await OneSignal.login(user.uid);
            await OneSignal.User.addTag("role", isAdmin ? 'admin' : 'customer');
            await OneSignal.User.addTag("email", user.email);
          } else {
            await OneSignal.logout();
          }
        });
      } catch (error) {
        console.error("Error initializing OneSignal:", error);
      }
    };

    initOneSignal();
  }, [user, isAdmin, settings, settingsLoading]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Apply SEO settings globally
  React.useEffect(() => {
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
        <React.Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
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
        </React.Suspense>
      </main>
      {!isAdminPath && <Footer />}
      {!isAdminPath && <BottomNav />}
      {!isAdminPath && <ChatWidget />}
      <Toaster position="top-center" richColors />
    </div>
  );
}
