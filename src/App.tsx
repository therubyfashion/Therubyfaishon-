import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import ChatWidget from './components/ChatWidget';

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
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Search = React.lazy(() => import('./pages/Search'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Addresses = React.lazy(() => import('./pages/Addresses'));
const VerifyEmail = React.lazy(() => import('./pages/VerifyEmail'));
const VerifyPrompt = React.lazy(() => import('./pages/VerifyPrompt'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));

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
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Router>
            <AppContent />
          </Router>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

import { useVisitorTracking } from './hooks/useVisitorTracking';

function AppContent() {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  
  // Track live visitors
  useVisitorTracking();

  // Apply SEO settings globally
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDocs(query(collection(db, 'settings'), limit(1)));
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          
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
        }
      } catch (error) {
        console.error('Error fetching SEO settings:', error);
      }
    };
    
    fetchSettings();
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      {!isAdminPath && <Navbar />}
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
            <Route path="/search" element={<Search />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/addresses" element={<Addresses />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-prompt" element={<VerifyPrompt />} />
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
