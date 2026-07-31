import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { OperationType, handleDatabaseError } from '../lib/error-handler';
import { sendNotification } from '../lib/notifications';
import { Product, Category } from '../types';
import { toast } from 'sonner';
import { checkProductHealth, logProductDiagnostics } from '../utils/productHealthCheck';
import { 
  LayoutDashboard, Package, Tags, ShoppingBag, Palette, Maximize2, 
  Ticket, Users, Settings, LogOut, Search, Bell, Menu, X, 
  TrendingUp, ShoppingCart, UserPlus, AlertTriangle, AlertCircle, Hash, ChevronRight, ChevronLeft,
  MoreVertical, Edit2, Trash2, Plus, Image as ImageIcon, Database, BarChart3, ExternalLink, Rocket, Activity,
  Home, ArrowLeft, Camera, ChevronDown, ChevronUp, Bold, Heading, Globe, Truck, Printer,
  TrendingDown, Shield, ShieldAlert, ShieldCheck, Volume2, Mail, Smartphone, Calendar, MessageCircle, Phone, Video, CheckCheck, Star, Info, History,
  Send, MessageSquare, User, CreditCard, Download, Eye, Check, ArrowRight,
  Cloud, RefreshCw, CheckCircle, Clock, MousePointer2, Zap, Save, Percent, Gift, Tag, Layers, MapPin,
  Sparkles, Megaphone, Copy, Share2, RotateCcw, XCircle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { generateInvoice } from '../utils/invoiceGenerator';
import { generateShippingLabel } from '../utils/shippingLabelGenerator';
import { compressImage } from '../utils/imageUtils';
import Barcode from 'react-barcode';
import LiveView from '../components/LiveView';
import PageLoader from '../components/PageLoader';
import { io } from 'socket.io-client';
import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';

import { useAuth } from '../contexts/AuthContext';

// ═══════════════════════════════════════════════
// LIVE VIEW HELPER COMPONENTS
// ═══════════════════════════════════════════════

const ChartContainer = ({ children, isMounted }: { children: React.ReactNode, isMounted: boolean }) => {
  if (!isMounted) {
    return (
      <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-2xl flex items-center justify-center text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">
        Loading...
      </div>
    );
  }
  
  return (
    <div className="w-full h-full min-h-[1px] relative">
      <ResponsiveContainer width="100%" height="100%">
        {children as any}
      </ResponsiveContainer>
    </div>
  );
};

const ensureDate = (val: any) => {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const getEffectiveOrderStatus = (order: any) => {
  if (!order) return 'Pending';
  const ret = order.returnStatus || order.return_status;
  if (ret) {
    const norm = ret.toLowerCase();
    if (norm === 'requested' || norm === 'pending') return 'Return Requested';
    if (norm === 'approved') return 'Return Approved';
    if (norm === 'picked up' || norm === 'picked_up') return 'Picked Up';
    if (norm === 'refunded') return 'Refunded';
    if (norm === 'rejected') return 'Return Rejected';
    return ret;
  }
  return order.status || 'Pending';
};

// ═══════════════════════════════════════════════
// BADGE CONFIG
// ═══════════════════════════════════════════════
const BADGE_CFG: Record<string, any> = {
  Paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'PAID' },
  Confirmed: { bg: 'bg-ruby/5', text: 'text-ruby', dot: 'bg-ruby', label: 'CONFIRMED' },
  Packed: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'PACKED' },
  Shipped: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'SHIPPED' },
  'Out for Delivery': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'OUT FOR DELIVERY' },
  'In Delivery': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', label: 'OUT FOR DELIVERY' },
  Delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DELIVERED' },
  Fulfilled: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'FULFILLED' },
  Unfulfilled: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'UNFULFILLED' },
  Pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'PENDING' },
  Processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'PROCESSING' },
  Cancelled: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', label: 'CANCELLED' },
  'Refunded': { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'REFUND COMPLETED' },
  'On Hold': { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'ON HOLD' },
  'Return Requested': { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'RETURN REQUESTED' },
  'Return Approved': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'RETURN APPROVED' },
  'Picked Up': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'PICKED UP' },
  'Return Rejected': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'RETURN REJECTED' },
  'Returned': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'RETURNED' },
};

const mapSupabaseProduct = (p: any, categoryMap: Record<string, string>): Product => {
  const mappedCategory = (p.category_ids || [])
    .map((id: string) => categoryMap[id])
    .filter(Boolean);

  return {
    id: p.id,
    name: p.name || '',
    description: p.description || '',
    price: Number(p.price || 0),
    comparePrice: p.compare_price ? Number(p.compare_price) : undefined,
    category: mappedCategory,
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    images: Array.isArray(p.images) ? p.images : [],
    stock: Number(p.stock ?? 0),
    stockStatus: p.stock_status || undefined,
    createdAt: p.created_at || new Date().toISOString(),
    isTrending: p.is_trending ?? false,
    isPopular: p.is_popular ?? false,
    sku: p.sku || undefined,
    barcode: p.barcode || undefined,
    weight: p.weight || undefined,
    dimensions: p.dimensions || undefined,
    seoTitle: p.seo_title || undefined,
    seoDescription: p.seo_description || undefined,
    variants: p.variants || [],
    viewCount: p.view_count ?? 0,
    wishlistCount: p.wishlist_count ?? 0,
  };
};

const StatusBadge = ({ status, label, className }: { status: string, label?: string, className?: string }) => {
  const c = BADGE_CFG[status] || BADGE_CFG['On Hold'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${c.bg} ${c.text} ${c.bg.replace('bg-', 'ring-').replace('-50', '-200')} ${className || ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${c.dot}`} />
      {label || c.label || status}
    </span>
  );
};

const LiveSparkline = ({ data, color = '#E11D48', height = 40 }: { data: number[], color?: string, height?: number }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const area = `M 0,${h} L ${data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' L ')} L ${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '').toLowerCase()}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace('#', '').toLowerCase()})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};



const chartDataSample = [];
const recentOrdersSample = [];
const topProductsSample = [];

type Tab = 'home' | 'dashboard' | 'live' | 'products' | 'category' | 'orders' | 'returns' | 'colour' | 'size' | 'coupon' | 'customer' | 'settings' | 'rocket' | 'stats' | 'notifications' | 'chats' | 'reviews' | 'abandoned' | 'insights' | 'promotions' | 'maintenance' | 'notification_logs';

function Accordion({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
            <Icon size={18} />
          </div>
          <span className="text-sm font-bold text-[#1A2C54]">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-gray-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const galleryImages = [
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1445205170230-053b830c6050?auto=format&fit=crop&q=80&w=800',
];

function DeleteConfirmationModal({ isOpen, onCancel, onConfirm, title, message }: { isOpen: boolean, onCancel: () => void, onConfirm: () => void, title: string, message: string }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#1A2C54]">{title}</h3>
                <p className="text-sm text-gray-400 mt-2">{message}</p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button 
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 bg-gray-50 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={onConfirm}
                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function AddProductPage({ formData, setFormData, onSave, onCancel, isEditing, categories, colors, sizes, loading }: any) {
  const [activeDescriptionTab, setActiveDescriptionTab] = useState<'edit' | 'preview'>('edit');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryTargetIndex, setGalleryTargetIndex] = useState(0);

  const addImage = () => {
    if (formData.images.length < 9) {
      const newIndex = formData.images.length;
      setFormData({ ...formData, images: [...formData.images, ''] });
      setGalleryTargetIndex(newIndex);
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, images: newImages.length === 0 ? [''] : newImages });
  };

  const updateImage = (index: number, value: string) => {
    const newImages = [...formData.images];
    newImages[index] = value;
    setFormData({ ...formData, images: newImages });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 5MB for selection, will be compressed later)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Please select an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Show loading state or similar if needed but for small-ish base64 it's fast
        const compressed = await compressImage(base64String);
        updateImage(galleryTargetIndex, compressed);
      };
      reader.readAsDataURL(file);
    }
    // Reset input value to allow selecting the same file again
    if (e.target) e.target.value = '';
  };

  const openFilePicker = (index: number) => {
    setGalleryTargetIndex(index);
    fileInputRef.current?.click();
  };

  const [newVariant, setNewVariant] = useState({ size: '', color: '', stock: 0 });

  const generateSKU = () => {
    const categoryName = typeof formData.category === 'string' ? formData.category : 'PROD';
    const prefix = categoryName.substring(0, 3).toUpperCase();
    const namePart = (formData.name || 'ITEM').substring(0, 3).toUpperCase().replace(/\s/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    const sku = `${prefix}-${namePart}-${random}`;
    setFormData({ ...formData, sku });
    toast.success('SKU Generated!');
  };

  const generateBarcode = () => {
    // Generate a 13-digit EAN-13 like barcode
    let barcode = '890'; // India prefix
    for (let i = 0; i < 9; i++) {
      barcode += Math.floor(Math.random() * 10);
    }
    // Simple checksum digit (not strictly valid EAN-13 but looks real)
    barcode += Math.floor(Math.random() * 10);
    setFormData({ ...formData, barcode });
    toast.success('Barcode Generated!');
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const generateAIDescription = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Please enter product name and category first");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `Write a professional, attractive, and "kadak" (strong) product description for an e-commerce store.
      Product Name: ${formData.name}
      Category: ${formData.category}
      Price: ₹${formData.price}
      
      Requirements:
      1. Use HTML tags for formatting.
      2. Use <b style="color: #E11D48;">...</b> for important keywords or highlights.
      3. Use <ul> and <li> for features.
      4. Make it sound premium and exclusive.
      5. Include a "Why Choose This?" section.
      6. Keep it concise but impactful.
      7. Use colors like #E11D48 (Ruby Red) for emphasis.
      
      Return ONLY the HTML content.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const text = response.text.replace(/```html|```/g, '').trim();
      
      setFormData({ ...formData, description: text });
      toast.success('AI Description Generated!');
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate AI description. Please try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const addVariant = () => {
    if (!newVariant.size || !newVariant.color) {
      toast.error("Please enter both size and color");
      return;
    }
    setFormData({
      ...formData,
      variants: [...(formData.variants || []), { ...newVariant }]
    });
    setNewVariant({ size: '', color: '', stock: 0 });
  };

  const removeVariant = (index: number) => {
    const newVariants = formData.variants.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, variants: newVariants });
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-0">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button 
            type="button"
            onClick={onCancel}
            className="p-2 md:p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-ruby hover:shadow-md transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#1A2C54]">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Inventory / {isEditing ? 'Edit' : 'New'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="text-xs md:text-sm font-bold text-[#1A2C54]">Admin User</p>
            <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Manager</p>
          </div>
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-ruby/10 flex items-center justify-center text-ruby font-bold shadow-sm">
            A
          </div>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-6 md:space-y-8">
        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left: Media */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Product Media</h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-400 mt-1">Select images from gallery</p>
                </div>
                <span className="text-[9px] md:text-[10px] font-bold text-gray-400">{formData.images.filter((img: string) => img).length}/9 Images</span>
              </div>
              
              <div 
                onClick={() => openFilePicker(0)}
                className="aspect-square w-full border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center space-y-4 bg-gray-50/50 group hover:border-ruby/30 transition-all cursor-pointer relative overflow-hidden"
              >
                {formData.images[0] ? (
                  <img src={formData.images[0]} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-gray-300 shadow-sm group-hover:scale-110 transition-transform">
                      <Camera size={32} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-[#1A2C54]">Choose Image</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Click to open phone gallery</p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {formData.images.map((img: string, i: number) => (
                  <div key={i} className="relative aspect-square rounded-xl border border-gray-100 overflow-hidden bg-gray-50 group cursor-pointer" onClick={() => openFilePicker(i)}>
                    {img ? (
                      <>
                        <img src={img} alt={`Preview ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(i);
                          }}
                          className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>
                ))}
                {formData.images.length < 9 && (
                  <button 
                    type="button"
                    onClick={addImage}
                    className="aspect-square rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-ruby/30 hover:text-ruby transition-all"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>
              <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">Supported formats: JPG, PNG, WEBP (Max 5MB)</p>
            </div>
          </div>

          {/* Right: Basic Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Premium Cotton T-Shirt"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border-b border-gray-100 py-3 text-base md:text-lg font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent placeholder:text-gray-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price (₹)</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-black text-[#1A2C54]">₹</span>
                    <input 
                      type="number" 
                      required
                      placeholder="0.00"
                      value={formData.price || ''}
                      onChange={e => setFormData({...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      className="w-full border-b border-gray-100 py-3 pl-6 text-lg font-black text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Compare Price (₹)</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300">₹</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={formData.comparePrice || ''}
                      onChange={e => setFormData({...formData, comparePrice: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      className="w-full border-b border-gray-100 py-3 pl-6 text-lg font-bold text-gray-300 focus:outline-none focus:border-ruby transition-colors bg-transparent line-through"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Categories (Select Multiple)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {categories.length > 0 ? (
                      categories.map((cat: any) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const current = formData.category || [];
                            const updated = current.includes(cat.name)
                              ? current.filter((c: string) => c !== cat.name)
                              : [...current, cat.name];
                            setFormData({ ...formData, category: updated });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-between text-left",
                            formData.category?.includes(cat.name)
                              ? "bg-ruby/5 border-ruby text-ruby shadow-sm"
                              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                          )}
                        >
                          <span className="truncate">{cat.name}</span>
                          {formData.category?.includes(cat.name) && <Check size={12} className="shrink-0 ml-2" />}
                        </button>
                      ))
                    ) : (
                      ['Women', 'Men', 'New Arrivals'].map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            const current = formData.category || [];
                            const updated = current.includes(name)
                              ? current.filter((c: string) => c !== name)
                              : [...current, name];
                            setFormData({ ...formData, category: updated });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-between text-left",
                            formData.category?.includes(name)
                              ? "bg-ruby/5 border-ruby text-ruby shadow-sm"
                              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                          )}
                        >
                          <span className="truncate">{name}</span>
                          {formData.category?.includes(name) && <Check size={12} className="shrink-0 ml-2" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock Quantity</label>
                    <input 
                      type="number" 
                      required
                      value={formData.stock || ''}
                      onChange={e => setFormData({...formData, stock: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                      className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock Status</label>
                    <select 
                      value={formData.stockStatus || 'In Stock'}
                      onChange={e => setFormData({...formData, stockStatus: e.target.value})}
                      className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent appearance-none"
                    >
                      <option value="In Stock">In Stock</option>
                      <option value="Out of Stock">Out of Stock</option>
                      <option value="On Backorder">On Backorder</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex justify-between items-center">
                    SKU
                    <button 
                      type="button" 
                      onClick={generateSKU}
                      className="text-[9px] text-ruby hover:underline"
                    >
                      Auto Generate
                    </button>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. SAR-RED-001"
                    value={formData.sku || ''}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex justify-between items-center">
                    Barcode
                    <button 
                      type="button" 
                      onClick={generateBarcode}
                      className="text-[9px] text-ruby hover:underline"
                    >
                      Auto Generate
                    </button>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. 8901234567890"
                    value={formData.barcode || ''}
                    onChange={e => setFormData({...formData, barcode: e.target.value})}
                    className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent"
                  />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isTrending: !formData.isTrending })}
                      className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${formData.isTrending ? 'bg-ruby' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isTrending ? 'left-7' : 'left-1'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-bold text-[#1A2C54]">Trending Product</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Show in homepage trending section</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isPopular: !formData.isPopular })}
                      className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${formData.isPopular ? 'bg-ruby' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isPopular ? 'left-7' : 'left-1'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-bold text-[#1A2C54]">Most Popular Product</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Show in homepage most popular section</p>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, notifySubscribers: formData.notifySubscribers === false })}
                        className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${formData.notifySubscribers !== false ? 'bg-ruby' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.notifySubscribers !== false ? 'left-7' : 'left-1'}`} />
                      </button>
                      <div>
                        <p className="text-sm font-bold text-[#1A2C54]">Notify subscribers about this product</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Send push & in-app notification</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h3 className="text-xs md:text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Product Description</h3>
            <div className="flex items-center space-x-2 md:space-x-4 w-full sm:w-auto">
              <button 
                type="button"
                onClick={generateAIDescription}
                disabled={isGeneratingAI}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-ruby/10 text-ruby rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby hover:text-white transition-all disabled:opacity-50"
              >
                {isGeneratingAI ? 'Generating...' : (
                  <>
                    <TrendingUp size={14} className="animate-pulse" />
                    <span>AI Generate</span>
                  </>
                )}
              </button>
              <div className="flex bg-gray-50 p-1 rounded-xl">
                <button 
                  type="button"
                  onClick={() => setActiveDescriptionTab('edit')}
                  className={`px-3 md:px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeDescriptionTab === 'edit' ? 'bg-white text-ruby shadow-sm' : 'text-gray-400'}`}
                >
                  Edit
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveDescriptionTab('preview')}
                  className={`px-3 md:px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeDescriptionTab === 'preview' ? 'bg-white text-ruby shadow-sm' : 'text-gray-400'}`}
                >
                  Preview
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-50">
              <button 
                type="button" 
                onClick={() => {
                  const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selected = text.substring(start, end);
                    const before = text.substring(0, start);
                    const after = text.substring(end);
                    const newText = `${before}<b>${selected}</b>${after}`;
                    setFormData({ ...formData, description: newText });
                  }
                }}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"
                title="Bold"
              >
                <Bold size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selected = text.substring(start, end);
                    const before = text.substring(0, start);
                    const after = text.substring(end);
                    const newText = `${before}<h3 style="color: #1A2C54; font-weight: bold;">${selected}</h3>${after}`;
                    setFormData({ ...formData, description: newText });
                  }
                }}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"
                title="Heading"
              >
                <Heading size={16} />
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selected = text.substring(start, end);
                    const before = text.substring(0, start);
                    const after = text.substring(end);
                    const newText = `${before}<span style="color: #E11D48; font-weight: bold;">${selected}</span>${after}`;
                    setFormData({ ...formData, description: newText });
                  }
                }}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"
                title="Ruby Color"
              >
                <Palette size={16} />
              </button>
              <div className="w-px h-4 bg-gray-100 mx-2"></div>
              <button 
                type="button" 
                onClick={() => {
                  const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                  if (textarea) {
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;
                    const selected = text.substring(start, end);
                    const before = text.substring(0, start);
                    const after = text.substring(end);
                    const newText = `${before}<ul>\n  <li>${selected}</li>\n</ul>${after}`;
                    setFormData({ ...formData, description: newText });
                  }
                }}
                className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"
                title="Bullet List"
              >
                <Maximize2 size={16} />
              </button>
            </div>
            
            {activeDescriptionTab === 'edit' ? (
              <textarea 
                name="description"
                required
                placeholder="Write a detailed description of your product..."
                value={formData.description || ''}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full min-h-[200px] py-4 text-sm font-medium text-gray-600 focus:outline-none bg-transparent resize-none leading-relaxed"
              />
            ) : (
              <div 
                className="min-h-[200px] py-4 text-sm font-medium text-gray-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formData.description || 'No description provided.' }}
              />
            )}
          </div>
        </div>

        {/* Advanced Sections */}
        <div className="space-y-4">
          <Accordion title="Variants (Size, Color)" icon={Palette}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 bg-gray-50 rounded-2xl md:rounded-3xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Size</label>
                  <select 
                    value={newVariant.size || ''}
                    onChange={e => setNewVariant({...newVariant, size: e.target.value})}
                    className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10 transition-all appearance-none"
                  >
                    <option value="">Select Size</option>
                    {sizes.map((s: any) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Color</label>
                  <select 
                    value={newVariant.color || ''}
                    onChange={e => setNewVariant({...newVariant, color: e.target.value})}
                    className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10 transition-all appearance-none"
                  >
                    <option value="">Select Color</option>
                    {colors.map((c: any) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock</label>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={newVariant.stock || ''}
                      onChange={e => setNewVariant({...newVariant, stock: parseInt(e.target.value) || 0})}
                      className="flex-grow h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10 transition-all" 
                    />
                    <button 
                      type="button"
                      onClick={addVariant}
                      className="w-11 h-11 bg-ruby text-white rounded-xl hover:bg-black transition-all flex items-center justify-center shrink-0 shadow-lg shadow-ruby/20 active:scale-95"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {formData.variants && formData.variants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Variants</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.variants.map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm group hover:border-ruby/30 transition-all">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] font-bold text-[#1A2C54]">
                            {v.size}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#1A2C54]">{v.color}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{v.stock} in stock</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Accordion>

          <Accordion title="SEO Settings" icon={Globe}>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meta Title</label>
                <input 
                  type="text" 
                  value={formData.seoTitle || ''}
                  onChange={e => setFormData({...formData, seoTitle: e.target.value})}
                  placeholder="Product SEO Title" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meta Description</label>
                <textarea 
                  value={formData.seoDescription || ''}
                  onChange={e => setFormData({...formData, seoDescription: e.target.value})}
                  placeholder="Brief description for search engines..." 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ruby/10 h-24" 
                />
              </div>
            </div>
          </Accordion>

          <Accordion title="Shipping Details" icon={Truck}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Weight (kg)</label>
                <input 
                  type="text" 
                  value={formData.weight || ''}
                  onChange={e => setFormData({...formData, weight: e.target.value})}
                  placeholder="0.5" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dimensions (L x W x H)</label>
                <input 
                  type="text" 
                  value={formData.dimensions || ''}
                  onChange={e => setFormData({...formData, dimensions: e.target.value})}
                  placeholder="10 x 20 x 5 cm" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                />
              </div>
            </div>
          </Accordion>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-gray-100">
          <button 
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-10 py-4 bg-white border border-gray-100 text-gray-400 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-12 py-4 bg-ruby text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-xl shadow-ruby/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading && <RefreshCw size={14} className="animate-spin" />}
            <span>{isEditing ? (loading ? 'Saving...' : 'Save Changes') : (loading ? 'Adding...' : 'Add Product')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function base64ToBlob(base64Data: string) {
  const parts = base64Data.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const wipeSystem = async () => {
    toast.success("System reset triggered");
  };
  const hookRunning = false;
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    window.scrollTo(0, 0);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const adminChatFileRef = useRef<HTMLInputElement>(null);
  const bannerImageInputRef = useRef<HTMLInputElement>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [dailyAnalytics, setDailyAnalytics] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isCustomerDeleteModalOpen, setIsCustomerDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);

  const [categoryForm, setCategoryForm] = useState({ name: '', image: '', sortOrder: '' });
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [colorForm, setColorForm] = useState({ name: '', hex: '#000000' });
  const [sizeForm, setSizeForm] = useState({ name: '' });
  const [couponForm, setCouponForm] = useState<any>({
    code: '',
    type: 'percentage',
    value: 0,
    discount: 0,
    min_cart_value: 0,
    usage_limit: '',
    active: true,
    start_date: '',
    end_date: ''
  });
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [bannerForm, setBannerForm] = useState({ image: '', title: '', link: '', active: true });
  const [bannerLinkType, setBannerLinkType] = useState<'category' | 'product' | 'link'>('link');
  const [bannerLinkValue, setBannerLinkValue] = useState('');
  const [editingBanner, setEditingBanner] = useState<any | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [deletePromotionModalOpen, setDeletePromotionModalOpen] = useState(false);
  const [genericDeleteModal, setGenericDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [promotionToDelete, setPromotionToDelete] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [deleteOrderModalOpen, setDeleteOrderModalOpen] = useState(false);
  const [deleteReviewModalOpen, setDeleteReviewModalOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [showAddProductPage, setShowAddProductPage] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<'day' | 'week' | 'month'>('month');
  const [chartData, setChartData] = useState<any[]>(chartDataSample);
  
  // New Tabs State
  const [categories, setCategories] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  const [customers, setCustomers] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [pushNotification, setPushNotification] = useState({ title: '', body: '', type: 'all' });
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'reports'>('overview');
  const [liveDashboardTab, setLiveDashboardTab] = useState<'overview' | 'sessions' | 'orders' | 'sources'>('overview');
  
  // Promotion Engine States
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any | null>(null);
  const [promotionForm, setPromotionForm] = useState<any>({
    name: '',
    description: '',
    priority: 1,
    status: 'draft',
    type: 'bxgy',
    conditions: {
      minCartValue: 0,
      minQuantity: 0,
      productIds: [],
      categoryIds: [],
      userType: 'all',
      startDate: '',
      endDate: ''
    },
    bxgyConfig: {
      buyQty: 2,
      getQty: 1,
      applyOn: 'same',
      maxFree: 1,
      repeat: false
    },
    reward: {
      method: 'auto',
      value: 100
    },
    limits: {
      perUser: 1,
      totalUsage: 100,
      maxDiscount: 0
    },
    stackable: false
  });

  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const totalRevenue = orders.reduce((acc, order) => acc + (order.total || 0), 0);

  const topStates = useMemo(() => {
    const counts: Record<string, number> = {};
    liveSessions.forEach(s => {
      const state = s.region || 'Unknown';
      counts[state] = (counts[state] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [liveSessions]);

  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    liveSessions.forEach(s => {
      const country = s.country || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [liveSessions]);
  
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string, sales: number, image: string }> = {};
    
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const productId = item.id || item.name;
          if (!productSales[productId]) {
            productSales[productId] = { 
              name: item.name, 
              sales: 0, 
              image: item.image || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=200' 
            };
          }
          productSales[productId].sales += (item.quantity || 1);
        });
      }
    });
    
    return Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [orders]);

  // Orders Tab State
  const [settings, setSettings] = useState({
    storeName: 'The Ruby Fashion',
    storeLogo: '',
    supportEmail: 'support@therubyfashion.com',
    currency: 'INR (₹)',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    googleSheetUrl: '',
    googleSheetApiKey: '',
    notificationSound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    favicon: '',
    siteTitle: 'The Ruby Fashion | Premium Clothing',
    metaDescription: 'Discover the latest trends in fashion at The Ruby Fashion.',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    resendApiKey: '',
    fromEmail: 'support@therubyfashion.shop',
    smtpUser: '',
    smtpPass: '',
    otpMonthlyLimit: 9999,
    fast2smsApiKey: '',
    fast2smsTestPhone: '',
    oneSignalAppId: '',
    oneSignalRestApiKey: '',
    footerSocials: {
      instagram: '',
      x: '',
      facebook: '',
      youtube: '',
      whatsapp: ''
    },
    footerContact: {
      email: 'hello@theruby.com',
      phone: '+1 (555) 123-4567',
      address: '123 Fashion Ave, NY 10001'
    },
    buy2Get1Free: false,
    buy2GetPercentEnabled: false,
    buy2GetPercentOff: 0,
    promoEnabled: false,
    promoType: 'timer',
    promoMessage: '🔥 Mega Sale Ends In:',
    promoEndDate: '2026-06-30T23:59:59',
    promoScrolling: false,
    promoBgColor: '#A11B35',
    promoTextColor: '#FFFFFF'
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pushLogs, setPushLogs] = useState<any[]>([]);
  const [loadingPushLogs, setLoadingPushLogs] = useState(false);

  useEffect(() => {
    if (activeTab !== 'notification_logs') return;
    
    const fetchPushLogs = async () => {
      setLoadingPushLogs(true);
      try {
        const { data } = await supabase
          .from('push_notification_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);
        setPushLogs(data || []);
      } catch (err: any) {
        console.error("Error fetching push notification logs:", err);
        setPushLogs([]);
      } finally {
        setLoadingPushLogs(false);
      }
    };
    
    fetchPushLogs();
  }, [activeTab]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dashboardLoadTime = useRef(new Date().toISOString());
  const isInitialOrdersRef = useRef(true);

  useEffect(() => {
    // Initialize audio
    if (settings.notificationSound && !audioRef.current) {
      audioRef.current = new Audio(settings.notificationSound);
    } else if (audioRef.current && settings.notificationSound) {
      audioRef.current.src = settings.notificationSound;
    }
  }, [settings.notificationSound]);

  useEffect(() => {
    // Live subscriber for brand new orders that plays custom selected sound
    const channel = supabase
      .channel('orders-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          const orderData = payload.new;
          const createdAtVal = orderData.created_at || orderData.createdAt;
          // Verify with load time that it's a completely new active order
          if (createdAtVal && new Date(createdAtVal) > new Date(dashboardLoadTime.current)) {
            // 1. Play selected premium alert sound from Settings!
            if (audioRef.current && settings.notificationSound) {
              audioRef.current.play().catch(playErr => {
                console.warn("Audio autoplay blocked/failed:", playErr);
              });
            }

            const orderIdStr = orderData.order_number || orderData.orderId || 'New Order';
            const customerNameStr = orderData.shipping_full_name || orderData.customerName || 'Customer';

            // 2. Show beautiful Sonner Live Alert with Action to view/manage
            toast.success(`🛒 Live Order Received: ${orderIdStr}`, {
              description: `${customerNameStr} placed an order of ₹${Number(orderData.total || 0).toLocaleString()} via ${orderData.payment_method || 'COD'}`,
              duration: 12000,
              action: {
                label: "Manage",
                onClick: () => {
                  setActiveTab('orders');
                  if (typeof fetchDashboardData === 'function') {
                    fetchDashboardData();
                  }
                }
              }
            });

            // 3. Incrementally refresh metrics
            fetchDashboardData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings.notificationSound]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (settings.siteTitle) document.title = settings.siteTitle;
    
    if (settings.metaDescription) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', settings.metaDescription);
    }
    
    if (settings.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'icon');
        document.head.appendChild(link);
      }
      link.href = settings.favicon;
    }
  }, [settings.siteTitle, settings.metaDescription, settings.favicon]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [trackingEvent, setTrackingEvent] = useState({ status: '', location: '', description: '' });
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    displayName: profile?.displayName || user?.displayName || '',
    phoneNumber: profile?.phoneNumber || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  });

  // Sync profile form when profile data arrives
  useEffect(() => {
    if (profile || user) {
      setProfileFormData({
        displayName: profile?.displayName || user?.displayName || '',
        phoneNumber: profile?.phoneNumber || '',
        photoURL: profile?.photoURL || user?.photoURL || '',
      });
    }
  }, [profile, user]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const updatePayload: any = {
        displayName: profileFormData.displayName,
        phoneNumber: profileFormData.phoneNumber,
        updatedAt: new Date().toISOString()
      };

      // Only update photo if it's a valid remote URL
      if (profileFormData.photoURL && !profileFormData.photoURL.startsWith('blob:') && !profileFormData.photoURL.startsWith('data:')) {
        updatePayload.photoURL = profileFormData.photoURL;
      }

      await supabase
        .from('profiles')
        .update({
          display_name: profileFormData.displayName,
          phone_number: profileFormData.phoneNumber,
          photo_url: (profileFormData.photoURL && !profileFormData.photoURL.startsWith('blob:') && !profileFormData.photoURL.startsWith('data:'))
            ? profileFormData.photoURL 
            : (profile?.photoURL || '')
        })
        .eq('id', user.uid);
      toast.success('Admin profile updated successfully! 💎');
    } catch (error) {
      console.error("Admin profile update error:", error);
      toast.error('Failed to update admin profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB.");
      return;
    }

    const toastId = toast.loading("Uploading admin profile picture...");
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;

      const compressed = await compressImage(base64, 400, 400, 0.45);
      
      const response = await fetch('/api/user/upload-profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid: user.uid,
          photo: compressed
        })
      });
      
      toast.dismiss(toastId);

      if (!response.ok) {
        throw new Error(`Server profile upload returned status ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success && result.photoURL) {
        setProfileFormData(prev => ({ ...prev, photoURL: result.photoURL }));
        localStorage.setItem(`user_photo_${user.uid}`, result.photoURL);
        toast.success("Admin photo updated successfully! ✨");
        // Force update local user details
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error("Admin photo upload error:", err);
      toast.error("Failed to upload photo: " + err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsUpdatingProfile(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (updateErr) throw updateErr;
      toast.success('Password changed safely! Remember it for next login.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Security check failed.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  const [firebaseDiagnostics, setFirebaseDiagnostics] = useState<any>(null);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [campaignType, setCampaignType] = useState<'sale' | 'ad' | 'bulk'>('sale');
  const [campaignResult, setCampaignResult] = useState<any>(null);
  const [selectedCampaignCategory, setSelectedCampaignCategory] = useState('All');
  const [isSendingBulkReminders, setIsSendingBulkReminders] = useState(false);
  const [onesignalSubscriptionId, setOnesignalSubscriptionId] = useState<string | null>(null);
  const [onesignalUserId, setOnesignalUserId] = useState<string | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<any[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  const fetchRegisteredDevices = async () => {
    setIsLoadingDevices(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error("Error fetching registered devices from Supabase:", error.message);
      } else if (data) {
        const devicesList: any[] = [];
        data.forEach(p => {
          if (p.onesignal_id) {
            devicesList.push({
              id: p.id,
              name: p.display_name || p.email?.split('@')[0] || 'Unnamed User',
              email: p.email || 'No Email',
              onesignalId: p.onesignal_id,
              role: p.role || 'customer'
            });
          }
        });
        setRegisteredDevices(devicesList);
      }
    } catch (error) {
      console.error("Error fetching registered devices:", error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // OneSignal Status Fetcher
  useEffect(() => {
    if (activeTab === 'settings' && activeSettingsTab === 'push') {
      const storedReal = localStorage.getItem("onesignal_real_sub_id");
      const storedMock = localStorage.getItem("onesignal_mock_sub_id");
      if (storedReal) setOnesignalSubscriptionId(storedReal);
      else if (storedMock) setOnesignalSubscriptionId(storedMock);

      const storedMockUserId = localStorage.getItem("onesignal_mock_user_id");
      if (storedMockUserId) setOnesignalUserId(storedMockUserId);

      const fetchId = () => {
        if (Capacitor.isNativePlatform()) {
          try {
            const OS = OneSignal as any;
            if (OS.getDeviceState) {
              OS.getDeviceState((state: any) => {
                const deviceId = state.userId || state.pushToken;
                if (deviceId) {
                  setOnesignalSubscriptionId(deviceId);
                  localStorage.setItem("onesignal_real_sub_id", deviceId);
                }
                if (state.userId) {
                  setOnesignalUserId(state.userId);
                }
              });
            } else if (OS.User?.pushSubscription?.id) {
              setOnesignalSubscriptionId(OS.User.pushSubscription.id);
              localStorage.setItem("onesignal_real_sub_id", OS.User.pushSubscription.id);
              if (OS.User?.onesignalId) {
                setOnesignalUserId(OS.User.onesignalId);
              }
            }
          } catch (e) {
            console.error("Error fetching native OneSignal state:", e);
          }
        } else {
          // Web platform
          try {
            const OS = (window as any).OneSignal;
            if (OS) {
              const subId = OS.User?.PushSubscription?.id || OS.User?.pushSubscriptionId;
              if (subId) {
                setOnesignalSubscriptionId(subId);
                localStorage.setItem("onesignal_real_sub_id", subId);
              }
              const osUserId = OS.User?.onesignalId;
              if (osUserId) {
                setOnesignalUserId(osUserId);
              }
            }
          } catch (e) {
            console.error("Error fetching web OneSignal state:", e);
          }
        }
      };

      fetchId();
      fetchRegisteredDevices();
      const interval = setInterval(fetchId, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeSettingsTab]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Checking...');
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const checkFirebaseStatus = async (force = false) => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch(`/api/system-health`);
      const data = await res.json();
      setSystemHealth(data);
      
      // Legacy compatibility for firebase specific status if needed elsewhere
      if (data.services?.firebase) {
        setFirebaseStatus(data.services.firebase.status);
        setFirebaseDiagnostics(data.services.firebase);
      }
    } catch (err: any) {
      setFirebaseStatus(`Error: ${err.message}`);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleCheckFullHealth = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/system-health');
      const data = await res.json();
      setSystemHealth(data);
      toast.success(`System Health: ${data.status}`);
    } catch (e) {
      toast.error("Technical health check failed");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      checkFirebaseStatus();
    }
  }, [activeTab, activeSettingsTab]);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushNotification.title || !pushNotification.body) {
      toast.error("Please fill in both title and body");
      return;
    }

    setIsSendingNotification(true);
    try {
      await supabase.from('notifications').insert([{
        title: pushNotification.title,
        body: pushNotification.body,
        created_at: new Date().toISOString(),
        type: pushNotification.type || 'alert'
      }]);
      
      // Send real push notification via server
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushNotification.title,
          body: pushNotification.body,
          url: '/',
          type: pushNotification.type
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        if (data.warning) {
          toast.success("Notification published! ✅ Added to client feed. (Note: OneSignal reports 0 active devices currently opted in on the web. Subscribe a browser/tab to get a physical alert!)", { duration: 10000 });
        } else {
          toast.success("Push notification sent successfully! 🚀 Check your opted-in devices.");
        }
        setPushNotification({ title: '', body: '', type: 'all' });
      } else {
        const errorMsg = data.hint || data.error || "Failed to send notification";
        toast.error(errorMsg, { duration: 8000 });
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setIsSendingNotification(false);
    }
  };

  const requestNotificationPermission = async () => {
    // Check if keys are configured first
    if (!settings.oneSignalAppId) {
      toast.error("Please configure and save OneSignal App ID first.");
      return;
    }
    
    setIsSubscribingPush(true);

    const triggerPermission = async (OS: any) => {
      try {
        const isInIframe = window.self !== window.top;
        
        if (isInIframe) {
          toast.info("Sandbox Environment Detected: Generating simulated subscriber ID to bypass browser restrictions!");
          const mockId = "simulated_push_2026_" + (user?.uid?.substring(0, 8) || "admin_dev");
          setOnesignalSubscriptionId(mockId);
          localStorage.setItem("onesignal_mock_sub_id", mockId);
          toast.success("Push Notifications Enabled (Simulated Mode)! 🔔 You can now test 'Direct Test' or 'Send All'.");
          setIsSubscribingPush(false);
          return;
        }

        if (!OS) {
          throw new Error("OneSignal SDK not found. Double check your App ID or content blockers.");
        }

        // Initialize dynamically if needed
        if (!OS.Notifications) {
          await OS.init({
            appId: settings.oneSignalAppId.trim(),
            safari_web_id: "web.onesignal.auto.40e188d7-5f7a-4af3-8ac5-05427adc97a7",
            allowLocalhostAsSecureOrigin: true,
          });
        }

        // Handle standard native browser or custom OS flow
        console.log("Triggering push request...");
        
        if (OS.Notifications?.requestPermission) {
          await OS.Notifications.requestPermission();
        } else if (typeof OS.registerForPushNotifications === 'function') {
          await OS.registerForPushNotifications();
        } else {
          // Native browser nudge fallback
          await Notification.requestPermission();
        }

        // Delay to allow subscriber registry sync
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Sync local subscriber ID to state
        let subId = null;
        if (OS.User?.PushSubscription?.id) {
          subId = OS.User.PushSubscription.id;
        } else if (OS.User?.pushSubscriptionId) {
          subId = OS.User.pushSubscriptionId;
        } else if (typeof OS.getUserId === 'function') {
          subId = OS.getUserId();
        }
        
        if (subId) {
          setOnesignalSubscriptionId(subId);
          localStorage.setItem("onesignal_real_sub_id", subId);
        } else {
          // Fallback to local simulated if browser blocks notifications
          const targetUserId = user?.id || user?.uid || "admin_dev";
          const mockId = "simulated_push_2026_" + targetUserId.substring(0, 8);
          setOnesignalSubscriptionId(mockId);
          localStorage.setItem("onesignal_mock_sub_id", mockId);
          toast.info("Notification Prompt Skipped/Blocked. Subscribed using Simulated Connection for testing! 🚀");
        }

        // Login & Tag & Sync to Supabase
        if (user) {
          const targetUserId = user.id || user.uid;
          if (typeof OS.login === 'function') await OS.login(targetUserId).catch(() => {});
          const tags = {
            role: "admin",
            email: user.email || '',
            verified: "true"
          };
          if (OS.User?.addTags) {
            await OS.User.addTags(tags).catch(() => {});
          } else if (OS.sendTags) {
            await OS.sendTags(tags).catch(() => {});
          }

          if (subId) {
            try {
              const { data, error } = await supabase
                .from('profiles')
                .update({ onesignal_id: subId })
                .eq('id', targetUserId)
                .select();
              if (error) {
                console.error("❌ Failed to sync admin onesignal_id to Supabase profiles:", error.message);
              } else {
                console.log("✅ Successfully synced admin onesignal_id to Supabase profiles:", subId, "Data:", data);
              }
            } catch (err: any) {
              console.warn("Skipped syncing admin onesignal_id:", err.message);
            }
          }
        }

        // Refresh permission value to show success
        const granted = OS.Notifications?.permission === 'granted' || (Notification as any).permission === 'granted';
        if (granted) {
          toast.success("Push Notifications Enabled Successfully! 🔔 You are now ready to receive real-time updates.");
        } else {
          toast.info("Please accept the browser's native notification prompt to subscribe.");
        }

      } catch (err: any) {
        console.error("OneSignal inner prompt error:", err);
        const mockId = "simulated_push_2026_" + (user?.uid?.substring(0, 8) || "admin_dev");
        setOnesignalSubscriptionId(mockId);
        localStorage.setItem("onesignal_mock_sub_id", mockId);
        toast.success("Push Notifications Enabled using Simulated Connection! 🔔");
      } finally {
        setIsSubscribingPush(false);
      }
    };

    // Try executing directly
    // @ts-ignore
    const directOS = window.OneSignal;
    if (directOS) {
      await triggerPermission(directOS);
    } else {
      // Also execute simulated for high speed if OneSignal script fails to load/is blocked by extension
      const isInIframe = window.self !== window.top;
      if (isInIframe || typeof window.Notification === 'undefined') {
        const mockId = "simulated_push_2026_" + (user?.uid?.substring(0, 8) || "admin_dev");
        setOnesignalSubscriptionId(mockId);
        localStorage.setItem("onesignal_mock_sub_id", mockId);
        toast.success("Push Notifications Enabled (Simulated Mode)! 🔔");
        setIsSubscribingPush(false);
        return;
      }

      // @ts-ignore
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      // @ts-ignore
      window.OneSignalDeferred.push(async (OS) => {
        await triggerPermission(OS);
      });
    }
  };

  const categoryPerformance = [
    { name: 'Men', value: 65, color: '#1A2C54' },
    { name: 'Women', value: 85, color: '#E11D48' },
    { name: 'Accessories', value: 45, color: '#22C55E' },
    { name: 'Sale', value: 95, color: '#F59E0B' },
  ];

  const orderStatusData = [
    { name: 'Delivered', value: orders.filter(o => o.status === 'Delivered').length, color: '#22C55E' },
    { name: 'Pending', value: orders.filter(o => o.status === 'Pending').length, color: '#F59E0B' },
    { name: 'Shipped', value: orders.filter(o => o.status === 'Shipped').length, color: '#3B82F6' },
    { name: 'Cancelled', value: orders.filter(o => o.status === 'Cancelled').length, color: '#EF4444' },
  ];

  const COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#EF4444'];

  const [isTestingOneSignal, setIsTestingOneSignal] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  const handleTestOneSignal = async () => {
    setIsTestingOneSignal(true);
    try {
      const response = await fetch('/api/test-onesignal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: settings.oneSignalAppId,
          restKey: settings.oneSignalRestApiKey
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success("OneSignal configuration is valid! ✅");
      } else {
        toast.error(data.hint || data.error || "OneSignal test failed", { duration: 8000 });
      }
    } catch (error) {
      console.error("Error testing OneSignal:", error);
      toast.error("Failed to test OneSignal configuration");
    } finally {
      setIsTestingOneSignal(false);
    }
  };

  const handleSendTestPush = async (toSelf = false) => {
    if (!settings.oneSignalAppId || !settings.oneSignalRestApiKey) {
      toast.error("Please configure and save OneSignal keys first");
      return;
    }
    setIsSendingTestPush(true);
    try {
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: toSelf ? "Direct Test Active! 🎯" : "Test Notification",
          body: toSelf ? "This message was sent only to your device." : "OneSignal is working correctly! 🚀",
          type: toSelf ? 'individual' : 'all',
          playerId: toSelf ? onesignalSubscriptionId : null,
          appId: settings.oneSignalAppId,
          restKey: settings.oneSignalRestApiKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Also save to notifications collection so it shows in the panel
        try {
          await supabase.from('notifications').insert([{
            title: "Test Notification",
            body: "OneSignal is working correctly! 🚀",
            type: 'test',
            created_at: new Date().toISOString(),
            is_read: false
          }]);
        } catch (dbErr) {
          console.error("Error saving notification to DB:", dbErr);
        }

        if (data.warning) {
          toast.success("Broadcast configuration is valid! ✅ Added to queue safely. (Note: OneSignal currently registers 0 active subscribers. Open the app in a new browser window/tab and click 'Enable Notifications' to receive live pushes!)", { duration: 10000 });
        } else {
          toast.success("Test push sent! Check your device.");
        }
      } else {
        const errorMsg = data.hint || data.error || "Failed to send test push";
        toast.error(errorMsg, { duration: 8000 });
      }
    } catch (error) {
      console.error("Error sending test push:", error);
      toast.error("Failed to send test push");
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleSendDirectPush = async (playerId: string, targetName: string) => {
    if (!settings.oneSignalAppId || !settings.oneSignalRestApiKey) {
      toast.error("Please configure and save OneSignal keys first");
      return;
    }
    const toastId = toast.loading(`Sending diagnostic push to ${targetName}...`);
    try {
      const response = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Diagnostic Test Received! 🛠️",
          body: `Admin successfully tested notifications to this device. ID: ${playerId.substring(0, 8)}...`,
          type: 'individual',
          playerId: playerId,
          appId: settings.oneSignalAppId,
          restKey: settings.oneSignalRestApiKey
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(`Push sent successfully to ${targetName}! 🚀`, { id: toastId });
      } else {
        toast.error(`Push failed: ${data.error || 'Unknown error'}`, { id: toastId, duration: 8000 });
      }
    } catch (error) {
      console.error("Error sending diagnostic push:", error);
      toast.error("Failed to make push request", { id: toastId });
    }
  };

  const handleSimulateDevice = async () => {
    const mockSubId = `sim_sub_2026_${Math.random().toString(36).substring(2, 10)}`;
    const mockUserId = `sim_uid_2026_${Math.random().toString(36).substring(2, 10)}`;
    
    setOnesignalSubscriptionId(mockSubId);
    setOnesignalUserId(mockUserId);
    localStorage.setItem("onesignal_mock_sub_id", mockSubId);
    localStorage.setItem("onesignal_mock_user_id", mockUserId);
    
    // Write it to Supabase profiles directly for the current admin user if authenticated
    if (user) {
      try {
        const targetUserId = user.id || user.uid;
        await supabase
          .from('profiles')
          .update({ onesignal_id: mockSubId })
          .eq('id', targetUserId);
        toast.success("Successfully registered Simulated Device in database! 🧪");
        fetchRegisteredDevices();
      } catch (err: any) {
        console.error("Failed to sync mock ID to Supabase:", err);
        toast.success("Generated Simulated Device token! 🔔");
      }
    } else {
      toast.success("Generated Simulated Device token! 🔔");
    }
  };

  const handleClearSimulatedDevice = async () => {
    localStorage.removeItem("onesignal_mock_sub_id");
    localStorage.removeItem("onesignal_mock_user_id");
    localStorage.removeItem("onesignal_real_sub_id");
    setOnesignalSubscriptionId(null);
    setOnesignalUserId(null);
    if (user) {
      try {
        const targetUserId = user.id || user.uid;
        await supabase
          .from('profiles')
          .update({ onesignal_id: null })
          .eq('id', targetUserId);
        toast.success("Cleared Simulated Device registration!");
        fetchRegisteredDevices();
      } catch (err: any) {
        console.error("Failed to clear device registration in Supabase:", err);
      }
    } else {
      toast.success("Cleared Simulated Device registration!");
    }
  };

  const [isResettingData, setIsResettingData] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');

  const handleProductionReset = async () => {
    if (resetPassword !== "RESET_THE_RUBY_2026") {
      toast.error("Incorrect Password! Enter the correct password to reset.");
      return;
    }

    setIsResettingData(true);
    try {
      const response = await fetch('/api/clear-production-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password: resetPassword,
          adminUid: user?.uid
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message, { duration: 6000 });
        setShowResetConfirm(false);
        setResetPassword('');
        // Trigger a reload to refresh all data counts
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(data.error || "Reset failed");
      }
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Cleanup failed due to server error.");
    } finally {
      setIsResettingData(false);
    }
  };

  const handlePromptPermission = () => {
    if (Capacitor.isNativePlatform()) {
      const OS = OneSignal as any;
      const promptMethod = OS.promptForPushNotificationsWithUserResponse || OS.Notifications?.requestPermission;
      
      if (typeof promptMethod === 'function') {
        promptMethod((accepted: any) => {
          if (accepted) {
            toast.success("Push notifications enabled! 🚀");
          } else {
            toast.error("Notifications were denied. Please allow them in settings.");
          }
        });
      } else {
        toast.info("Notification management is handled by your system.");
      }
      return;
    }

    const OS = (window as any).OneSignal;
    if (OS?.Notifications) {
      OS.Notifications.requestPermission();
    } else if (OS?.push) {
      OS.push(() => {
        OS.showNativePrompt?.() || OS.registerForPushNotifications?.();
      });
    } else {
      toast.error("OneSignal SDK not loaded yet. Please refresh.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Logic: Ensure fromEmail is not using the Resend sandbox placeholder
      let finalizedSettings = { ...settings };
      if (finalizedSettings.fromEmail?.includes('resend.dev') || (finalizedSettings.fromEmail?.includes('rubyfashion.shop') && !finalizedSettings.fromEmail?.includes('therubyfashion.shop'))) {
        toast.info("Updating 'From Email' to use your verified domain: therubyfashion.shop");
        finalizedSettings.fromEmail = 'support@therubyfashion.shop';
        setSettings(finalizedSettings);
      }

      // Save to Supabase
      const { data: existingSettings } = await supabase.from('settings').select('id').limit(1);
      if (!existingSettings || existingSettings.length === 0) {
        await supabase.from('settings').insert([finalizedSettings]);
      } else {
        await supabase.from('settings').update(finalizedSettings).eq('id', existingSettings[0].id);
      }
      
      // Sync API Keys with server
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resendApiKey: finalizedSettings.resendApiKey,
          razorpayKeyId: finalizedSettings.razorpayKeyId,
          razorpayKeySecret: finalizedSettings.razorpayKeySecret,
          fast2smsApiKey: finalizedSettings.fast2smsApiKey,
          oneSignalAppId: finalizedSettings.oneSignalAppId,
          oneSignalRestApiKey: finalizedSettings.oneSignalRestApiKey,
          smtpUser: finalizedSettings.smtpUser,
          smtpPass: finalizedSettings.smtpPass
        })
      });
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    }
  };

  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const handleTestEmail = async () => {
    if (!settings.resendApiKey && (!settings.smtpUser || !settings.smtpPass)) {
      toast.error('Please enter a Resend API Key or configure Gmail App Password first.');
      return;
    }
    
    setIsTestingEmail(true);
    try {
      // Sync Resend API Key with server if present
      if (settings.resendApiKey) {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resendApiKey: settings.resendApiKey })
        });
      }

      // Save all settings first to ensure server gets latest SMTP info
      await handleSaveSettings();

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: settings.supportEmail,
          from: settings.fromEmail || undefined,
          subject: 'Test Email from The Ruby ✨',
          html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; padding: 40px 20px; color: #FFFFFF; line-height: 1.5;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <div style="text-align: center; margin-bottom: 40px;">
                        ${settings.storeLogo ? `<img src="${settings.storeLogo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain;">` : `
                          <div style="width: 60px; height: 60px; background-color: #1A1A1A; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                            <span style="color: #FFFFFF; font-weight: bold; font-size: 20px;">${(settings.storeName || 'R')[0]}</span>
                          </div>
                        `}
                      </div>
                      
                      <div style="text-align: center; margin-bottom: 40px;">
                        <h2 style="font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">Email Integration Successful! 🚀</h2>
                        <p style="font-size: 16px; color: #888888; line-height: 1.6; margin: 0;">This is a test email to verify your email configuration. If you're reading this, your store is ready to send professional notifications to your customers.</p>
                      </div>

                      <div style="background-color: #111111; border-radius: 8px; padding: 24px; text-align: center; border: 1px solid #1A1A1A;">
                        <p style="font-size: 14px; color: #888888; margin: 0;">Your email service is correctly configured and the server is ready to handle requests.</p>
                      </div>

                      <div style="margin-top: 60px; text-align: center; border-top: 1px solid #1A1A1A; padding-top: 40px;">
                        <p style="font-size: 14px; font-weight: 500; color: #FFFFFF; margin: 0;">The Ruby Admin Panel</p>
                        <p style="font-size: 12px; color: #E11D48; font-weight: bold; margin: 4px 0 0 0;">System Notification</p>
                        <p style="font-size: 11px; color: #444444; margin-top: 20px;">&copy; ${new Date().getFullYear()} ${settings.storeName || 'The Ruby'}. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                `
        })
      });
      
      if (response.ok) {
        toast.success(`Test email sent to ${settings.supportEmail}`);
      } else {
        const data = await response.json();
        if (data.hint) {
          toast.error(data.hint, { duration: 8000 });
        } else if (data.name === 'validation_error') {
          toast.error('Resend Validation Error: Check if your "From Email" is verified or if you are sending to an unauthorized email.');
        } else {
          toast.error(data.error || 'Failed to send test email');
        }
      }
    } catch (error) {
      console.error('Error testing email:', error);
      toast.error('Error sending test email');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const [testPhone, setTestPhone] = useState('');
  const [isTestingSms, setIsTestingSms] = useState(false);
  const handleSendTestSms = async () => {
    if (!testPhone) {
      toast.error('Please enter a test phone number.');
      return;
    }
    setIsTestingSms(true);
    try {
      // Save settings first
      await handleSaveSettings();

      const response = await fetch('/api/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: testPhone })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Verification OTP code sent successfully!');
      } else {
        toast.error(data.message || data.error || 'Failed to generate test OTP');
      }
    } catch (error: any) {
      console.error('Error testing SMS:', error);
      toast.error('Network error occurred during SMS OTP test.');
    } finally {
      setIsTestingSms(false);
    }
  };

  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('All');
  const [orderTab, setOrderTab] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All Status');
  const [orderTypeFilter, setOrderTypeFilter] = useState('All Orders');
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [activeOrderMenu, setActiveOrderMenu] = useState<string | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerLoyaltyLogs, setCustomerLoyaltyLogs] = useState<any[]>([]);
  const [loadingCustomerLogs, setLoadingCustomerLogs] = useState(false);
  const [isGrantBonusModalOpen, setIsGrantBonusModalOpen] = useState(false);
  const [bonusPointsInput, setBonusPointsInput] = useState('100');
  const [bonusReasonInput, setBonusReasonInput] = useState('');

  useEffect(() => {
    if (!selectedCustomer?.id) return;
    const fetchCustomerLogs = async () => {
      setLoadingCustomerLogs(true);
      try {
        const { data, error } = await supabase
          .from('loyalty_points_log')
          .select('*')
          .eq('user_id', selectedCustomer.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setCustomerLoyaltyLogs(data);
        }
      } catch (e) {
        console.error("Error fetching customer loyalty logs:", e);
      } finally {
        setLoadingCustomerLogs(false);
      }
    };
    fetchCustomerLogs();
  }, [selectedCustomer?.id]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [fulfillmentItems, setFulfillmentItems] = useState<any[]>([]);

  useEffect(() => {
    if (viewingCustomer && viewingCustomer.items) {
      setFulfillmentItems(viewingCustomer.items.map((item: any) => ({ ...item, qtyToFulfill: item.quantity })));
    }
  }, [viewingCustomer]);

  const handleUpdateFulfillmentQty = (idx: number, delta: number) => {
    setFulfillmentItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const newQty = Math.max(0, Math.min(item.quantity, item.qtyToFulfill + delta));
        return { ...item, qtyToFulfill: newQty };
      }
      return item;
    }));
  };
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    if (viewingCustomer) {
      setTrackingNumber(viewingCustomer.trackingNumber || '');
      setCarrier(viewingCustomer.carrier || '');
      setIsTrackingEnabled(!!viewingCustomer.trackingNumber);
      setShowSuccessOverlay(false);
    }
  }, [viewingCustomer]);

  const getTrackingUrl = (carrierName: string, trackingNum: string) => {
    if (!carrierName || !trackingNum) return '';
    const c = carrierName.toLowerCase().replace(/\s/g, '');
    const urls: Record<string, string> = {
      'bluedart': `https://www.bluedart.com/tracking?trackid=${trackingNum}`,
      'delhivery': `https://www.delhivery.com/track/package/${trackingNum}`,
      'dtdc': `https://www.dtdc.in/tracking/tracking_results.asp?SearchType=T&TNo=${trackingNum}`,
      'ecom': `https://ecomexpress.in/tracking/?tracking_id=${trackingNum}`,
      'fedex': `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNum}`,
      'xpressbees': `https://www.xpressbees.com/track?tracking_id=${trackingNum}`,
      'shadowfax': `https://www.shadowfax.in/track?orderId=${trackingNum}`,
    };
    return urls[c] || `https://www.google.com/search?q=${carrierName}+tracking+${trackingNum}`;
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    if (typeof ts === 'number') return new Date(ts).toLocaleString();
    if (typeof ts === 'string') return new Date(ts).toLocaleString();
    return 'Just now';
  };

  const handleAddTrackingHistory = async () => {
    if (!viewingCustomer || !trackingEvent.status) {
      toast.error("Please enter a status/title for the event");
      return;
    }
    setIsAddingEvent(true);
    try {
      const now = new Date();
      const newEvent = {
        ...trackingEvent,
        time: now.toISOString(),
        id: Math.random().toString(36).substr(2, 9)
      };
      
      const updatedHistory = [...(viewingCustomer.trackingHistory || []), newEvent];

      const { error: supErr } = await supabase
        .from('orders')
        .update({
          tracking_history: updatedHistory
        })
        .eq('id', viewingCustomer.id);

      if (supErr) throw supErr;
      
      setViewingCustomer({
        ...viewingCustomer,
        trackingHistory: updatedHistory
      });
      
      setTrackingEvent({ status: '', location: '', description: '' });
      toast.success("Detailed tracking event added! 📍");
    } catch (e) {
      console.error("Error adding tracking event:", e);
      toast.error("Failed to add tracking event");
    } finally {
      setIsAddingEvent(false);
    }
  };

  const handleMarkAsDelivered = async (order: any) => {
    if (!order) return;
    try {
      const now = new Date();
      const { error: supErr } = await supabase
        .from('orders')
        .update({
          status: 'delivered'
        })
        .eq('id', order.id);

      if (supErr) throw supErr;
      
      // Notify customer
      try {
        if (order.userId && order.userId !== 'guest') {
          await fetch('/api/send-user-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: order.userId,
              title: 'Order Delivered! 🎉',
              body: `Your order ${order.orderId} has been successfully delivered. Enjoy!`,
              url: '/my-orders'
            })
          }).catch(e => console.error("Push failed:", e));
        }

        const targetEmail = order.address?.email || order.email || order.customerEmail || order.userEmail;
        if (targetEmail) {
          const emailRes = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: targetEmail,
              from: settings.fromEmail || undefined,
              replyTo: settings.supportEmail || undefined,
              subject: `Order Delivered: ${order.orderId} ✨`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; padding: 40px 20px; color: #FFFFFF; line-height: 1.5;">
                  <div style="max-width: 500px; margin: 0 auto;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                      <span style="font-size: 14px; font-weight: 500; color: #FFFFFF;">Order ${order.orderId}</span>
                      <span style="font-size: 14px; font-weight: 500; color: #008060; text-transform: lowercase;">delivered</span>
                    </div>

                    <div style="text-align: center; margin-bottom: 40px;">
                      <div style="width: 60px; height: 60px; background-color: #1A1A1A; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <span style="font-size: 30px;">🎉</span>
                      </div>
                    </div>

                    <div style="margin-bottom: 40px;">
                      <h1 style="font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">Package Delivered!</h1>
                      <p style="font-size: 16px; color: #888888; margin: 0;">Hi ${order.address?.name || order.customerName || 'Customer'},</p>
                      <p style="font-size: 16px; color: #888888; margin: 16px 0 0 0;">We're happy to inform you that your order <strong>${order.orderId}</strong> has been successfully delivered. We hope you love your new pieces!</p>
                    </div>

                    <div style="margin-bottom: 40px; text-align: center;">
                      <a href="${window.location.origin}/contact" 
                         style="display: block; background-color: #FFFFFF; color: #000000; padding: 18px; border-radius: 4px; text-decoration: none; font-size: 16px; font-weight: 500; text-align: center; margin-bottom: 16px;">
                        Give Feedback
                      </a>
                    </div>

                    <div style="margin-top: 60px; text-align: center; border-top: 1px solid #1A1A1A; padding-top: 40px;">
                      <p style="font-size: 14px; font-weight: 500; color: #FFFFFF; margin: 0;">Thanks for shopping with ${settings.storeName || 'The Ruby'}</p>
                      <p style="font-size: 11px; color: #444444; margin-top: 20px;">&copy; ${new Date().getFullYear()} ${settings.storeName || 'The Ruby'}. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              `
            })
          });
          if (!emailRes.ok) console.error("Email API failed for delivery notification");
        }
      } catch (e) {
        console.error("Failed to send delivery notifications:", e);
      }

      toast.success("Order marked as Delivered!");
      setViewingCustomer({ 
        ...order, 
        status: 'Delivered',
        deliveredAt: now.toISOString(),
        fulfillmentStatus: 'Fulfilled',
        fulfilledAt: now.toISOString()
      });
    } catch (error) {
      console.error("Error marking as delivered:", error);
      toast.error("Failed to update status");
    }
  };

  const handleFulfillOrder = async (order: any) => {
    if (!order) return;
    setIsFulfilling(true);
    try {
      const now = new Date();
      const trNum = (isTrackingEnabled && trackingNumber) ? trackingNumber : null;
      const carr = (isTrackingEnabled && trackingNumber) ? carrier : null;
      const trUrl = (isTrackingEnabled && trackingNumber) ? getTrackingUrl(carrier, trackingNumber) : null;

      const { error: supErr } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          tracking_number: trNum,
          carrier: carr,
          tracking_url: trUrl
        })
        .eq('id', order.id);

      if (supErr) throw supErr;
      
      // Notify customer if enabled
      if (notifyCustomer) {
        try {
          // Push (only for logged in users)
          if (order.userId && order.userId !== 'guest') {
            await fetch('/api/send-user-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: order.userId,
                title: 'Order Shipped! 📦',
                body: `Good news! Your order ${order.orderId} has been shipped.`,
                url: '/my-orders'
              })
            }).catch(e => console.error("Push failed:", e));
          }

          // Email (to anyone who provided an email)
          const targetEmail = order.address?.email || order.email || order.customerEmail || order.userEmail;
          console.log(`Fulfillment notification target email for ${order.id}:`, targetEmail);
          
          if (targetEmail) {
            const itemsHtml = (order.items || []).map((item: any) => `
              <div style="display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                <img src="${item.image}" width="50" height="50" style="border-radius: 8px; object-fit: cover;" />
                <div style="flex: 1;">
                  <p style="margin: 0; font-size: 14px; font-weight: bold;">${item.name}</p>
                  <p style="margin: 0; font-size: 12px; color: #666;">Qty: ${item.quantity} · Size: ${item.selectedSize || 'N/A'}</p>
                </div>
                <div style="text-align: right;">
                  <p style="margin: 0; font-size: 14px; font-weight: bold;">₹${item.price.toLocaleString()}</p>
                </div>
              </div>
            `).join('');

            const emailRes = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: targetEmail,
                from: settings.fromEmail || undefined,
                replyTo: settings.supportEmail || undefined,
                subject: `Order Shipped: ${order.orderId} is on its way! 📦`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; padding: 40px 20px; color: #FFFFFF; line-height: 1.5;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <!-- Header -->
                      <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                        <span style="font-size: 14px; font-weight: 500; color: #FFFFFF;">Order ${order.orderId}</span>
                        <span style="font-size: 14px; font-weight: 500; color: #D1A054; text-transform: lowercase;">shipped</span>
                      </div>

                      <div style="text-align: center; margin-bottom: 40px;">
                        <div style="width: 60px; height: 60px; background-color: #1A1A1A; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                          <span style="font-size: 30px;">📦</span>
                        </div>
                      </div>

                      <!-- Main Message -->
                      <div style="margin-bottom: 40px;">
                        <h1 style="font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">Your Order is Shipped!</h1>
                        <p style="font-size: 16px; color: #888888; margin: 0;">Hi ${order.address?.name || order.customerName || 'Customer'},</p>
                        <p style="font-size: 16px; color: #888888; margin: 16px 0 0 0;">Good news! Your order <strong>${order.orderId}</strong> has been shipped and is on its way to you.</p>
                      </div>

                      <!-- Shipment Info -->
                      <div style="background-color: #111111; border-radius: 8px; padding: 24px; border: 1px solid #1A1A1A; margin-bottom: 40px;">
                        <div style="border-bottom: 1px solid #1A1A1A; padding-bottom: 16px; margin-bottom: 16px;">
                          ${(order.items || []).map((item: any) => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                              <span style="font-size: 14px; color: #888888;">${item.name} × ${item.quantity}</span>
                              <span style="font-size: 14px; color: #FFFFFF;">₹${item.price.toLocaleString()}</span>
                            </div>
                          `).join('')}
                        </div>
                        <div style="display: flex; justify-content: space-between; font-weight: 500;">
                          <span style="font-size: 14px; color: #888888;">Total Amount</span>
                          <span style="font-size: 14px; color: #FFFFFF;">₹${(order.total || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      <!-- Action Button -->
                      <div style="margin-bottom: 40px; text-align: center;">
                        <a href="${window.location.origin}/track/${order.orderId}?email=${encodeURIComponent(targetEmail)}" 
                           style="display: block; background-color: #FFFFFF; color: #000000; padding: 18px; border-radius: 4px; text-decoration: none; font-size: 16px; font-weight: 500; text-align: center; margin-bottom: 16px;">
                          Track My Order
                        </a>
                        ${trNum ? `
                          <p style="font-size: 12px; color: #444444; margin-top: 16px;">Carrier: ${carr} | AWB: ${trNum}</p>
                        ` : ''}
                      </div>

                      <!-- Footer -->
                      <div style="margin-top: 60px; text-align: center; border-top: 1px solid #1A1A1A; padding-top: 40px;">
                        <p style="font-size: 14px; font-weight: 500; color: #FFFFFF; margin: 0;">Thanks for shopping with ${settings.storeName || 'The Ruby'}</p>
                        <p style="font-size: 11px; color: #444444; margin-top: 20px;">&copy; ${new Date().getFullYear()} ${settings.storeName || 'The Ruby'}. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                `
              })
            });
            if (!emailRes.ok) throw new Error("Email API responded with error");
          } else {
            console.warn("No target email found for order fulfillment notification");
            toast.error("Customer email not found in order, email could not be sent.");
          }
        } catch (e) {
          console.error("Failed to send shipment notifications:", e);
          toast.warning("Shipment updated, but failed to send notifications. Check your Email/OneSignal settings.");
        }
      }

      toast.success("Order fulfilled successfully! 📦");
      // Update local state with a real timestamp for immediate UI feedback
      setViewingCustomer({ 
        ...order, 
        status: 'Shipped',
        fulfillmentStatus: 'Fulfilled',
        fulfilledAt: now.toISOString(),
        trackingNumber: trNum || undefined,
        carrier: carr || undefined,
        trackingUrl: trUrl || undefined
      });
      setShowSuccessOverlay(true);
    } catch (error) {
      console.error("Error fulfilling order:", error);
      toast.error("Failed to fulfill order");
    } finally {
      setIsFulfilling(false);
    }
  };

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: number;
    category: string[];
    sizes: string[];
    images: string[];
    stock: number;
    comparePrice: number;
    stockStatus: string;
    seoTitle: string;
    seoDescription: string;
    weight: string;
    dimensions: string;
    sku: string;
    barcode: string;
    isTrending: boolean;
    isPopular: boolean;
    updatedAt?: string;
    variants: { size: string; color: string; stock: number }[];
  }>({
    name: '',
    description: '',
    price: 0,
    category: [],
    sizes: ['S', 'M', 'L', 'XL'],
    images: [''],
    stock: 10,
    comparePrice: 0,
    stockStatus: 'In Stock',
    seoTitle: '',
    seoDescription: '',
    weight: '',
    dimensions: '',
    sku: '',
    barcode: '',
    isTrending: false,
    isPopular: false,
    notifySubscribers: true,
    variants: []
  });

  useEffect(() => {
    if (orders.length > 0) {
      generateChartData();
    }
  }, [orders, chartTimeframe]);

  const generateChartData = () => {
    const now = new Date();
    const data: any[] = [];
    
    if (chartTimeframe === 'day') {
      // Last 24 hours (grouped by 3-hour intervals)
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
        const label = d.getHours() + ':00';
        const periodOrders = orders.filter(o => {
          const orderDate = ensureDate(o.createdAt);
          return orderDate > new Date(d.getTime() - 3 * 60 * 60 * 1000) && orderDate <= d;
        });
        const sales = periodOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
        data.push({ name: label, sales, orders: periodOrders.length });
      }
    } else if (chartTimeframe === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const dayOrders = orders.filter(o => {
          const orderDate = ensureDate(o.createdAt);
          return orderDate.toDateString() === d.toDateString();
        });
        const sales = dayOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
        data.push({ name: label, sales, orders: dayOrders.length });
      }
    } else {
      // Last 30 days (grouped by 5-day intervals)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 5 * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const periodOrders = orders.filter(o => {
          const orderDate = ensureDate(o.createdAt);
          return orderDate > new Date(d.getTime() - 5 * 24 * 60 * 60 * 1000) && orderDate <= d;
        });
        const sales = periodOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
        data.push({ name: label, sales, orders: periodOrders.length });
      }
    }
    
    setChartData(data.length > 0 ? data : chartDataSample);
  };

  // Real-time listener for live sessions using Supabase active_sessions
  useEffect(() => {
    const fetchLiveSessions = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .gt('last_seen', fiveMinutesAgo);

      if (!error && data) {
        setLiveSessions(data);
      }
    };

    fetchLiveSessions();

    const channel = supabase
      .channel('admin_live_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, () => {
        fetchLiveSessions();
      })
      .subscribe();

    const timer = setInterval(fetchLiveSessions, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  // Real-time listener for customer chats in Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchAdminChats = async () => {
      try {
        const { data: rawChatsData, error: chatsError } = await supabase
          .from('chats')
          .select('*, profiles:user_id(id, display_name, email, photo_url)')
          .order('last_message_at', { ascending: false });

        let rawChats = rawChatsData || [];

        if (chatsError || (rawChats.length > 0 && (!rawChats[0].profiles || (Array.isArray(rawChats[0].profiles) && rawChats[0].profiles.length === 0)))) {
          const { data: fallbackChats } = await supabase
            .from('chats')
            .select('*')
            .order('last_message_at', { ascending: false });
          
          if (fallbackChats && fallbackChats.length > 0) {
            const uIds = [...new Set(fallbackChats.map(c => c.user_id).filter(Boolean))];
            let profMap = new Map();
            if (uIds.length > 0) {
              const { data: profs } = await supabase
                .from('profiles')
                .select('id, display_name, email, photo_url')
                .in('id', uIds);
              profMap = new Map((profs || []).map(p => [p.id, p]));
            }
            rawChats = fallbackChats.map(c => ({
              ...c,
              profiles: profMap.get(c.user_id) || null
            }));
          }
        }

        // Fetch unread messages count per chat for admin
        const { data: unreadMsgs } = await supabase
          .from('chat_messages')
          .select('chat_id')
          .eq('sender_role', 'user')
          .eq('is_read', false);

        const unreadMap: Record<string, number> = {};
        if (unreadMsgs) {
          unreadMsgs.forEach((m: any) => {
            unreadMap[m.chat_id] = (unreadMap[m.chat_id] || 0) + 1;
          });
        }

        const formattedChats = rawChats.map((c: any) => {
          const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          const uName = prof?.display_name || prof?.email || c.user_name || 'Customer';
          return {
            ...c,
            userId: c.user_id,
            userName: uName,
            userEmail: prof?.email || '',
            lastMessage: c.last_message || 'No messages',
            lastMessageAt: c.last_message_at || c.created_at,
            unreadCountAdmin: unreadMap[c.id] || 0
          };
        });

        if (isMounted) {
          setChats(formattedChats);
        }
      } catch (err: any) {
        console.error("Admin chats fetch error:", err);
      }
    };

    fetchAdminChats();

    const chatsChannel = supabase
      .channel('admin_chats_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        fetchAdminChats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        fetchAdminChats();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(chatsChannel);
    };
  }, []);

  // Keep selectedChat updated when chats list changes
  useEffect(() => {
    if (!selectedChat) return;
    const latestChat = chats.find(c => c.id === selectedChat.id);
    if (latestChat) {
      if (
        latestChat.last_message_at !== selectedChat.last_message_at ||
        latestChat.unreadCountAdmin !== selectedChat.unreadCountAdmin ||
        latestChat.lastMessage !== selectedChat.lastMessage
      ) {
        setSelectedChat(latestChat);
      }
    }
  }, [chats, selectedChat]);

  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [dashboardViewMode, setDashboardViewMode] = useState<'advanced' | 'core'>('advanced');

  const handleLaunchCleanup = () => {
    setShowWipeModal(true);
  };

  const performWipe = async () => {
    try {
      if (wipePassword !== "RESET_THE_RUBY_2026" && wipePassword !== "RESET_THE_RUBY_Launch_2026") {
        toast.error("Incorrect password confirmation.");
        return;
      }

      setIsCleaningUp(true);
      const toastId = toast.loading("Processing Wipe... Please wait.");
      
      // Use the server-side endpoint for 100% reliability (Admin SDK power)
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          password: wipePassword,
          adminUid: user?.uid
        })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Server error response:", text);
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || `Server error (${response.status})`);
        } catch (e) {
          throw new Error(`Server returned non-JSON response (${response.status}). This usually means the server route is missing or crashed.`);
        }
      }

      const data = await response.json();
      
      if (data.success) {
        // Clear local states for immediate UI update before reload
        setOrders([]);
        setNotifications([]);
        setAbandonedCarts([]);
        setSessionsCount(0);
        setUsersCount(1); // Only current admin usually remains
        setLiveSessions([]);
        setReviews([]);
        
        toast.success(data.message || "Store Reset Successful!", { id: toastId });
        setShowWipeModal(false);
        setWipePassword('');
        
        // Wait a bit and reload
        setTimeout(() => {
          window.location.replace('/admin'); // Force full fresh load
        }, 1500);
      } else {
        throw new Error(data.error || "Reset failed");
      }
    } catch (error: any) {
      console.error("Cleanup failed:", error);
      toast.error(error.message || "An error occurred during cleanup.");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const fetchDashboardData = async () => {
    if (products.length === 0 || orders.length === 0) {
      setLoading(true);
    }

    try {
      const [
        usersRes, colorsRes, sizesRes, couponsRes, bannersRes, 
        settingsRes, sessionsRes, promotionsRes
      ] = await Promise.all([
        supabase.from('profiles').select('*').limit(500),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('banners').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').limit(1),
        supabase.from('active_sessions').select('*').limit(100),
        supabase.from('promotions').select('*').order('priority', { ascending: true })
      ]);

      if (settingsRes.data && settingsRes.data.length > 0) {
        setSettings(prev => ({ ...prev, ...settingsRes.data[0] }));
      }

      const usersData = usersRes.data || [];
      setUsersCount(usersData.length);
      setCustomers(usersData.map((u: any) => ({
        id: u.id,
        email: u.email || '',
        displayName: u.display_name || 'User',
        phoneNumber: u.phone_number || '',
        photoURL: u.photo_url || '',
        role: u.role || 'user',
        createdAt: u.created_at
      })));
      setColors(colorsRes.data || []);
      setSizes(sizesRes.data || []);

      let supabaseMappedOrders: any[] = [];
      try {
        const { data: supOrders, error: supErr } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (supErr) {
          console.warn("Error fetching orders from Supabase in AdminDashboard:", supErr);
        } else if (supOrders) {
          supabaseMappedOrders = supOrders.map(o => {
            let clientStatus = o.status;
            if (o.status === 'cancelled' && o.return_reason) {
              clientStatus = 'Return Requested';
            } else if (o.status === 'pending') {
              clientStatus = 'Pending';
            } else if (o.status === 'processing') {
              clientStatus = 'Processing';
            } else if (o.status === 'packed') {
              clientStatus = 'Packed';
            } else if (o.status === 'shipped') {
              clientStatus = 'Shipped';
            } else if (o.status === 'out_for_delivery') {
              clientStatus = 'Out for Delivery';
            } else if (o.status === 'delivered') {
              clientStatus = 'Delivered';
            } else if (o.status === 'cancelled') {
              clientStatus = 'Cancelled';
            }

            const isFulfilled = o.status === 'shipped' || o.status === 'out_for_delivery' || o.status === 'delivered';

            return {
              id: o.id,
              orderId: o.order_number,
              userId: o.user_id || 'guest',
              items: o.items || [],
              subtotal: o.subtotal ?? o.total,
              discount: o.discount ?? 0,
              shippingCost: o.shipping_cost ?? 0,
              codFee: o.cod_fee ?? 0,
              total: o.total,
              status: clientStatus,
              paymentMethod: o.payment_method,
              shippingMethod: o.shipping_method || 'Standard Delivery',
              email: o.customer_email || '',
              customerName: o.shipping_full_name || 'Customer',
              address: {
                name: o.shipping_full_name,
                number: o.shipping_phone,
                address: o.shipping_address,
                city: o.shipping_city,
                pincode: o.shipping_zip
              },
              createdAt: o.created_at,
              estimatedDelivery: o.estimated_delivery || '2-5 Days',
              paymentId: o.payment_id || 'COD',
              paymentStatus: o.payment_status,
              returnReason: o.return_reason,
              returnComments: o.return_comments,
              returnRequestedAt: o.return_requested_at,
              returnStatus: o.return_status,
              returnAdminNotes: o.return_admin_notes,
              trackingHistory: o.tracking_history || [],
              fulfillmentStatus: isFulfilled ? 'Fulfilled' : 'Unfulfilled',
              fulfilledAt: isFulfilled ? (o.updated_at || o.created_at) : null,
              deliveredAt: o.status === 'delivered' ? (o.updated_at || o.created_at) : null
            };
          });
        }
      } catch (e) {
        console.error("Exception fetching orders from Supabase:", e);
      }

      const mergedOrders = [...supabaseMappedOrders];
      mergedOrders.sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());

      // Fetch categories from Supabase
      let supabaseCategories: any[] = [];
      try {
        const { data: supCategories, error: supCatErr } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true });
        if (supCatErr) {
          console.warn("Error fetching categories from Supabase inside fetchDashboardData:", supCatErr);
        } else if (supCategories) {
          supabaseCategories = supCategories.map(c => ({
            id: c.id,
            name: c.name || '',
            image: c.image || '',
            slug: c.slug || '',
            sortOrder: c.sort_order !== undefined ? Number(c.sort_order) : 1000,
            createdAt: c.created_at || new Date().toISOString()
          }));
        }
      } catch (catExc) {
        console.error("Exception fetching categories from Supabase inside fetchDashboardData:", catExc);
      }

      // Fetch products from Supabase
      let supabaseProducts: Product[] = [];
      try {
        const { data: supProducts, error: supProdErr } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
        if (supProdErr) {
          console.warn("Error fetching products from Supabase inside fetchDashboardData:", supProdErr);
        } else if (supProducts) {
          const categoryMap: Record<string, string> = {};
          supabaseCategories.forEach(c => {
            categoryMap[c.id] = c.name;
          });
          supabaseProducts = supProducts.map(p => mapSupabaseProduct(p, categoryMap));
        }
      } catch (prodExc) {
        console.error("Exception fetching products from Supabase inside fetchDashboardData:", prodExc);
      }

      setProducts(supabaseProducts);
      setOrders(mergedOrders);
      setCategories(supabaseCategories);
      const supabaseCoupons = (couponsRes.data || []).map((c: any) => ({
        ...c,
        id: c.id,
        code: c.code,
        type: c.type || 'percentage',
        value: Number(c.value ?? c.discount ?? 0),
        discount: Number(c.value ?? c.discount ?? 0),
        min_cart_value: Number(c.min_cart_value ?? c.minCartValue ?? 0),
        minCartValue: Number(c.min_cart_value ?? c.minCartValue ?? 0),
        usage_limit: c.usage_limit ?? c.usageLimit ?? null,
        usageLimit: c.usage_limit ?? c.usageLimit ?? null,
        used_count: Number(c.used_count ?? c.usedCount ?? 0),
        usedCount: Number(c.used_count ?? c.usedCount ?? 0),
        active: c.active ?? true,
        start_date: c.start_date || c.startDate || null,
        startDate: c.start_date || c.startDate || null,
        end_date: c.end_date || c.expiryDate || null,
        expiryDate: c.end_date || c.expiryDate || null,
        created_at: c.created_at || c.createdAt || new Date().toISOString()
      }));
      setCoupons(supabaseCoupons);
      const supabaseBanners = (bannersRes.data || []).map((b: any) => ({
        id: b.id,
        image: b.image || '',
        title: b.title || '',
        link: b.link || '',
        active: b.active ?? true,
        createdAt: b.created_at || new Date().toISOString()
      }));
      setBanners(supabaseBanners);
      // Fetch reviews from Supabase
      let supabaseReviews: any[] = [];
      try {
        const { data: revData, error: revErr } = await supabase
          .from('reviews')
          .select('*, products(name, images)')
          .order('created_at', { ascending: false });

        if (revErr) {
          console.warn("Error fetching reviews from Supabase:", revErr);
        } else if (revData) {
          supabaseReviews = revData.map((row: any) => {
            const prod = Array.isArray(row.products) ? row.products[0] : row.products;
            
            let commentText = row.comment || '';
            let emailVal = row.reviewer_email || '';
            let userImageVal = row.avatar_url || '';
            
            if (commentText.startsWith('{') && commentText.endsWith('}')) {
              try {
                const parsed = JSON.parse(commentText);
                if (parsed && typeof parsed === 'object') {
                  commentText = parsed.text || '';
                  emailVal = parsed.userEmail || emailVal;
                  userImageVal = parsed.userImage || userImageVal;
                }
              } catch (e) {
                // ignore
              }
            }

            return {
              id: row.id,
              user_id: row.user_id,
              product_id: row.product_id,
              userName: row.user_name || 'Anonymous',
              userEmail: emailVal,
              userImage: userImageVal,
              rating: row.rating || 5,
              comment: commentText,
              createdAt: row.created_at || new Date().toISOString(),
              likes: row.likes || 0,
              productName: prod?.name || 'Unknown Product',
              productImage: prod?.images?.[0] || '',
            };
          });
        }
      } catch (err) {
        console.error("Failed to load reviews from Supabase in AdminDashboard:", err);
      }
      setReviews(supabaseReviews);

      // Fetch and group abandoned carts from Supabase cart_items table
      let supabaseAbandonedCarts: any[] = [];
      try {
        const { data: supCartItems, error: supCartErr } = await supabase
          .from('cart_items')
          .select('*, products(*), profiles(*)');

        if (supCartErr) {
          console.warn("Error fetching cart items from Supabase in AdminDashboard:", supCartErr);
        } else if (supCartItems) {
          const groupedCartsMap = new Map<string, any>();

          supCartItems.forEach(row => {
            const userId = row.user_id;
            if (!userId) return;

            const p = Array.isArray(row.products) ? row.products[0] : row.products;
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

            if (!p) return;

            const itemPrice = Number(p.price || 0);
            const itemQty = Number(row.quantity || 1);
            const itemTotal = itemPrice * itemQty;

            const cartItem = {
              id: p.id,
              name: p.name || '',
              price: itemPrice,
              quantity: itemQty,
              selectedSize: row.size || '',
              selectedColor: row.color || '',
              image: (p.images && p.images.length > 0) ? p.images[0] : ''
            };

            if (!groupedCartsMap.has(userId)) {
              groupedCartsMap.set(userId, {
                id: userId,
                userId: userId,
                userEmail: profile?.email || 'Registered User',
                userName: profile?.display_name || 'User',
                status: 'active',
                items: [cartItem],
                totalAmount: itemTotal,
                updatedAt: row.updated_at || row.created_at || new Date().toISOString()
              });
            } else {
              const existingCart = groupedCartsMap.get(userId);
              existingCart.items.push(cartItem);
              existingCart.totalAmount += itemTotal;
              
              const rowTime = new Date(row.updated_at || row.created_at || 0).getTime();
              const existingTime = new Date(existingCart.updatedAt).getTime();
              if (rowTime > existingTime) {
                existingCart.updatedAt = row.updated_at || row.created_at;
              }
            }
          });

          supabaseAbandonedCarts = Array.from(groupedCartsMap.values());
        }
      } catch (e) {
        console.error("Exception fetching Supabase cart items in AdminDashboard:", e);
      }

      setAbandonedCarts(supabaseAbandonedCarts);
      setLiveSessions(sessionsRes.data || []);
      const supabasePromotions = (promotionsRes.data || []).map((p: any) => ({
        ...p,
        id: p.id,
        name: p.name,
        description: p.description || '',
        priority: p.priority ?? 1,
        status: p.status || 'draft',
        type: p.type || 'bxgy',
        conditions: p.conditions || { minCartValue: 0, minQuantity: 0, productIds: [], categoryIds: [], userType: 'all', startDate: '', endDate: '' },
        bxgyConfig: p.bxgy_config || p.bxgyConfig || { buyQty: 2, getQty: 1, applyOn: 'same', maxFree: 1, repeat: false },
        reward: p.reward || { method: 'auto', value: 100 },
        limits: p.limits || { perUser: 1, totalUsage: 100, maxDiscount: 0 },
        stackable: p.stackable ?? false,
        created_at: p.created_at || p.createdAt || new Date().toISOString()
      }));
      setPromotions(supabasePromotions);
    } catch (error) {
      handleDatabaseError(error, OperationType.LIST, 'Multiple Collections (Bulk Fetch)');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshOrders = async () => {
    setIsRefreshingOrders(true);
    try {
      await fetchDashboardData();
      toast.success("Orders refreshed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to refresh orders");
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  useEffect(() => {
    if (!selectedChat) return;

    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', selectedChat.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("Error loading chat messages:", error);
          return;
        }

        if (data && isMounted) {
          const msgs = data.map((m: any) => ({
            id: m.id,
            chat_id: m.chat_id,
            senderId: m.sender_role === 'admin' ? 'admin' : m.sender_id,
            senderRole: m.sender_role,
            text: m.message,
            type: (m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://')) ? 'image' : 'text',
            image: (m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://')) ? m.message : undefined,
            is_read: m.is_read,
            createdAt: m.created_at
          }));
          setChatMessages(msgs);
        }

        // Mark messages as read by admin when chat is opened
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .eq('chat_id', selectedChat.id)
          .eq('sender_role', 'user')
          .eq('is_read', false);

        if (isMounted) {
          setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, unreadCountAdmin: 0 } : c));
        }
      } catch (err) {
        console.error("Error fetching admin chat messages:", err);
      }
    };

    fetchMessages();

    // Real-time subscription so new customer messages appear instantly
    const channel = supabase
      .channel(`admin_chat_msgs_${selectedChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${selectedChat.id}`
        },
        (payload) => {
          const m = payload.new;
          if (!m) return;

          setChatMessages((prev) => {
            if (prev.some(item => item.id === m.id)) return prev;
            return [...prev, {
              id: m.id,
              chat_id: m.chat_id,
              senderId: m.sender_role === 'admin' ? 'admin' : m.sender_id,
              senderRole: m.sender_role,
              text: m.message,
              type: (m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://')) ? 'image' : 'text',
              image: (m.message?.startsWith('data:image/') || m.message?.startsWith('http://') || m.message?.startsWith('https://')) ? m.message : undefined,
              is_read: m.is_read,
              createdAt: m.created_at
            }];
          });

          if (m.sender_role === 'user') {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', m.id)
              .then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendAdminMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!selectedChat || (!adminMessage.trim() && !imageUrl)) return;

    const text = adminMessage.trim();
    const messageContent = imageUrl || text;
    setAdminMessage('');

    try {
      const nowIso = new Date().toISOString();

      // 1. Insert into chat_messages with sender_role = 'admin'
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChat.id,
          sender_id: user?.uid || user?.id || 'admin',
          sender_role: 'admin',
          message: messageContent,
          is_read: false,
          created_at: nowIso
        });

      if (msgErr) throw msgErr;

      // 2. Update chats.last_message and chats.last_message_at
      await supabase
        .from('chats')
        .update({
          last_message: imageUrl ? 'Sent an image' : text,
          last_message_at: nowIso,
          status: 'open'
        })
        .eq('id', selectedChat.id);

    } catch (error) {
      console.error("Error sending admin message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleAdminImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      handleSendAdminMessage(undefined, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete(orderId);
    setDeleteOrderModalOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete);

      if (error) throw error;

      setOrders(orders.filter(o => o.id !== orderToDelete));
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    } finally {
      setDeleteOrderModalOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const updates: any = { status: newStatus };
      if (newStatus === 'Returned') {
        updates.returnStatus = 'Approved';
      } else if (newStatus === 'Cancelled' || newStatus === 'Refunded') {
        updates.returnStatus = 'Rejected';
      }
      
      const mapClientStatusToSupabase = (clientStatus: string): string => {
        const normalized = clientStatus.toLowerCase().trim();
        if (normalized === 'pending') return 'pending';
        if (normalized === 'paid') return 'pending';
        if (normalized === 'processing') return 'processing';
        if (normalized === 'packed') return 'packed';
        if (normalized === 'shipped') return 'shipped';
        if (normalized === 'in delivery' || normalized === 'out for delivery' || normalized === 'out_for_delivery') return 'out_for_delivery';
        if (normalized === 'delivered') return 'delivered';
        if (normalized === 'cancelled' || normalized === 'refunded' || normalized === 'return requested' || normalized === 'returned') return 'cancelled';
        return 'pending';
      };

      const dbStatus = mapClientStatusToSupabase(newStatus);

      const { error: supErr } = await supabase
        .from('orders')
        .update({
          status: dbStatus,
          return_status: updates.returnStatus || order?.returnStatus || null
        })
        .eq('id', orderId);

      if (supErr) throw supErr;
      
      // Send OneSignal templated push notification & email to customer
      if (order && order.userId && order.userId !== 'guest') {
        try {
          // Identify template key
          let templateKey = '';
          if (newStatus === 'Shipped') templateKey = 'shipped';
          else if (newStatus === 'Processing') templateKey = 'packed';
          else if (newStatus === 'In Delivery') templateKey = 'out_for_delivery';
          else if (newStatus === 'Delivered') templateKey = 'delivered';
          else if (newStatus === 'Cancelled') templateKey = 'cancelled';
          else if (newStatus === 'Refunded') templateKey = 'refund_completed';

          if (templateKey) {
            // Send templated high-fidelity push
            fetch('/api/send-templated-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateKey,
                userId: order.userId,
                params: {
                  customerName: order.address?.name || 'Customer',
                  orderId: order.orderId
                },
                options: { url: '/my-orders' }
              })
            }).catch(pushErr => console.error("Failed to send status update push:", pushErr));
          }

          // Email
          if (order.address?.email) {
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: order.address.email,
                subject: `Order Update: ${order.orderId} is ${newStatus} 📦`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; padding: 40px 20px; color: #FFFFFF; line-height: 1.5;">
                    <div style="max-width: 500px; margin: 0 auto;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                        <span style="font-size: 14px; font-weight: 500; color: #FFFFFF;">Order ${order.orderId}</span>
                        <span style="font-size: 14px; font-weight: 500; color: #E11D48; text-transform: lowercase;">update</span>
                      </div>

                      <div style="margin-bottom: 40px;">
                        <h1 style="font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">Order Status Update</h1>
                        <p style="font-size: 16px; color: #888888; margin: 0;">Hi ${order.address.name},</p>
                        <p style="font-size: 16px; color: #888888; margin: 16px 0 0 0;">The status of your order <strong>${order.orderId}</strong> has been updated to <strong>${newStatus}</strong>.</p>
                      </div>

                      <div style="margin-bottom: 40px; text-align: center;">
                        <a href="${window.location.origin}/my-orders" 
                           style="display: block; background-color: #FFFFFF; color: #000000; padding: 18px; border-radius: 4px; text-decoration: none; font-size: 16px; font-weight: 500; text-align: center;">
                          View My Order
                        </a>
                      </div>

                      <div style="margin-top: 60px; text-align: center; border-top: 1px solid #1A1A1A; padding-top: 40px;">
                        <p style="font-size: 14px; font-weight: 500; color: #FFFFFF; margin: 0;">Thanks for shopping with ${settings.storeName || 'The Ruby'}</p>
                        <p style="font-size: 11px; color: #444444; margin-top: 20px;">&copy; ${new Date().getFullYear()} ${settings.storeName || 'The Ruby'}. All rights reserved.</p>
                      </div>
                    </div>
                  </div>
                `
              })
            }).catch(emailErr => console.error("Email send failed:", emailErr));
          }
        } catch (e) {
          console.error("Failed to send customer notifications:", e);
        }
      }

      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus, returnStatus: updates.returnStatus || o.returnStatus } : o));
      if (viewingCustomer && viewingCustomer.id === orderId) {
        setViewingCustomer({ ...viewingCustomer, status: newStatus, returnStatus: updates.returnStatus || viewingCustomer.returnStatus });
      }

      // Send internal notification to user (with skipPush: true to prevent double push triggers)
      if (order?.userId && order.userId !== 'guest') {
        let iconType = 'package';
        if (newStatus === 'Shipped') iconType = 'truck';
        if (newStatus === 'Delivered') iconType = 'success';
        
        await sendNotification({
          userId: order.userId,
          title: `Order ${newStatus}`,
          body: `Your order ${order.orderId} status has been updated to ${newStatus}.`,
          type: 'order',
          iconType: iconType,
          link: '/my-orders'
        }, true);
      }

      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleUpdateReturnStatus = async (orderId: string, returnStatus: string, adminNotes?: string) => {
    const loadingToast = toast.loading(`Updating return status to ${returnStatus}...`);
    try {
      const order = orders.find(o => o.id === orderId);
      const updates: any = { return_status: returnStatus };
      if (adminNotes) {
        updates.return_admin_notes = adminNotes;
      }

      const { error: supErr } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (supErr) {
        console.error("Supabase Error updating return status:", supErr);
        throw supErr;
      }

      // Send customer notification if applicable
      if (order && order.userId && order.userId !== 'guest') {
        try {
          let templateKey = '';
          if (returnStatus === 'Approved') templateKey = 'return_approved';
          else if (returnStatus === 'Rejected') templateKey = 'return_rejected';
          else if (returnStatus === 'Refunded' || returnStatus === 'Refund Completed') templateKey = 'refund_completed';

          if (templateKey) {
            fetch('/api/send-templated-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                templateKey,
                userId: order.userId || order.user_id,
                params: {
                  customerName: order.address?.name || order.shipping_full_name || 'Customer',
                  orderId: order.orderId || order.order_number || order.id,
                  reason: adminNotes || 'Does not meet return policy requirements'
                },
                options: { url: '/my-orders' }
              })
            }).catch(e => console.error("Return notification fetch error:", e));
          }
        } catch (e) {
          console.error("Failed to notify user of return status update:", e);
        }
      }

      // Update local orders list state
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            returnStatus,
            returnAdminNotes: adminNotes || o.returnAdminNotes,
            return_admin_notes: adminNotes || o.return_admin_notes
          };
        }
        return o;
      }));

      if (viewingCustomer && viewingCustomer.id === orderId) {
        setViewingCustomer((prev: any) => ({
          ...prev,
          returnStatus,
          returnAdminNotes: adminNotes || prev?.returnAdminNotes,
          return_admin_notes: adminNotes || prev?.return_admin_notes
        }));
      }

      toast.success(`Return status updated to ${returnStatus}`, { id: loadingToast });
    } catch (err: any) {
      console.error("Error updating return status (Full Error Object):", err);
      toast.error(`Failed to update return status: ${err?.message || 'Database error'}`, { id: loadingToast });
    }
  };

  const ADMIN_RETURN_STAGES = [
    { key: 'requested', label: 'Requested' },
    { key: 'approved', label: 'Approved' },
    { key: 'picked up', label: 'Picked Up' },
    { key: 'refunded', label: 'Refunded' },
  ];

  const renderAdminReturnCard = (order: any) => {
    if (!order || (!order.returnReason && !order.returnStatus && !order.return_reason && !order.return_status)) return null;

    const currentReturnStatus = order.returnStatus || order.return_status || 'requested';
    const isRejected = currentReturnStatus.toLowerCase() === 'rejected';
    const normStatus = currentReturnStatus.toLowerCase();

    let stageIndex = 0;
    if (normStatus === 'approved') stageIndex = 1;
    else if (normStatus === 'picked up' || normStatus === 'picked_up') stageIndex = 2;
    else if (normStatus === 'refunded') stageIndex = 3;

    return (
      <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-5 shadow-sm space-y-4 my-4">
        <div className="flex items-center justify-between border-b border-purple-200/60 pb-3">
          <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
            <RotateCcw size={16} className="text-purple-600" />
            <span>Return Request Details</span>
          </h3>
          <span className={cn(
            "text-xs font-bold px-3 py-1 rounded-full border capitalize",
            isRejected ? "bg-red-100 text-red-700 border-red-200" :
            normStatus === 'refunded' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
            normStatus === 'approved' ? "bg-blue-100 text-blue-800 border-blue-200" :
            normStatus === 'picked up' ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
            "bg-purple-100 text-purple-800 border-purple-200"
          )}>
            {currentReturnStatus}
          </span>
        </div>

        {/* REASON & COMMENTS */}
        <div className="space-y-1 text-xs text-purple-950">
          <p><span className="font-semibold text-purple-900">Reason:</span> {order.returnReason || order.return_reason || 'Standard Return'}</p>
          {(order.returnComments || order.return_comments) && (
            <p className="text-purple-800 italic bg-purple-100/50 p-2.5 rounded-xl border border-purple-200/50 mt-1">
              "{order.returnComments || order.return_comments}"
            </p>
          )}
          {(order.returnAdminNotes || order.return_admin_notes) && (
            <p className="text-red-900 bg-red-100/80 p-2.5 rounded-xl border border-red-200 font-medium mt-2">
              <span className="font-bold text-red-950">Return Rejected:</span> {order.returnAdminNotes || order.return_admin_notes}
            </p>
          )}
          {(order.returnRequestedAt || order.return_requested_at) && (
            <p className="text-[11px] text-purple-600 pt-1">
              Requested on: {new Date(order.returnRequestedAt || order.return_requested_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* RETURN PROGRESS TRACKER */}
        {!isRejected && (
          <div className="py-2">
            <div className="relative flex items-center justify-between">
              <div className="absolute top-3.5 left-5 right-5 h-1 bg-purple-200/80 rounded-full z-0" />
              <div 
                className="absolute top-3.5 left-5 h-1 bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full transition-all duration-500 z-0"
                style={{ width: `${(stageIndex / (ADMIN_RETURN_STAGES.length - 1)) * 85}%` }}
              />
              {ADMIN_RETURN_STAGES.map((stg, idx) => {
                const isStepDone = idx < stageIndex || (idx === stageIndex && normStatus === 'refunded');
                const isCurrActive = idx === stageIndex && !isStepDone;
                return (
                  <div key={stg.key} className="relative z-10 flex flex-col items-center">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] transition-all shadow-sm",
                      isStepDone ? "bg-emerald-500 text-white ring-2 ring-emerald-100" :
                      isCurrActive ? "bg-purple-600 text-white ring-2 ring-purple-200 scale-110 shadow" :
                      "bg-white border-2 border-purple-200 text-purple-300"
                    )}>
                      {isStepDone ? <Check size={14} /> : isCurrActive ? <RotateCcw size={12} /> : idx + 1}
                    </div>
                    <span className={cn(
                      "mt-1.5 text-[11px] transition-all",
                      isStepDone ? "font-semibold text-emerald-800" :
                      isCurrActive ? "font-bold text-purple-950" :
                      "font-medium text-gray-400"
                    )}>
                      {stg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DYNAMIC ACTION BUTTONS */}
        <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-purple-200/60">
          {(normStatus === 'requested' || normStatus === 'pending') && (
            <>
              <button
                onClick={() => handleUpdateReturnStatus(order.id, 'Approved')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Approve Return</span>
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Reason for rejecting this return request?");
                  if (reason !== null) {
                    handleUpdateReturnStatus(order.id, 'Rejected', reason);
                  }
                }}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all border border-red-200 flex items-center gap-1.5"
              >
                <X size={14} />
                <span>Reject Request</span>
              </button>
            </>
          )}

          {normStatus === 'approved' && (
            <>
              <button
                onClick={() => handleUpdateReturnStatus(order.id, 'Picked Up')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Truck size={14} />
                <span>Mark Picked Up</span>
              </button>
              <button
                onClick={() => handleUpdateReturnStatus(order.id, 'Refunded')}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Mark Picked Up & Refund</span>
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Reason for rejecting return?");
                  if (reason !== null) {
                    handleUpdateReturnStatus(order.id, 'Rejected', reason);
                  }
                }}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <X size={14} />
                <span>Reject</span>
              </button>
            </>
          )}

          {normStatus === 'picked up' && (
            <>
              <button
                onClick={() => handleUpdateReturnStatus(order.id, 'Refunded')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Process Refund</span>
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Reason for rejecting return?");
                  if (reason !== null) {
                    handleUpdateReturnStatus(order.id, 'Rejected', reason);
                  }
                }}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <X size={14} />
                <span>Reject</span>
              </button>
            </>
          )}

          {normStatus === 'refunded' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 size={14} />
              <span>Refund Processed & Completed</span>
            </span>
          )}

          {isRejected && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
              <XCircle size={14} />
              <span>Return Request Rejected</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleAddOrder = async () => {
    try {
      let formattedOrderId = '';
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('generate_order_number');
        if (rpcErr) {
          console.warn("Supabase generate_order_number RPC failed:", rpcErr);
          formattedOrderId = `#TRF${Math.floor(1000 + Math.random() * 9000)}`;
        } else {
          formattedOrderId = rpcData;
        }
      } catch (rpcEx) {
        console.warn("Supabase generate_order_number RPC exception:", rpcEx);
        formattedOrderId = `#TRF${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const orderId = formattedOrderId;
      const newOrderPayload = {
        order_number: orderId,
        items: [],
        total: 0,
        subtotal: 0,
        discount: 0,
        shipping_cost: 0,
        cod_fee: 0,
        shipping_method: 'Standard Delivery',
        estimated_delivery: '2-5 Days',
        payment_id: 'COD',
        status: 'pending',
        payment_method: 'COD',
        payment_status: 'Pending',
        user_id: 'guest',
        shipping_full_name: 'Manual Order',
        shipping_phone: '0000000000',
        customer_email: 'admin@theruby.com',
        shipping_address: 'Store Pickup',
        shipping_city: 'Store City',
        shipping_zip: '000000',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('orders')
        .insert(newOrderPayload);

      if (error) throw error;

      toast.success(`Order ${orderId} added successfully`);
      fetchDashboardData();
    } catch (error) {
      console.error('Error adding order:', error);
      toast.error('Failed to add order');
    }
  };

  const filteredOrders = orders.filter(order => {
    const customerName = (order.address?.name || order.customerName || order.customer || '').toLowerCase();
    const orderId = (order.orderId || order.id || '').toLowerCase();
    const matchesSearch = customerName.includes(orderSearchTerm.toLowerCase()) || 
                         orderId.includes(orderSearchTerm.toLowerCase());
    
    let matchesTab = true;
    if (orderTab === 'unfulfilled') matchesTab = order.fulfillmentStatus !== 'Fulfilled';
    else if (orderTab === 'paid_unful') matchesTab = (order.status === 'Shipped' || order.status === 'Delivered' || order.status === 'Paid' || order.status === 'Confirmed') && order.fulfillmentStatus !== 'Fulfilled';
    else if (orderTab === 'open') matchesTab = order.status !== 'Delivered' && order.status !== 'Cancelled';
    else if (orderTab === 'delivered') matchesTab = order.status === 'Delivered';
    else if (orderTab === 'onhold') matchesTab = order.fulfillmentStatus === 'On Hold';
    else if (orderTab === 'closed') matchesTab = order.status === 'Delivered' || order.status === 'Cancelled';

    const matchesStatus = orderStatusFilter === 'All Status' || order.status === orderStatusFilter || getEffectiveOrderStatus(order) === orderStatusFilter;
    
    let matchesDate = true;
    if (orderStartDate || orderEndDate) {
      const orderDate = ensureDate(order.createdAt);
      if (orderStartDate) {
        const start = new Date(orderStartDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) matchesDate = false;
      }
      if (orderEndDate) {
        const end = new Date(orderEndDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate && matchesTab;
  });

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return filteredOrders.slice(start, start + entriesPerPage);
  }, [filteredOrders, currentPage, entriesPerPage]);

  const orderStats = useMemo(() => {
    const rev = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => {
      const d = ensureDate(o.createdAt);
      return d.toDateString() === today;
    });
    const todaySales = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const unful = orders.filter(o => o.fulfillmentStatus !== 'Fulfilled').length;
    const aov = orders.length > 0 ? Math.round(rev / orders.length) : 0;

    return [
      { label: 'Total Revenue', value: `₹${rev.toLocaleString('en-IN')}`, change: '↑ 18.4%', up: true, icon: TrendingUp, color: 'text-ruby', bgColor: 'bg-ruby/10', data: [30, 45, 35, 50, 40, 60, 55] },
      { label: "Today's Sales", value: `₹${todaySales.toLocaleString('en-IN')}`, change: '↑ 12.1%', up: true, icon: ShoppingBag, color: 'text-blue-500', bgColor: 'bg-blue-50', data: [20, 30, 25, 40, 35, 45, 40] },
      { label: 'Orders List', value: filteredOrders.length, change: '+24 this week', up: true, icon: Hash, color: 'text-emerald-500', bgColor: 'bg-emerald-50', data: [15, 25, 20, 35, 30, 40, 35] },
      { label: 'Unfulfilled', value: unful, change: unful > 0 ? 'ACTION' : 'STABLE', up: unful === 0, icon: AlertCircle, color: 'text-amber-500', bgColor: 'bg-amber-50', data: [5, 10, 8, 15, 12, 10, 8] },
      { label: 'Avg. Order', value: `₹${aov.toLocaleString('en-IN')}`, change: '↑ 5.2%', up: true, icon: Activity, color: 'text-purple-500', bgColor: 'bg-purple-50', data: [28, 35, 30, 42, 38, 45, 40] },
    ];
  }, [orders, filteredOrders]);

  const ORDER_TABS = [
    { id: 'all', label: 'All' },
    { id: 'unfulfilled', label: 'Unfulfilled' },
    { id: 'paid_unful', label: 'Paid' },
    { id: 'open', label: 'Open' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'onhold', label: 'On hold' },
    { id: 'closed', label: 'Closed' }
  ];

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Fetch categories from Supabase
      let supabaseCategories: any[] = [];
      const { data: supCategories } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (supCategories) {
        supabaseCategories = supCategories.map(c => ({
          id: c.id,
          name: c.name || '',
          image: c.image || '',
          slug: c.slug || '',
          sortOrder: c.sort_order !== undefined ? Number(c.sort_order) : 1000,
          createdAt: c.created_at || new Date().toISOString()
        }));
      }

      // Fetch products from Supabase
      const { data: supProducts } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (supProducts) {
        const categoryMap: Record<string, string> = {};
        supabaseCategories.forEach(c => {
          categoryMap[c.id] = c.name;
        });
        const mapped = supProducts.map(p => mapSupabaseProduct(p, categoryMap));
        setProducts(mapped);
      }
      if (supabaseCategories.length > 0) {
        setCategories(supabaseCategories);
      }
    } catch (error) {
      console.error("Error fetching products from Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('phone_user');
    await supabase.auth.signOut();
    navigate('/login');
    window.location.reload();
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.price < 0 || !formData.category || (Array.isArray(formData.category) && formData.category.length === 0)) {
      toast.error("Name, Price, and at least one Category are required!");
      return;
    }

    setLoading(true);
    const uploadToast = toast.loading("Saving product details...");
    
    try {
      // Parallel Image Upload Logic with longer timeout to avoid hanging
      const uploadPromises = formData.images.map(async (img: string, index: number) => {
        if (!img || img.trim() === '') return null;
        
        if (img.startsWith('data:image')) {
          try {
            const fileName = `products/${Date.now()}_img${index}_${Math.random().toString(36).substring(7)}.jpg`;
            const blob = base64ToBlob(img);
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            const { data, error } = await supabase.storage.from('products').upload(fileName, file);
            if (!error && data) {
              const { data: pubUrl } = supabase.storage.from('products').getPublicUrl(data.path);
              return pubUrl.publicUrl;
            }
            return img; 
          } catch (uploadError: any) {
            console.warn("Storage upload skip/fail, fallback check:", uploadError);
            return img; 
          }
        }
        return img;
      });

      const uploadedImages = (await Promise.all(uploadPromises)).filter(img => img !== null);
      
      // Secondary check: Total payload size check (rough estimate)
      const totalSize = JSON.stringify(uploadedImages).length;
      if (totalSize > 900000) {
         throw new Error("Total document size (with images) exceeds the 1MB limit. Please reduce image count or size.");
      }

      const productData = {
        ...formData,
        images: uploadedImages,
        price: Number(formData.price) || 0,
        stock: Number(formData.stock) || 0,
        comparePrice: Number(formData.comparePrice) || 0,
        updatedAt: new Date().toISOString()
      };

      // Run health check before write
      const health = checkProductHealth(productData);
      if (!health.isValid) {
        console.warn(`[Product Diagnostic - Health Check Warn during Product Save] Product "${productData.name}" is unhealthy:`, health.errors, health.warnings);
      }

      // Build a map of Category Name -> Category ID from state categories
      const nameToIdMap: Record<string, string> = {};
      categories.forEach(c => {
        if (c.name && c.id) {
          nameToIdMap[c.name] = c.id;
        }
      });

      const categoryIds = (formData.category || [])
        .map((name: string) => nameToIdMap[name])
        .filter(Boolean);

      const supabaseProductPayload: any = {
        name: productData.name,
        description: productData.description || '',
        price: Number(productData.price) || 0,
        compare_price: Number(productData.comparePrice) || 0,
        category_ids: categoryIds,
        sizes: Array.isArray(productData.sizes) ? productData.sizes : [],
        images: Array.isArray(productData.images) ? productData.images : [],
        stock: Number(productData.stock) || 0,
        stock_status: productData.stockStatus || 'In Stock',
        is_trending: !!productData.isTrending,
        is_popular: !!productData.isPopular,
        sku: productData.sku || null,
        barcode: productData.barcode || null,
        weight: productData.weight || null,
        dimensions: productData.dimensions || null,
        seo_title: productData.seoTitle || null,
        seo_description: productData.seoDescription || null,
        variants: productData.variants || [],
        updated_at: new Date().toISOString()
      };

      if (editingProduct) {
        const { error: updateErr } = await supabase
          .from('products')
          .update(supabaseProductPayload)
          .eq('id', editingProduct.id);

        if (updateErr) throw updateErr;

        logProductDiagnostics('Saved', { id: editingProduct.id, name: productData.name });
        toast.success("Product updated!", { id: uploadToast });
      } else {
        const fullSupabaseProductPayload = {
          ...supabaseProductPayload,
          created_at: new Date().toISOString()
        };

        const { data: insertedProd, error: insertErr } = await supabase
          .from('products')
          .insert(fullSupabaseProductPayload)
          .select()
          .single();

        if (insertErr) throw insertErr;

        const insertedId = insertedProd?.id || 'new_id';
        const productName = productData.name || formData.name;
        logProductDiagnostics('Saved', { id: insertedId, name: productName });
        toast.success("Product added successfully!", { id: uploadToast });

        if (formData.notifySubscribers !== false) {
          fetch('/api/send-user-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: 'broadcast',
              title: '✨ New Arrival!',
              body: `Check out our new product: ${productName}`,
              url: `/product/${insertedId}`
            })
          }).catch(err => console.error("Broadcast push error:", err));
        }
      }

      // CLOSE UI FIRST for speed
      setShowAddProductPage(false);
      setEditingProduct(null);
      setLoading(false);
      
      // Reset form
      setFormData({ 
        name: '', 
        description: '', 
        price: 0, 
        category: [], 
        sizes: sizes.length > 0 ? sizes.map((s: any) => s.name) : ['S', 'M', 'L', 'XL'], 
        images: [''], 
        stock: 10,
        comparePrice: 0,
        updatedAt: '',
        stockStatus: 'In Stock',
        seoTitle: '',
        seoDescription: '',
        weight: '',
        dimensions: '',
        sku: '',
        barcode: '',
        isTrending: false,
        isPopular: false,
        notifySubscribers: true,
        variants: []
      });

      // Fetch products without blocking
      fetchProducts();

    } catch (error: any) {
      toast.dismiss(uploadToast);
      console.error("Critical save error:", error);
      
      let errorMsg = "Something went wrong. Please refresh the page.";
      if (error.message && error.message.includes('too large')) {
         errorMsg = "The image is too large! Please use a smaller size.";
      } else if (error.message && (error.message.includes('permission-denied') || error.message.includes('permissions'))) {
         errorMsg = "You do not have permission to save data.";
      }
      
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setProductToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    console.log("Attempting to delete product from Supabase:", productToDelete);
    const deleteToast = toast.loading("Deleting product...");
    try {
      const { error: delErr } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete);

      if (delErr) throw delErr;

      console.log("Delete successful for:", productToDelete);
      toast.success("Product deleted", { id: deleteToast });
      fetchDashboardData();
    } catch (error: any) {
      console.error("Delete error for ID:", productToDelete, error);
      toast.error("Failed to delete product: " + (error.message || String(error)), { id: deleteToast });
    } finally {
      setDeleteModalOpen(false);
      setProductToDelete(null);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBulk(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          let successCount = 0;
          let failCount = 0;
          let lastError = "";

          for (const item of data) {
            if (item.name && item.price) {
              try {
                const productCategory = item.category 
                  ? String(item.category).split(',').map((c: string) => c.trim()).filter(Boolean) 
                  : ['Women'];

                const nameToIdMap: Record<string, string> = {};
                categories.forEach(c => {
                  if (c.name && c.id) {
                    nameToIdMap[c.name] = c.id;
                  }
                });

                const categoryIds = productCategory
                  .map((name: string) => nameToIdMap[name])
                  .filter(Boolean);

                const newProdData = {
                  name: String(item.name),
                  price: Number(item.price) || 0,
                  description: String(item.description || ''),
                  category: productCategory,
                  stock: Number(item.stock) || 0,
                  images: item.images ? String(item.images).split(',').map((imgUrl: string) => imgUrl.trim()).filter(Boolean) : [],
                  createdAt: new Date().toISOString(),
                  status: 'active',
                  sku: item.sku || `BULK-${Math.random().toString(36).substring(7).toUpperCase()}`,
                  comparePrice: Number(item.comparePrice) || 0
                };

                // Run a quick health check before writing
                const health = checkProductHealth(newProdData);
                if (!health.isValid) {
                  console.warn(`[Product Diagnostic - Health Check Warn during Bulk Import] Product "${newProdData.name}" is unhealthy:`, health.errors, health.warnings);
                }

                const supabaseProductPayload: any = {
                  name: newProdData.name,
                  description: newProdData.description || '',
                  price: Number(newProdData.price) || 0,
                  compare_price: Number(newProdData.comparePrice) || 0,
                  category_ids: categoryIds,
                  sizes: ['S', 'M', 'L', 'XL'],
                  images: Array.isArray(newProdData.images) ? newProdData.images : [],
                  stock: Number(newProdData.stock) || 0,
                  stock_status: 'In Stock',
                  sku: newProdData.sku || null,
                  created_at: new Date().toISOString()
                };

                const { error: bulkInsertErr } = await supabase
                  .from('products')
                  .insert(supabaseProductPayload);

                if (bulkInsertErr) throw bulkInsertErr;

                logProductDiagnostics('Saved', { name: newProdData.name });
                successCount++;
              } catch (err: any) {
                console.error("Bulk Item Error:", err);
                failCount++;
                lastError = err.message || String(err);
              }
            }
          }
          
          if (failCount > 0) {
            toast.warning(`Uploaded ${successCount} products, but ${failCount} failed. Last error: ${lastError}`);
          } else {
            toast.success(`Successfully uploaded ${successCount} products!`);
          }
          fetchDashboardData();
        } catch (innerError: any) {
          console.error("Reader Process Error:", innerError);
          toast.error("File processing failed: " + (innerError.message || String(innerError)));
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error("Bulk Upload Error:", error);
      toast.error("Failed to upload: " + (error.message || "Unknown error"));
    } finally {
      setIsUploadingBulk(false);
    }
  };

  const generateSalesReport = () => {
    setIsGeneratingReport(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("Sales & Revenue Report", 14, 22);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

      const tableData = orders.map(order => [
        order.id.substring(0, 8),
        order.customerName || 'N/A',
        ensureDate(order.createdAt).toLocaleDateString(),
        `Rs. ${order.totalAmount}`,
        order.status.toUpperCase()
      ]);

      autoTable(doc, {
        head: [['Order ID', 'Customer', 'Date', 'Amount', 'Status']],
        body: tableData,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72] } // Ruby color
      });

      const totalRevenue = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      doc.setFontSize(12);
      doc.text(`Total Orders: ${orders.length}`, 14, finalY + 10);
      doc.text(`Total Revenue: Rs. ${totalRevenue.toFixed(2)}`, 14, finalY + 17);

      doc.save(`Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Report generated!");
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const sendAbandonedCartReminder = async (cart: any) => {
    const toastId = toast.loading(`Sending reminder to ${cart.userEmail || 'customer'}...`);
    try {
      const sweetTitle = "Still thinking about it? 🎀";
      const sweetBody = "Aapke cart mein kuch pyare products aapka wait kar rahe hain. Jaldi aaiye aur unhe apna bnaiye! ✨";

      if (cart.userId) {
        try {
          await fetch('/api/send-user-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: cart.userId,
              title: sweetTitle,
              body: sweetBody,
              url: '/cart'
            })
          });
        } catch (pushErr) {
          console.error("Failed to send push notification:", pushErr);
        }

        try {
          await supabase.from('notifications').insert([{
            user_id: cart.userId,
            title: sweetTitle,
            body: sweetBody,
            type: 'order',
            is_read: false,
            created_at: new Date().toISOString(),
            link: '/cart'
          }]);
        } catch (error) {
          console.error("Failed inserting notification:", error);
        }
      }
      
      if (cart.userEmail) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cart.userEmail,
            subject: "A little gift is waiting in your cart! 🛍️",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a2c54; text-align: center;">
                <div style="padding: 40px 20px; background: #fff5f7; border-radius: 30px;">
                  <h1 style="color: #e11d48; margin-bottom: 20px;">Still thinking about it? 🎀</h1>
                  <p style="font-size: 16px; line-height: 1.6;">Hi there! We noticed you left some beautiful items in your cart. They are selling out fast, and we would love for you to have them!</p>
                  
                  <div style="background: white; border-radius: 20px; padding: 20px; margin: 30px 0; border: 1px solid #fee2e2;">
                    <p style="font-weight: bold; color: #e11d48; margin-bottom: 10px;">Your Shopping Bag:</p>
                    <p style="font-size: 24px; font-weight: 900; margin: 0;">₹${cart.totalAmount?.toLocaleString()}</p>
                    <p style="font-size: 12px; color: #64748b; margin-top: 5px;">${cart.items?.length || 0} Pyare items</p>
                  </div>

                  <a href="${window.location.origin}/cart" style="display: inline-block; background: #e11d48; color: white; padding: 16px 32px; border-radius: 16px; text-decoration: none; font-weight: bold; box-shadow: 0 10px 20px rgba(225, 29, 72, 0.2);">Return to Cart 🛍️</a>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Aapka wait rahega, <br/><b>The Ruby Team</b> ✨</p>
                </div>
              </div>
            `
          })
        });
      }
      toast.success('Pyara reminder bheja gaya! ✨', { id: toastId });
    } catch (error) {
      console.error("Reminder error:", error);
      if (error instanceof Error && error.message.includes('authInfo')) {
        const info = JSON.parse(error.message);
        toast.error(`Permission Denied: ${info.operationType} on ${info.path}`, { id: toastId });
      } else {
        toast.error('Bhejne mein galti hui. Kripya rules check karein.', { id: toastId });
      }
    }
  };

  const sendBulkAbandonedCartReminders = async () => {
    if (abandonedCarts.length === 0) return;
    
    if (!confirm(`Are you sure you want to send reminders to all ${abandonedCarts.length} abandoned carts?`)) return;

    const toastId = toast.loading(`Sending ${abandonedCarts.length} reminders...`);
    setIsSendingBulkReminders(true);
    let successCount = 0;

    const sweetTitle = "Missing something beautiful? 🎀";
    const sweetBody = "Aapka cart hamara wait kar raha hai. Jaldi aaiye aur apni pasand ko apna bnaiye! ✨";

    try {
      for (const cart of abandonedCarts) {
        try {
          if (cart.userId) {
            try {
              await fetch('/api/send-user-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: cart.userId,
                  title: sweetTitle,
                  body: sweetBody,
                  url: '/cart'
                })
              });
            } catch (pushErr) {
              console.error("Failed to send push notification:", pushErr);
            }

            try {
              await supabase.from('notifications').insert([{
                user_id: cart.userId,
                title: sweetTitle,
                body: sweetBody,
                type: 'order',
                is_read: false,
                created_at: new Date().toISOString(),
                link: '/cart'
              }]);
            } catch (error) {
              console.error("Failed inserting notification:", error);
            }
          }

          if (cart.userEmail) {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: cart.userEmail,
                subject: "Ready to checkout? 🛍️ Your cart is waiting!",
                html: `<div style="font-family: sans-serif; text-align: center; color: #1a2c54; padding: 40px; background: #fff5f7; border-radius: 30px;">
                        <h2 style="color: #e11d48; margin-bottom: 20px;">Come back and shop! 🎀</h2>
                        <p style="font-size: 16px; color: #475569;">Aapke cart waale items aapka wait kar rahe hain. Jaldi aaiye aur unhe apna bnaiye!</p>
                        <div style="margin: 30px 0;">
                          <a href="${window.location.origin}/cart" style="background: #e11d48; color: white; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: bold; box-shadow: 0 10px 20px rgba(225, 29, 72, 0.2);">Go to Cart 🛍️</a>
                        </div>
                        <p style="font-size: 12px; color: #94a3b8;">With love, <br/><b>The Ruby</b> ✨</p>
                      </div>`
              })
            });
          }
          successCount++;
        } catch (e) {
          console.error(`Failed to send reminder to ${cart.userEmail}:`, e);
        }
      }
      toast.success(`Sabhi ko ${successCount} reminders bhej diye gaye! ✨`, { id: toastId });
    } catch (error) {
      console.error("Bulk reminder error:", error);
      toast.error("An error occurred during bulk sending", { id: toastId });
    } finally {
      setIsSendingBulkReminders(false);
    }
  };

  const generateAICampaign = async () => {
    setIsGeneratingCampaign(true);
    const genToast = toast.loading("AI is analyzing data and generating campaign ideas...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const lowStockCount = products.filter(p => p.stock < 5).length;
      const topSelling = products.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 3).map(p => p.name).join(", ");
      const cartCount = abandonedCarts.length;
      
      const prompt = `You are a marketing expert for an Indian premium women's fashion store called "The Ruby". 
      Current Store Stats:
      - Low stock items: ${lowStockCount}
      - Top products: ${topSelling}
      - Abandoned carts: ${cartCount}
      
      Tasks:
      1. Generate 3 engaging Instagram/Facebook ad captions (with emojis).
      2. Suggest a specific Sale Campaign (e.g. "Weekend Wardrobe Refresh").
      3. Recommend a targeted discount percentage for specific categories.
      
      Return the result as a detailed JSON object.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              saleName: { type: Type.STRING },
              saleLogic: { type: Type.STRING },
              suggestedDiscount: { type: Type.NUMBER },
              adCaptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              marketingTip: { type: Type.STRING }
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      setCampaignResult(data);
      toast.success("Marketing campaign generated!", { id: genToast });
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate AI insights", { id: genToast });
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const updateLoyaltyPoints = async (userId: string, points: number, reason?: string) => {
    try {
      const res = await fetch('/api/loyalty/grant-bonus-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, points, reason: reason || 'Admin bonus points' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Granted ${points} bonus points!`);
        if (selectedCustomer && selectedCustomer.id === userId) {
          setSelectedCustomer({
            ...selectedCustomer,
            loyaltyPoints: data.newTotalPoints
          });
        }
        // Refresh loyalty logs
        try {
          const { data: logData } = await supabase
            .from('loyalty_points_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          if (logData) setCustomerLoyaltyLogs(logData);
        } catch (e) {
          console.error("Failed to refresh loyalty log:", e);
        }
        fetchDashboardData();
      } else {
        toast.error(data.error || "Failed to update points");
      }
    } catch (error) {
      console.error("Grant bonus points error:", error);
      toast.error("Failed to update points");
    }
  };

  const handleDeleteReview = (id: string) => {
    setReviewToDelete(id);
    setDeleteReviewModalOpen(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewToDelete);
      if (error) throw error;
      toast.success("Review deleted");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to delete review");
    } finally {
      setDeleteReviewModalOpen(false);
      setReviewToDelete(null);
    }
  };

  const handleSavePromotion = async () => {
    if (!promotionForm.name || !promotionForm.name.trim()) {
      toast.error("Promotion name is required");
      return;
    }

    const safeNum = (val: any, fallback = 0): number => {
      if (val === '' || val === null || val === undefined) return fallback;
      const parsed = typeof val === 'number' ? val : parseFloat(val);
      return isNaN(parsed) ? fallback : parsed;
    };

    const promoType = promotionForm.type || 'bxgy';
    const priority = safeNum(promotionForm.priority, 1);
    const buyQty = safeNum(promotionForm.bxgyConfig?.buyQty, 2);
    const getQty = safeNum(promotionForm.bxgyConfig?.getQty, 1);
    const minCartValue = safeNum(promotionForm.conditions?.minCartValue, 0);
    const minQuantity = safeNum(promotionForm.conditions?.minQuantity, 0);
    const rewardValue = safeNum(promotionForm.reward?.value, 0);
    const perUserLimit = safeNum(promotionForm.limits?.perUser, 1);
    const totalUsageLimit = safeNum(promotionForm.limits?.totalUsage, 100);
    const maxDiscountLimit = safeNum(promotionForm.limits?.maxDiscount, 0);

    if (promoType === 'bxgy' && (buyQty <= 0 || getQty <= 0)) {
      toast.error("Buy Qty and Get Qty must be greater than 0 for Buy X Get Y offers");
      return;
    }

    if ((promoType === 'percentage' || promoType === 'flat') && rewardValue <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      const promoData = {
        name: promotionForm.name.trim(),
        description: promotionForm.description ? promotionForm.description.trim() : '',
        priority: priority,
        status: promotionForm.status || 'draft',
        type: promoType,
        conditions: {
          minCartValue,
          minQuantity,
          productIds: promotionForm.conditions?.productIds || [],
          categoryIds: promotionForm.conditions?.categoryIds || [],
          userType: promotionForm.conditions?.userType || 'all',
          startDate: promotionForm.conditions?.startDate || '',
          endDate: promotionForm.conditions?.endDate || ''
        },
        bxgy_config: {
          buyQty,
          getQty,
          applyOn: promotionForm.bxgyConfig?.applyOn || 'same',
          maxFree: safeNum(promotionForm.bxgyConfig?.maxFree, 1),
          repeat: Boolean(promotionForm.bxgyConfig?.repeat)
        },
        reward: {
          method: promotionForm.reward?.method || 'auto',
          value: rewardValue
        },
        limits: {
          perUser: perUserLimit,
          totalUsage: totalUsageLimit,
          maxDiscount: maxDiscountLimit
        },
        stackable: Boolean(promotionForm.stackable),
        updated_at: new Date().toISOString()
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from('promotions')
          .update(promoData)
          .eq('id', editingPromotion.id);
        if (error) throw error;
        toast.success("Promotion updated successfully");
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert([promoData]);
        if (error) throw error;
        toast.success("Promotion created successfully");
      }

      setIsPromotionModalOpen(false);
      setEditingPromotion(null);
      setPromotionForm({
        name: '',
        description: '',
        priority: 1,
        status: 'draft',
        type: 'bxgy',
        conditions: { minCartValue: 0, minQuantity: 0, productIds: [], categoryIds: [], userType: 'all', startDate: '', endDate: '' },
        bxgyConfig: { buyQty: 2, getQty: 1, applyOn: 'same', maxFree: 1, repeat: false },
        reward: { method: 'auto', value: 100 },
        limits: { perUser: 1, totalUsage: 100, maxDiscount: 0 },
        stackable: false
      });
      fetchDashboardData();
    } catch (error: any) {
      console.error("Error saving promotion:", error);
      toast.error(error.message || "Failed to save promotion");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePromotion = async (id: string) => {
    setPromotionToDelete(id);
    setDeletePromotionModalOpen(true);
  };

  const confirmDeletePromotion = async () => {
    if (!promotionToDelete) return;
    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionToDelete);
      if (error) throw error;
      toast.success("Offer deleted permanently");
      fetchDashboardData();
    } catch (error: any) {
      console.error("Error deleting promotion:", error);
      toast.error(error.message || "Failed to delete promotion");
    } finally {
      setDeletePromotionModalOpen(false);
      setPromotionToDelete(null);
    }
  };

  const handleAddCategory = () => {
    setCategoryForm({ name: '', image: '', sortOrder: '' });
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: any) => {
    setCategoryForm({ name: cat.name || '', image: cat.image || '', sortOrder: cat.sortOrder !== undefined ? String(cat.sortOrder) : '' });
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) return;
    
    const isEdit = !!editingCategory;
    const actionLabel = isEdit ? "Updating category..." : "Adding category...";
    const successLabel = isEdit ? "Category updated" : "Category added";
    const saveToast = toast.loading(actionLabel);
    setLoading(true);
    try {
      const slug = categoryForm.name.toLowerCase().replace(/ /g, '-');
      const sortOrderNum = categoryForm.sortOrder ? parseInt(categoryForm.sortOrder, 10) : 0;
      
      const supabaseCategoryPayload: any = {
        name: categoryForm.name,
        image: categoryForm.image || '',
        slug,
        sort_order: isNaN(sortOrderNum) ? 0 : sortOrderNum
      };

      if (isEdit) {
        const { error: catUpdateErr } = await supabase
          .from('categories')
          .update(supabaseCategoryPayload)
          .eq('id', editingCategory.id);

        if (catUpdateErr) throw catUpdateErr;
      } else {
        const fullPayload = {
          ...supabaseCategoryPayload,
          created_at: new Date().toISOString()
        };
        const { error: catInsertErr } = await supabase
          .from('categories')
          .insert(fullPayload);

        if (catInsertErr) throw catInsertErr;
      }
      
      toast.success(successLabel, { id: saveToast });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      fetchDashboardData();
    } catch (error: any) {
      console.error("Save category error:", error);
      
      let errorMsg = isEdit ? 'Failed to update category' : 'Failed to add category';
      if (error.code === 'permission-denied') {
        errorMsg = 'Permission denied. Only admins can modify categories.';
      } else if (error.message && error.message.includes('too large')) {
        errorMsg = 'Category image is too large. Please use a smaller image.';
      }
      
      toast.error(errorMsg + ": " + (error.message || String(error)), { id: saveToast });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoryToDelete(id);
    setDeleteCategoryModalOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const deleteToast = toast.loading("Deleting category...");
    try {
      const { error: catDelErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryToDelete);

      if (catDelErr) throw catDelErr;

      toast.success('Category deleted', { id: deleteToast });
      fetchDashboardData();
    } catch (error: any) {
      console.error("Delete category error:", error);
      toast.error('Failed to delete category: ' + (error.message || String(error)), { id: deleteToast });
    } finally {
      setDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleAddColor = () => {
    setColorForm({ name: '', hex: '#000000' });
    setIsColorModalOpen(true);
  };

  const handleSaveColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colorForm.name || !colorForm.hex) return;
    try {
      await supabase.from('colors').insert([{
        name: colorForm.name,
        hex: colorForm.hex
      }]);
      toast.success('Color added');
      setIsColorModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add color');
    }
  };

  const handleDeleteColor = async (id: string) => {
    setGenericDeleteModal({
      isOpen: true,
      title: 'Delete Color',
      message: 'Are you sure you want to delete this color option?',
      onConfirm: async () => {
        try {
          await supabase.from('colors').delete().eq('id', id);
          toast.success('Color deleted');
          fetchDashboardData();
        } catch (error) {
          toast.error('Failed to delete color');
        } finally {
          setGenericDeleteModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddSize = () => {
    setSizeForm({ name: '' });
    setIsSizeModalOpen(true);
  };

  const handleSaveSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeForm.name) return;
    try {
      await supabase.from('sizes').insert([{
        name: sizeForm.name
      }]);
      toast.success('Size added');
      setIsSizeModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add size');
    }
  };

  const handleDeleteSize = async (id: string) => {
    setGenericDeleteModal({
      isOpen: true,
      title: 'Delete Size',
      message: 'Are you sure you want to delete this size option?',
      onConfirm: async () => {
        try {
          await supabase.from('sizes').delete().eq('id', id);
          toast.success('Size deleted');
          fetchDashboardData();
        } catch (error) {
          toast.error('Failed to delete size');
        } finally {
          setGenericDeleteModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({
      code: '',
      type: 'percentage',
      value: 0,
      min_cart_value: 0,
      usage_limit: '',
      active: true,
      start_date: '',
      end_date: ''
    });
    setIsCouponModalOpen(true);
  };

  const handleEditCoupon = (coupon: any) => {
    setEditingCoupon(coupon);
    setCouponForm({
      code: coupon.code || '',
      type: coupon.type || 'percentage',
      value: coupon.value ?? coupon.discount ?? 0,
      min_cart_value: coupon.min_cart_value ?? coupon.minCartValue ?? 0,
      usage_limit: (coupon.usage_limit ?? coupon.usageLimit) !== null && (coupon.usage_limit ?? coupon.usageLimit) !== undefined ? String(coupon.usage_limit ?? coupon.usageLimit) : '',
      active: coupon.active ?? true,
      start_date: coupon.start_date ? new Date(coupon.start_date).toISOString().split('T')[0] : (coupon.startDate ? new Date(coupon.startDate).toISOString().split('T')[0] : ''),
      end_date: (coupon.end_date || coupon.expiryDate) ? new Date(coupon.end_date || coupon.expiryDate).toISOString().split('T')[0] : ''
    });
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code) {
      toast.error('Coupon code is required');
      return;
    }
    const val = Number(couponForm.value ?? couponForm.discount ?? 0);
    const typeVal = couponForm.type || 'percentage';

    try {
      const codeUpper = couponForm.code.toUpperCase().trim();
      const payload: any = {
        code: codeUpper,
        type: typeVal,
        value: val,
        min_cart_value: Number(couponForm.min_cart_value || 0),
        usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : null,
        active: Boolean(couponForm.active ?? true),
        start_date: couponForm.start_date ? new Date(couponForm.start_date).toISOString() : null,
        end_date: couponForm.end_date ? new Date(couponForm.end_date).toISOString() : null
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingCoupon.id);
        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        payload.used_count = 0;
        payload.per_user_limit = 1;
        const { error } = await supabase
          .from('coupons')
          .insert([payload]);
        if (error) throw error;

        // Broadcast notifications for new coupon
        try {
          const discountText = typeVal === 'free_shipping' ? 'FREE SHIPPING' : `${val}${typeVal === 'percentage' ? '%' : ' OFF'}`;
          await sendNotification({
            title: 'New Discount Coupon! 🎟️',
            body: `Use code ${codeUpper} to get ${discountText} on your next order!`,
            type: 'coupon',
            iconType: 'tag',
            link: '/shop'
          }, true);
        } catch (e) {
          console.error("Coupon notification error:", e);
        }

        toast.success('Coupon added successfully');
      }

      setIsCouponModalOpen(false);
      setEditingCoupon(null);
      fetchDashboardData();
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast.error(error.message || 'Failed to save coupon');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    setGenericDeleteModal({
      isOpen: true,
      title: 'Delete Coupon',
      message: 'Are you sure you want to delete this discount coupon?',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('coupons')
            .delete()
            .eq('id', id);
          if (error) throw error;
          toast.success('Coupon deleted');
          fetchDashboardData();
        } catch (error: any) {
          console.error("Error deleting coupon:", error);
          toast.error(error.message || 'Failed to delete coupon');
        } finally {
          setGenericDeleteModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    try {
      await supabase.from('profiles').delete().eq('id', customerToDelete.id);
      
      try {
        await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: customerToDelete.id })
        });
      } catch (authErr) {
        console.error("Failed to delete user from Auth:", authErr);
      }

      setCustomers(customers.filter(c => c.id !== customerToDelete.id));
      if (selectedCustomer?.id === customerToDelete.id) {
        setSelectedCustomer(null);
      }
      toast.success("Customer deleted successfully");
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Failed to delete customer");
    } finally {
      setIsCustomerDeleteModalOpen(false);
      setCustomerToDelete(null);
    }
  };

  const getMostOrderedProduct = (customerId: string, customerEmail: string) => {
    const customerOrders = orders.filter(o => o.userId === customerId || o.email === customerEmail);
    const productCounts: Record<string, { name: string, count: number, image: string }> = {};
    
    customerOrders.forEach(order => {
      order.items?.forEach((item: any) => {
        const id = item.id || item.name;
        if (!productCounts[id]) {
          productCounts[id] = { name: item.name, count: 0, image: item.image };
        }
        productCounts[id].count += (item.quantity || 1);
      });
    });
    
    const sorted = Object.values(productCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  };

  const handleUpdateUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      toast.success(`User role updated to ${newRole}`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const toastId = toast.loading("Processing image...");
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 1200, 1200, 0.7);
          setBannerForm({ ...bannerForm, image: compressed });
          toast.success("Image ready", { id: toastId });
        } catch (err) {
          toast.error("Compression failed", { id: toastId });
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Upload failed", { id: toastId });
    }
  };

  const handleOpenAddBanner = () => {
    setBannerForm({ image: '', title: '', link: '', active: true });
    setBannerLinkType('link');
    setBannerLinkValue('');
    setEditingBanner(null);
    setIsBannerModalOpen(true);
  };

  const handleEditBanner = (banner: any) => {
    setBannerForm({
      image: banner.image || '',
      title: banner.title || '',
      link: banner.link || '',
      active: banner.active ?? true
    });
    if (banner.link) {
      if (banner.link.startsWith('/shop?category=')) {
        setBannerLinkType('category');
        setBannerLinkValue(decodeURIComponent(banner.link.replace('/shop?category=', '')));
      } else if (banner.link.startsWith('/product/')) {
        setBannerLinkType('product');
        setBannerLinkValue(banner.link.replace('/product/', ''));
      } else {
        setBannerLinkType('link');
        setBannerLinkValue(banner.link);
      }
    } else {
      setBannerLinkType('link');
      setBannerLinkValue('');
    }
    setEditingBanner(banner);
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.image || !bannerForm.title) {
      toast.error('Please provide an image and title');
      return;
    }
    const isEdit = !!editingBanner;
    const saveToast = toast.loading(isEdit ? 'Updating banner...' : 'Adding banner...');
    try {
      const payload = {
        image: bannerForm.image,
        title: bannerForm.title,
        link: bannerForm.link || '',
        active: bannerForm.active ?? true,
        created_at: isEdit ? (editingBanner.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      if (isEdit) {
        const { error } = await supabase
          .from('banners')
          .update(payload)
          .eq('id', editingBanner.id);
        if (error) throw error;
        toast.success('Banner updated', { id: saveToast });
      } else {
        const { error } = await supabase
          .from('banners')
          .insert(payload);
        if (error) throw error;
        toast.success('Banner added', { id: saveToast });
      }

      setIsBannerModalOpen(false);
      setBannerForm({ image: '', title: '', link: '', active: true });
      setBannerLinkType('link');
      setBannerLinkValue('');
      setEditingBanner(null);
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error saving banner to Supabase:', error);
      toast.error(`Failed to save banner: ${error.message || error}`, { id: saveToast });
    }
  };

  const handleToggleBanner = async (id: string, currentStatus: boolean) => {
    const toggleToast = toast.loading('Updating banner status...');
    try {
      const { error } = await supabase
        .from('banners')
        .update({ active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Banner ${!currentStatus ? 'activated' : 'deactivated'}`, { id: toggleToast });
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error toggling banner status:', error);
      toast.error(`Failed to update banner status: ${error.message || error}`, { id: toggleToast });
    }
  };

  const handleDeleteBanner = async (id: string) => {
    setGenericDeleteModal({
      isOpen: true,
      title: 'Delete Banner',
      message: 'Are you sure you want to delete this banner?',
      onConfirm: async () => {
        const deleteToast = toast.loading('Deleting banner...');
        try {
          const { error } = await supabase
            .from('banners')
            .delete()
            .eq('id', id);
          if (error) throw error;
          toast.success('Banner deleted', { id: deleteToast });
          fetchDashboardData();
        } catch (error: any) {
          console.error('Error deleting banner:', error);
          toast.error(`Failed to delete banner: ${error.message || error}`, { id: deleteToast });
        } finally {
          setGenericDeleteModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleFullWipe = async () => {};

  const handleCatalogWipe = async () => {};

  const menuItems = useMemo(() => [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live View', icon: Globe },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'category', label: 'Category', icon: Tags },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'returns', label: 'Returns', icon: RotateCcw },
    { id: 'colour', label: 'Colour', icon: Palette },
    { id: 'size', label: 'Size', icon: Maximize2 },
    { id: 'coupon', label: 'Coupon', icon: Ticket },
    { id: 'promotions', label: 'Promotion Engine', icon: Zap },
    { id: 'customer', label: 'Customer', icon: Users },
    { id: 'rocket', label: 'Marketing', icon: TrendingUp },
    { id: 'stats', label: 'Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'notification_logs', label: 'Notification Logs', icon: History },
    { id: 'chats', label: 'Customer Chat', icon: MessageCircle },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'abandoned', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'insights', label: 'Product Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ], []);

  const statusColors: Record<string, string> = {
    Delivered: 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20',
    Pending: 'bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20',
    Shipped: 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20',
    Cancelled: 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
    Processing: 'bg-[#FACC15]/10 text-[#854D0E] border border-[#FACC15]/20',
    Packed: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    'Out for Delivery': 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
    'In Delivery': 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
    'Return Requested': 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    'Returned': 'bg-orange-500/10 text-orange-600 border border-orange-500/20',
  };

  const statsFilteredOrders = orders.filter(order => {
    if (!order.createdAt) return true;
    const orderDate = format(new Date(order.createdAt), 'yyyy-MM-dd');
    return orderDate >= dateRange.start && orderDate <= dateRange.end;
  });

  const filteredAnalytics = dailyAnalytics.filter(day => {
    return day.date >= dateRange.start && day.date <= dateRange.end;
  });

  // Stats for Dashboard Overview
  const dashboardStats = useMemo(() => {
    const startDate = new Date(dateRange.start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    const filteredDashboardOrders = orders.filter(o => {
      const d = ensureDate(o.createdAt);
      return d >= startDate && d <= endDate;
    });

    const filteredDashboardUsers = customers.filter(u => {
      const d = ensureDate(u.createdAt);
      return d >= startDate && d <= endDate;
    });

    const revenue = filteredDashboardOrders.reduce((s, o) => s + (o.total || 0), 0);
    const ordersCount = filteredDashboardOrders.length;
    const customersCount = filteredDashboardUsers.length;
    
    const filteredDashboardChats = chats.filter(c => {
      const d = ensureDate(c.updatedAt);
      return d >= startDate && d <= endDate;
    });
    const chatsCount = filteredDashboardChats.length;
    
    // Timeframe aware sessions heuristic based on date range duration
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    let timeframeSessions = sessionsCount;
    // Heuristic: if filtering for a specific range, scale down the total sessions if they represent all time
    // But usually sessionsCount might already be for all time.
    // Let's just scale based on days if it's more than 365 (assuming sessionsCount is roughly annual)
    if (diffDays < 365) {
      const scale = diffDays / 365;
      timeframeSessions = Math.round(sessionsCount * scale);
    }
    
    // Calculate conversion
    const conversion = timeframeSessions > 0 ? ((ordersCount / timeframeSessions) * 100).toFixed(1) : (ordersCount > 0 ? "4.2" : "0.0");

    return { revenue, ordersCount, customersCount, conversion, chatsCount, timeframeSessions };
  }, [orders, customers, chats, dateRange, sessionsCount]);

  const totalSalesVal = dashboardStats.revenue;
  const totalOrdersVal = dashboardStats.ordersCount;
  const totalCustomersVal = dashboardStats.customersCount;
  const totalConversionVal = dashboardStats.conversion;
  const totalChatsVal = dashboardStats.chatsCount;
  const analyticsTotalVal = filteredAnalytics.reduce((acc, curr) => acc + (curr.total_users || 0), 0);
  const totalSessionsVal = analyticsTotalVal > 0 
    ? analyticsTotalVal + liveSessions.length 
    : (totalOrdersVal * 3) + usersCount + liveSessions.length; 
  const lowStockVal = products.filter(p => p.stock < 10).length;

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center w-full">
        <PageLoader variant="minimal" message="Cultivating Style Trends & Metrics" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex font-sans max-w-full overflow-x-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-100 transition-all duration-300 ${
          sidebarOpen 
            ? 'translate-x-0 w-64' 
            : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header - Ruby Color */}
          <div className={`p-6 flex items-center ruby-gradient ${sidebarOpen ? 'justify-start' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shadow-lg backdrop-blur-sm shrink-0">
              <Home size={24} />
            </div>
            {sidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <h2 className="text-white font-black text-lg leading-tight truncate">The Ruby Fashion</h2>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest truncate">Admin Panel</p>
              </div>
            )}
          </div>

          <nav className="flex-grow px-3 space-y-1 overflow-y-auto scrollbar-hide mt-6">
            {menuItems.map((item) => {
              if (item.id === 'settings') {
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setIsSettingsExpanded(!isSettingsExpanded);
                        if (!sidebarOpen) setSidebarOpen(true);
                      }}
                      className={`w-full flex items-center p-3 rounded-xl transition-all group relative ${
                        activeTab === 'settings' 
                          ? 'bg-ruby/10 text-ruby' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-ruby'
                      } ${sidebarOpen ? 'justify-start px-4' : 'justify-center'}`}
                    >
                      <item.icon size={22} className={activeTab === 'settings' ? 'text-ruby' : 'text-gray-400 group-hover:text-ruby'} />
                      {sidebarOpen && (
                        <>
                          <span className="ml-3 text-sm font-bold flex-grow text-left">{item.label}</span>
                          <motion.div
                            animate={{ rotate: isSettingsExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={14} />
                          </motion.div>
                        </>
                      )}
                      {activeTab === 'settings' && !sidebarOpen && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute left-0 w-1.5 h-6 bg-ruby rounded-r-full"
                        />
                      )}
                    </button>
                    
                    <AnimatePresence>
                      {isSettingsExpanded && sidebarOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-10 space-y-1"
                        >
                          {[
                            { id: 'profile', label: 'Admin Profile', icon: User },
                            { id: 'store', label: 'Store Setting', icon: Settings },
                            { id: 'promotions', label: 'Promotion Offers', icon: Ticket },
                            { id: 'push', label: 'Push Notification', icon: Bell },
                            { id: 'firebase', label: 'Firebase Status', icon: Cloud },
                            { id: 'sheets', label: 'Google Sheet URL', icon: Database },
                            { id: 'email', label: 'Email Settings', icon: Mail },
                            { id: 'sms', label: 'SMS & OTP (Compliance Local)', icon: Smartphone },
                            { id: 'security', label: 'Security & Limits', icon: Shield },
                            { id: 'sound', label: 'Notification Sound', icon: Volume2 },
                            { id: 'seo', label: 'SEO & Branding', icon: Globe },
                            { id: 'promo_ticker', label: 'Promo Ticker Bar', icon: Megaphone },
                          ].map((subItem) => (
                            <button
                              key={subItem.id}
                              onClick={() => {
                                setActiveTab('settings');
                                setActiveSettingsTab(subItem.id);
                              }}
                              className={`w-full flex items-center p-2 rounded-lg transition-all text-xs font-bold ${
                                activeTab === 'settings' && activeSettingsTab === subItem.id
                                  ? 'text-ruby bg-ruby/5'
                                  : 'text-gray-400 hover:text-ruby hover:bg-gray-50'
                              }`}
                            >
                              <span>{subItem.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as Tab);
                    setViewingCustomer(null);
                    setShowAddProductPage(false);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center p-3 rounded-xl transition-all group relative ${
                    activeTab === item.id 
                      ? 'bg-ruby/10 text-ruby' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-ruby'
                  } ${sidebarOpen ? 'justify-start px-4' : 'justify-center'}`}
                >
                  <item.icon size={22} className={activeTab === item.id ? 'text-ruby' : 'text-gray-400 group-hover:text-ruby'} />
                  {sidebarOpen && <span className="ml-3 text-sm font-bold">{item.label}</span>}
                  {activeTab === item.id && !sidebarOpen && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute left-0 w-1.5 h-6 bg-ruby rounded-r-full"
                    />
                  )}
                </button>
              );
            })}

            {/* Logout Button - Below Settings */}
            <button 
              onClick={handleLogout}
              className={`w-full flex items-center p-3 rounded-xl transition-all group text-gray-500 hover:bg-red-50 hover:text-red-600 ${sidebarOpen ? 'justify-start px-4' : 'justify-center'}`}
            >
              <LogOut size={22} className="text-gray-400 group-hover:text-red-600" />
              {sidebarOpen && <span className="ml-3 text-sm font-bold">Logout</span>}
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-grow transition-all duration-300 min-w-0 overflow-hidden bg-[#F2F2F2] font-inter ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        {/* Top Bar */}
        <header className="bg-white h-20 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 shadow-sm border-b border-gray-100">
          <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-50 rounded-lg md:hidden flex-shrink-0">
              <Menu size={20} />
            </button>
            <h1 className="text-lg md:text-2xl font-black text-[#1A2C54] capitalize truncate">
              {viewingCustomer ? 'Customer Details' : activeTab}
            </h1>
          </div>

          <div className="flex items-center space-x-2 md:space-x-6">
            <div className="hidden lg:flex items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 w-72">
              <Search size={18} className="text-gray-400 mr-2" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none focus:outline-none text-sm w-full font-medium" />
            </div>
            
            <div className="relative flex items-center space-x-2 md:space-x-3">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 md:p-2.5 bg-gray-50 text-gray-400 hover:text-ruby rounded-xl border border-gray-100 transition-all relative group"
              >
                <Bell size={18} className="md:w-5 md:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-[#EF4444] text-white text-[8px] md:text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white group-hover:scale-125 transition-transform">
                    {notifications.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                  >
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                      <h3 className="font-bold text-[#1A2C54]">Notifications</h3>
                      <div className="flex items-center space-x-4">
                        <button onClick={() => setNotifications([])} className="text-[10px] font-bold text-ruby uppercase tracking-widest hover:underline">Clear All</button>
                        <button 
                          onClick={() => {
                            setActiveTab('notifications');
                            setShowNotifications(false);
                          }}
                          className="text-[10px] font-bold text-ruby uppercase tracking-widest hover:underline"
                        >
                          View All
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-2">
                          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                            <Bell size={24} />
                          </div>
                          <p className="text-xs text-gray-400 font-medium italic">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <button 
                            key={notif.id}
                            onClick={() => {
                              setActiveTab('notifications');
                              setShowNotifications(false);
                            }}
                            className="w-full p-4 hover:bg-gray-50 transition-colors flex items-start space-x-3 text-left border-b border-gray-50 last:border-0"
                          >
                            <div className="w-10 h-10 bg-ruby/10 text-ruby rounded-xl flex items-center justify-center flex-shrink-0">
                              <ShoppingBag size={18} />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-[#1A2C54]">New Order Received!</p>
                              <p className="text-[10px] text-gray-400">Order {notif.orderId?.startsWith('#') ? notif.orderId : `#${notif.orderId || notif.id?.slice(-6)}`} by {notif.address?.name || 'Guest'}</p>
                              <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">₹{(notif.total || 0).toLocaleString()}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center space-x-3 pl-4 border-l border-gray-100">
              <button 
                onClick={() => {
                  setActiveTab('settings');
                  setActiveSettingsTab('profile');
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 p-1 pr-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white shadow-sm ring-1 ring-gray-100">
                  <img 
                    src={profile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                    alt="Me" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform" 
                  />
                </div>
                <div className="hidden xs:block text-left leading-none">
                  <p className="text-[10px] font-black text-[#1A2C54] tracking-tight truncate max-w-[80px]">{profile?.displayName || user?.displayName || 'Admin'}</p>
                  <p className="text-[8px] font-bold text-ruby uppercase tracking-[0.05em] mt-0.5">Online</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-8 max-w-7xl mx-auto">
          {showAddProductPage ? (
            <AddProductPage 
              formData={formData} 
              setFormData={setFormData} 
              onSave={handleSaveProduct} 
              onCancel={() => {
                setShowAddProductPage(false);
                setEditingProduct(null);
              }}
              isEditing={!!editingProduct}
              categories={categories}
              colors={colors}
              sizes={sizes}
              loading={loading}
            />
          ) : (
            <>
              {activeTab === 'live' && (
                <LiveView 
                  totalSales={totalSalesVal}
                  totalOrders={totalOrdersVal}
                  totalSessions={totalSessionsVal}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  onRefresh={fetchDashboardData}
                />
              )}

              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight underline decoration-dotted decoration-gray-300 underline-offset-8">Command Center</h2>
                      <p className="text-sm text-gray-400 font-medium mt-3">Welcome back, Admin. Here's what's happening today.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto ml-auto md:ml-0">
                        {(['overview', 'reports'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setDashboardSubTab(tab as any)}
                            className={cn(
                              "flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                              dashboardSubTab === tab ? "bg-white text-[#1A2C54] shadow-sm" : "text-gray-400 hover:text-gray-600"
                            )}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      
                      <button 
                        onClick={generateSalesReport}
                        disabled={isGeneratingReport}
                        className="hidden md:flex px-6 py-3 bg-[#1A2C54] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-lg shadow-[#1A2C54]/10 items-center gap-2"
                      >
                        <BarChart3 size={16} />
                        {isGeneratingReport ? 'Report' : 'Export'}
                      </button>
                    </div>
                  </div>



                  {dashboardSubTab === 'overview' && (
                    <>
                      {/* Custom Date Selector */}
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-ruby/10 rounded-xl text-ruby">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-[#1A2C54] uppercase tracking-wider">Date Range Filter</h4>
                            <p className="text-[10px] text-gray-400 font-medium">Select custom dates to filter analytics</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">From</label>
                            <input 
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-[#1A2C54] outline-none focus:ring-2 focus:ring-ruby/20 transition-all cursor-pointer"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">To</label>
                            <input 
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-[#1A2C54] outline-none focus:ring-2 focus:ring-ruby/20 transition-all cursor-pointer"
                            />
                          </div>
                          
                          <div className="h-10 w-px bg-gray-100 hidden md:block mx-2" />

                          <button 
                            onClick={fetchDashboardData}
                            className="bg-ruby text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/10 active:scale-95"
                          >
                            Apply Range
                          </button>

                          <button 
                            onClick={() => {
                              const today = format(new Date(), 'yyyy-MM-dd');
                              setDateRange({ start: today, end: today });
                            }}
                            className="text-[10px] font-bold text-gray-400 hover:text-ruby uppercase tracking-[0.15em] transition-colors"
                          >
                            Reset to Today
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
                        {[
                          { label: 'Revenue', value: `₹${totalSalesVal.toLocaleString('en-IN')}`, trend: '+12.5%', icon: TrendingUp, color: 'text-ruby', bgColor: 'bg-ruby/10', data: [30, 45, 35, 50, 40, 60, 55] },
                          { label: 'Orders', value: totalOrdersVal.toLocaleString('en-IN'), trend: '+5.2%', icon: ShoppingCart, color: 'text-blue-500', bgColor: 'bg-blue-50', data: [20, 30, 25, 40, 35, 45, 40] },
                          { label: 'Customers', value: totalCustomersVal.toLocaleString('en-IN'), trend: '+8.1%', icon: UserPlus, color: 'text-green-500', bgColor: 'bg-green-50', data: [15, 25, 20, 35, 30, 40, 35] },
                          { label: 'Conversations', value: totalChatsVal.toLocaleString('en-IN'), trend: '+4.3%', icon: MessageSquare, color: 'text-amber-500', bgColor: 'bg-amber-50', data: [10, 15, 12, 18, 14, 22, 20] },
                          { label: 'Conversion', value: `${totalConversionVal}%`, trend: '-1.4%', icon: Activity, color: 'text-purple-500', bgColor: 'bg-purple-50', data: [2.5, 3.0, 2.8, 3.5, 3.2, 3.8, 3.2] },
                        ].map((stat, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 group hover:shadow-xl hover:shadow-gray-200/50 transition-all overflow-hidden"
                          >
                            <div className="flex justify-between items-start mb-2 sm:mb-4">
                              <div className={cn("p-1.5 sm:p-3 rounded-lg sm:rounded-2xl transition-transform group-hover:scale-110", stat.bgColor, stat.color)}>
                                <stat.icon size={14} className="sm:w-5 sm:h-5" />
                              </div>
                              <span className={cn(
                                "text-[7px] sm:text-[10px] font-bold px-1 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg",
                                stat.trend.startsWith('+') ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                              )}>
                                {stat.trend}
                              </span>
                            </div>
                            <div className="space-y-0.5 sm:space-y-1">
                              <h3 className="text-[13px] sm:text-2xl font-black text-[#1A2C54] truncate leading-tight">{stat.value}</h3>
                              <p className="text-[7px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate leading-none">{stat.label}</p>
                            </div>
                            <div className="h-8 sm:h-12 w-full mt-2 sm:mt-4">
                              <LineChart width={150} height={40} data={stat.data.map((v, idx) => ({ v, idx }))}>
                                <Line 
                                  type="monotone" 
                                  dataKey="v" 
                                  stroke={stat.color.includes('ruby') ? '#E11D48' : stat.color.includes('blue') ? '#3B82F6' : stat.color.includes('green') ? '#22C55E' : '#A855F7'} 
                                  strokeWidth={2} 
                                  dot={false} 
                                />
                              </LineChart>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-[#1A2C54]">Sales Performance</h3>
                              <p className="text-xs text-gray-400 font-medium">Revenue vs Orders over time</p>
                            </div>
                            <select 
                              className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-[10px] font-bold text-gray-500 focus:outline-none cursor-pointer uppercase tracking-widest"
                              value={chartTimeframe}
                              onChange={(e) => setChartTimeframe(e.target.value as any)}
                            >
                              <option value="day">Last 24 Hours</option>
                              <option value="week">Last 7 Days</option>
                              <option value="month">Last 30 Days</option>
                            </select>
                          </div>
                          <div className="h-[350px] w-full">
                            <ChartContainer isMounted={isMounted}>
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis xAxisId={0} dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} dy={10} />
                                <YAxis yAxisId={0} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.1)', padding: '16px' }}
                                />
                                <Area animationDuration={1500} type="monotone" dataKey="sales" stroke="#E11D48" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                              </AreaChart>
                            </ChartContainer>
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                          <h3 className="text-xl font-bold text-[#1A2C54]">Order Status</h3>
                          <div className="h-[250px] w-full relative">
                            <ChartContainer isMounted={isMounted}>
                              <PieChart>
                                <Pie
                                  data={orderStatusData}
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {orderStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ChartContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-2xl font-black text-[#1A2C54]">{totalOrdersVal}</span>
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {orderStatusData.map((item, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{item.name}</span>
                                </div>
                                <span className="text-xs font-black text-[#1A2C54]">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                          <h3 className="text-xl font-bold text-[#1A2C54]">Category Performance</h3>
                          <div className="space-y-6">
                            {categoryPerformance.map((cat, i) => (
                              <div key={i} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{cat.name}</span>
                                  <span className="text-xs font-black text-[#1A2C54]">{cat.value}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${cat.value}%` }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-[#1A2C54]">Recent Orders</h3>
                            <button onClick={() => setActiveTab('orders')} className="text-ruby text-[10px] font-bold uppercase tracking-widest hover:underline">View All</button>
                          </div>
                          <div className="flex-grow overflow-y-auto max-h-[400px] scrollbar-hide">
                            <div className="divide-y divide-gray-50">
                              {orders.slice(0, 5).map((order, i) => (
                                <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-[#1A2C54]">
                                      {order.address?.name?.charAt(0) || 'G'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-[#1A2C54]">{order.address?.name || 'Guest'}</p>
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{order.orderId}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-[#1A2C54]">₹{Number(order.total || 0).toLocaleString()}</p>
                                    <span className={cn(
                                      "text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                      statusColors[order.status] || "bg-gray-100 text-gray-600"
                                    )}>
                                      {order.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#1A2C54] p-8 rounded-[2.5rem] shadow-xl shadow-[#1A2C54]/20 text-white space-y-6">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-2xl">
                              <Bell size={24} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">Push Notifications</h3>
                              <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Engage your customers</p>
                            </div>
                          </div>
                          
                          <form onSubmit={handleSendNotification} className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Notification Title</label>
                              <input 
                                type="text"
                                value={pushNotification.title}
                                onChange={e => setPushNotification({...pushNotification, title: e.target.value})}
                                placeholder="E.g. Flash Sale Alert! ⚡"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ruby/50 transition-all placeholder:text-white/20"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Message Body</label>
                              <textarea 
                                value={pushNotification.body}
                                onChange={e => setPushNotification({...pushNotification, body: e.target.value})}
                                placeholder="Get up to 50% off on all items today only!"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ruby/50 transition-all min-h-[100px] placeholder:text-white/20"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Target Audience</label>
                              <select 
                                value={pushNotification.type}
                                onChange={e => setPushNotification({...pushNotification, type: e.target.value})}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ruby/50 transition-all text-white"
                              >
                                <option value="all" className="text-black">All Customers</option>
                                <option value="active" className="text-black">Active Users</option>
                                <option value="new" className="text-black">New Signups</option>
                              </select>
                            </div>
                            <button 
                              type="submit"
                              disabled={isSendingNotification}
                              className="w-full bg-ruby text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white hover:text-ruby transition-all shadow-lg shadow-ruby/20 flex items-center justify-center gap-2"
                            >
                              <Send size={16} />
                              {isSendingNotification ? 'Sending...' : 'Send Notification'}
                            </button>
                          </form>

                          <div className="pt-6 border-t border-white/10 space-y-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Recently Sent</h4>
                            <div className="space-y-3">
                              {[
                                { title: 'Flash Sale Alert! ⚡', body: 'Get up to 50% off on all items today only!', type: 'all', time: '2h ago' },
                                { title: 'New Collection Live! ✨', body: 'Check out our latest summer arrivals.', type: 'active', time: '1d ago' },
                              ].map((notif, i) => (
                                <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                                  <div className="flex justify-between items-start">
                                    <p className="text-xs font-bold text-white">{notif.title}</p>
                                    <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">{notif.time}</span>
                                  </div>
                                  <p className="text-[10px] text-white/50 line-clamp-1">{notif.body}</p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="px-1.5 py-0.5 bg-ruby/20 text-ruby text-[8px] font-bold rounded uppercase tracking-widest">{notif.type}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {dashboardSubTab === 'reports' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {[
                        { title: 'Sales Report', desc: 'Detailed breakdown of revenue and taxes', icon: BarChart3 },
                        { title: 'Inventory Report', desc: 'Stock levels and valuation', icon: Package },
                        { title: 'Customer Insights', desc: 'Demographics and buying patterns', icon: Users },
                        { title: 'Marketing ROI', desc: 'Performance of promo codes and ads', icon: Rocket },
                        { title: 'Support Analytics', desc: 'Response times and satisfaction', icon: MessageSquare },
                        { title: 'System Logs', desc: 'Security and performance logs', icon: Shield },
                      ].map((report, i) => (
                        <motion.div 
                          key={i}
                          whileHover={{ y: -5 }}
                          className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4 group cursor-pointer"
                        >
                          <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:bg-ruby/10 group-hover:text-ruby transition-all">
                            <report.icon size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-lg font-bold text-[#1A2C54]">{report.title}</h4>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed">{report.desc}</p>
                          </div>
                          <button className="text-[10px] font-bold text-ruby uppercase tracking-widest flex items-center gap-2 pt-2">
                            Download PDF <ChevronRight size={14} />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'products' && (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-800">Product Management</h2>
                      <p className="text-sm text-gray-400">Manage your store inventory</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <label className="flex-1 sm:flex-none cursor-pointer bg-white border border-gray-100 text-[#1A2C54] px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm">
                        <Database size={16} className="mr-2" />
                        {isUploadingBulk ? 'Uploading...' : 'Bulk Upload'}
                        <input 
                          type="file" 
                          accept=".xlsx, .xls, .csv" 
                          className="hidden" 
                          onChange={handleBulkUpload}
                          disabled={isUploadingBulk}
                        />
                      </label>
                      <button 
                        onClick={() => {
                          setEditingProduct(null);
                          setFormData({ 
                            name: '', 
                            description: '', 
                            price: 0, 
                            category: 'Women', 
                            sizes: sizes.length > 0 ? sizes.map(s => s.name) : ['S', 'M', 'L', 'XL'], 
                            images: [''], 
                            stock: 10,
                            comparePrice: 0,
                            stockStatus: 'In Stock',
                            seoTitle: '',
                            seoDescription: '',
                            weight: '',
                            dimensions: '',
                            sku: '',
                            barcode: '',
                            isTrending: false,
                            isPopular: false,
                            variants: []
                          });
                          setShowAddProductPage(true);
                        }}
                        className="flex-1 sm:flex-none bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center justify-center shadow-lg shadow-ruby/20"
                      >
                        <Plus size={16} className="mr-2" />
                        Add Product
                      </button>
                    </div>
                  </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <th className="py-4 px-8">Product</th>
                        <th className="py-4 px-8">Category</th>
                        <th className="py-4 px-8">Price</th>
                        <th className="py-4 px-8">Stock</th>
                        <th className="py-4 px-8 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {products.map(p => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                          <td className="py-4 px-8 flex items-center space-x-4">
                            {p.images[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
                                <ImageIcon size={20} />
                              </div>
                            )}
                            <span className="font-bold text-gray-800">{p.name}</span>
                          </td>
                          <td className="py-4 px-8 text-gray-500">{Array.isArray(p.category) ? p.category.join(', ') : p.category}</td>
                          <td className="py-4 px-8 font-bold text-gray-800">₹{p.price.toFixed(2)}</td>
                          <td className="py-4 px-8">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${p.stock < 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                              {p.stock} In Stock
                            </span>
                          </td>
                          <td className="py-4 px-8 text-right space-x-2">
                            <button 
                              onClick={() => {
                                setEditingProduct(p);
                                setFormData({
                                  name: p.name,
                                  description: p.description,
                                  price: p.price,
                                  category: Array.isArray(p.category) ? p.category : (p.category ? [p.category] : []),
                                  sizes: p.sizes,
                                  images: p.images,
                                  stock: p.stock,
                                  comparePrice: p.comparePrice || 0,
                                  stockStatus: p.stockStatus || 'In Stock',
                                  seoTitle: p.seoTitle || '',
                                  seoDescription: p.seoDescription || '',
                                  weight: p.weight || '',
                                  dimensions: p.dimensions || '',
                                  sku: p.sku || '',
                                  barcode: p.barcode || '',
                                  isTrending: p.isTrending || false,
                                  isPopular: p.isPopular || false,
                                  variants: p.variants || []
                                });
                                setShowAddProductPage(true);
                              }}
                              className="p-2 text-gray-400 hover:text-ruby transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-2 text-gray-400 hover:text-ruby transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-50 flex gap-4 items-center">
                    <div className="w-20 h-20 flex-shrink-0 relative">
                       {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full rounded-xl object-cover bg-gray-100" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-gray-50 flex items-center justify-center text-gray-200">
                          <ImageIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h3 className="text-[13px] font-[800] text-gray-900 leading-tight truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-tight truncate">
                          {Array.isArray(p.category) ? p.category.join(', ') : p.category}
                        </p>
                        <span className="text-gray-300">•</span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase",
                          p.stock < 10 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {p.stock} In Stock
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[14px] font-black text-gray-900 tracking-tighter">₹{p.price.toFixed(0)}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingProduct(p);
                              setFormData({
                                name: p.name,
                                description: p.description,
                                price: p.price,
                                category: Array.isArray(p.category) ? p.category : (p.category ? [p.category] : []),
                                sizes: p.sizes,
                                images: p.images,
                                stock: p.stock,
                                comparePrice: p.comparePrice || 0,
                                stockStatus: p.stockStatus || 'In Stock',
                                seoTitle: p.seoTitle || '',
                                seoDescription: p.seoDescription || '',
                                weight: p.weight || '',
                                dimensions: p.dimensions || '',
                                sku: p.sku || '',
                                barcode: p.barcode || '',
                                isTrending: p.isTrending || false,
                                isPopular: p.isPopular || false,
                                variants: p.variants || []
                              });
                              setShowAddProductPage(true);
                            }}
                            className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 hover:text-ruby transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 hover:text-ruby transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'orders' && !viewingCustomer && (
            <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden px-1">
              {/* Header with Title and Buttons */}
              <div className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-6xl font-extrabold text-[#1A2C54] tracking-tighter font-syne uppercase truncate">
                    Orders
                  </h1>
                  <p className="text-gray-400 mt-0.5 text-[9px] sm:text-lg font-medium">
                    {filteredOrders.length === orders.length ? `Managing ${orders.length} store orders.` : `Showing ${filteredOrders.length} results.`}
                  </p>
                </div>
                <div className="flex gap-1.5 w-full sm:w-auto">
                  <button 
                    onClick={handleRefreshOrders}
                    disabled={isRefreshingOrders}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 h-7 sm:h-10 px-2 sm:px-6 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-[8px] sm:text-[12px] font-bold text-gray-600 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={`sm:w-3.5 sm:h-3.5 ${isRefreshingOrders ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingOrders ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  <button 
                    onClick={() => {
                      const rows = [['Order', 'Customer', 'Email', 'Date', 'Total', 'Status', 'Fulfillment']];
                      filteredOrders.forEach(o => rows.push([
                        o.orderId || o.id, 
                        o.address?.name || o.customerName || 'N/A', 
                        o.address?.email || o.email || 'N/A', 
                        ensureDate(o.createdAt).toLocaleDateString(), 
                        o.total || 0, 
                        o.status || 'Pending', 
                        o.fulfillmentStatus || 'Unfulfilled'
                      ]));
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')], { type: 'text/csv' }));
                      a.download = `orders.csv`; 
                      a.click();
                      toast.success(`Exported`);
                    }} 
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 h-7 sm:h-10 px-2 sm:px-6 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-[8px] sm:text-[12px] font-bold text-gray-600 shadow-sm transition-all active:scale-95"
                  >
                    <Download size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span>Export</span>
                  </button>
                  <button 
                    onClick={handleAddOrder}
                    className="flex-[1.5] sm:flex-none flex items-center justify-center gap-1 h-7 sm:h-10 px-2 sm:px-8 rounded-lg sm:rounded-xl bg-ruby text-white text-[8px] sm:text-[12px] font-black uppercase tracking-widest shadow-lg shadow-ruby/20 transition-all active:scale-95"
                  >
                    <Plus size={14} className="sm:w-4 sm:h-4" />
                    <span>New Order</span>
                  </button>
                </div>
              </div>

              {/* KPI Strip - Locked Grid for Mobile */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1.5 sm:gap-6 mb-4 max-w-full overflow-hidden">
                {orderStats.map((k, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-white p-2 sm:p-6 rounded-xl shadow-sm border border-gray-100 group transition-all overflow-hidden cursor-pointer min-w-0 h-[80px] sm:h-auto",
                      i === 4 ? "col-span-2 lg:col-span-1" : "col-span-1"
                    )}
                  >
                    <div className="flex justify-between items-start mb-0.5 sm:mb-4">
                      <div className={cn("p-1 sm:p-3 rounded-lg sm:rounded-2xl transition-transform group-hover:scale-110", k.bgColor, k.color)}>
                        <k.icon size={11} className="sm:w-5 sm:h-5" />
                      </div>
                      <span className={cn(
                        "text-[5.5px] sm:text-[10px] font-bold px-1 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg",
                        k.up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      )}>
                        {k.change}
                      </span>
                    </div>
                    <div className="space-y-0 sm:space-y-1">
                      <h3 className="text-[11px] sm:text-2xl font-black text-[#1A2C54] truncate tracking-tighter">{k.value}</h3>
                      <p className="text-[6px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{k.label}</p>
                    </div>
                    <div className="h-4 sm:h-12 w-full mt-1 sm:mt-4 opacity-70">
                      <ChartContainer isMounted={isMounted}>
                        <LineChart data={(k as any).data.map((v: number, idx: number) => ({ v, idx }))}>
                          <Line 
                            type="monotone" 
                            dataKey="v" 
                            stroke={k.color.includes('ruby') ? '#E11D48' : k.color.includes('blue') ? '#3B82F6' : k.color.includes('emerald') ? '#10B981' : k.color.includes('amber') ? '#F59E0B' : '#A855F7'} 
                            strokeWidth={1.2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ChartContainer>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Filters & Tabs Box */}
              <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-[2rem] p-3 sm:p-4 shadow-xl shadow-gray-200/50 space-y-4 overflow-hidden">
                {/* Tabs - Mobile Slideable Header */}
                <div className="relative group/slider">
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 border-b border-gray-50 snap-x snap-mandatory">
                    {ORDER_TABS.map(t => {
                      const getStatCount = (id: string) => {
                        if (id === 'all') return orders.length;
                        if (id === 'unfulfilled') return orders.filter(o => o.fulfillmentStatus !== 'Fulfilled').length;
                        if (id === 'paid_unful') return orders.filter(o => (o.status === 'Shipped' || o.status === 'Delivered' || o.status === 'Paid') && o.fulfillmentStatus !== 'Fulfilled').length;
                        if (id === 'open') return orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
                        if (id === 'delivered') return orders.filter(o => o.status === 'Delivered').length;
                        if (id === 'onhold') return orders.filter(o => o.fulfillmentStatus === 'On Hold').length;
                        if (id === 'closed') return orders.filter(o => o.status === 'Delivered' || o.status === 'Cancelled').length;
                        return 0;
                      };
                      const count = getStatCount(t.id);
                      const isActive = orderTab === t.id;
                      return (
                        <button 
                          key={t.id} 
                          onClick={() => { setOrderTab(t.id); setCurrentPage(1); }} 
                          className={`h-9 px-4 sm:px-6 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2.5 transition-all snap-start shadow-sm active:scale-95 ${isActive ? 'bg-gray-900 text-white shadow-gray-900/20' : 'bg-gray-50/50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                        >
                          {t.label}
                          {count > 0 && (
                            <span className={`text-[8px] sm:text-[9px] font-black min-w-[18px] sm:min-w-[20px] h-3.5 sm:h-4 rounded-full px-1.5 flex items-center justify-center ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Subtle indicators for mobile scroll */}
                  <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none lg:hidden" />
                </div>

                {/* Toolbar */}
                <div className="flex flex-col gap-3">
                  <div className="w-full relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-ruby transition-colors" size={16} />
                    <input 
                      className="w-full h-11 bg-gray-50/50 border border-gray-100 rounded-xl pl-11 pr-4 text-[13px] text-gray-900 outline-none focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 focus:bg-white transition-all font-medium" 
                      placeholder="Search orders..." 
                      value={orderSearchTerm} 
                      onChange={e => { setOrderSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:flex gap-2 w-full">
                    <input 
                      type="date" 
                      value={orderStartDate}
                      onChange={(e) => setOrderStartDate(e.target.value)}
                      className="h-11 px-3 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 focus:outline-none focus:bg-white transition-all"
                    />
                    <input 
                      type="date" 
                      value={orderEndDate}
                      onChange={(e) => setOrderEndDate(e.target.value)}
                      className="h-11 px-3 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 focus:outline-none focus:bg-white transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setOrderSearchTerm('');
                      setOrderStatusFilter('All Status');
                      setOrderStartDate('');
                      setOrderEndDate('');
                      setOrderTab('all');
                    }}
                    className="h-11 w-full sm:w-auto px-6 rounded-xl border border-gray-100 bg-white text-[10px] font-black uppercase tracking-widest text-ruby hover:bg-ruby hover:text-white transition-all active:scale-95 shadow-sm"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* Bulk Selection Message */}
              <AnimatePresence>
                {selectedOrders.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gray-900 text-white rounded-[1.5rem] px-6 h-16 flex items-center justify-between shadow-xl mt-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[13px] font-black font-syne uppercase tracking-wider">{selectedOrders.length} ORDERS SELECTED</span>
                        <div className="w-px h-6 bg-white/20" />
                        <div className="flex gap-2">
                          <button onClick={() => toast.success('Bulk action started...')} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 transition-all border border-white/10">Bulk Fulfill</button>
                          <button onClick={() => toast.success('Preparing labels...')} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 transition-all border border-white/10">Print All</button>
                        </div>
                      </div>
                      <button onClick={() => setSelectedOrders([])} className="text-[10px] font-black uppercase tracking-widest hover:text-ruby transition-colors px-4 h-9">Deselect All</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main List Table */}
              <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-gray-200/30 overflow-hidden relative min-h-[500px]">
                {/* Desktop view */}
                <div className="hidden lg:block overflow-x-auto overflow-y-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] border-b border-gray-100 h-14">
                        <th className="px-6 text-center w-12">
                           <div className="flex justify-center">
                              <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded-md border-gray-300 text-ruby focus:ring-ruby cursor-pointer"
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedOrders(filteredOrders.map(o => o.id));
                                  else setSelectedOrders([]);
                                }}
                                checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                              />
                           </div>
                        </th>
                        <th className="px-6 text-left">Order Information</th>
                        <th className="px-6 text-left">Customer Details</th>
                        <th className="px-6 text-center">Items</th>
                        <th className="px-6 text-right">Revenue</th>
                        <th className="px-6 text-center">Status</th>
                        <th className="px-6 text-center">Fulfillment</th>
                        <th className="px-6 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-sans">
                      {paginatedOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-40 text-center">
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <ShoppingBag size={40} className="text-gray-200" />
                              </div>
                              <h3 className="text-2xl font-black text-gray-900 font-syne uppercase tracking-tighter">No Orders Found</h3>
                              <p className="text-sm text-gray-400 mt-2 font-medium max-w-xs mx-auto">We couldn't find any orders matching your criteria. Try adjusting your filters.</p>
                            </motion.div>
                          </td>
                        </tr>
                      ) : (
                        paginatedOrders.map((order, i) => {
                          const isSelected = selectedOrders.includes(order.id);
                          const customerDoc = customers.find(c => c.uid === order.customerUid || c.email === order.email);
                          const customerPhoto = customerDoc?.photoURL || customerDoc?.photo;
                          const customerName = order.address?.name || order.customerName || customerDoc?.displayName || 'Guest User';
                          const initials = customerName.split(' ').map((n:any) => n[0]).join('').slice(0,2).toUpperCase();
                          const hue = (order.id.charCodeAt(0) + (order.id.charCodeAt(1) || 0) + (order.id.charCodeAt(2) || 0)) % 360;
                          const createdAt = ensureDate(order.createdAt);
                          
                          return (
                            <motion.tr 
                              key={order.id}
                              initial={{ opacity: 0, y: 15 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.02, duration: 0.3 }}
                              onClick={() => setViewingCustomer(order)}
                              className={`group cursor-pointer hover:bg-ruby/[0.01] transition-all relative ${isSelected ? 'bg-ruby/[0.03]' : ''}`}
                            >
                                <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center">
                                    <input 
                                      type="checkbox" 
                                      className="w-5 h-5 rounded-md border-gray-300 text-ruby focus:ring-ruby cursor-pointer transition-transform active:scale-125"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                                        else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                                      }}
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-4">
                                    {customerPhoto ? (
                                      <div className="w-12 h-12 rounded-[1rem] overflow-hidden border border-gray-100 shadow-sm flex-shrink-0 group-hover:rotate-6 transition-transform">
                                        <img src={customerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                    ) : (
                                      <div 
                                        className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-sm font-black font-syne shadow-lg shadow-black/5 flex-shrink-0 group-hover:rotate-6 transition-transform"
                                        style={{ background: `hsl(${hue}, 75%, 95%)`, color: `hsl(${hue}, 60%, 40%)` }}
                                      >
                                        {initials}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[14px] font-black text-gray-900 tracking-tight">{order.orderId || `#${order.id.slice(-6).toUpperCase()}`}</p>
                                        <div className="w-1 h-1 rounded-full bg-gray-200" />
                                        <p className="text-[11px] font-bold text-gray-400">{createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                      </div>
                                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                         {order.isVIP && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded tracking-widest uppercase shadow-sm shadow-amber-200/50">VIP</span>}
                                         <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded tracking-widest uppercase border border-emerald-100/50">{order.shippingMethod || 'Standard'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <p className="text-[14px] font-black text-gray-800 tracking-tight group-hover:text-ruby transition-colors">{customerName}</p>
                                  <p className="text-[11px] text-gray-400 font-bold tracking-wide truncate max-w-[180px] lowercase">{order.address?.email || order.email || 'Email missing'}</p>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <div className="inline-flex flex-col items-center">
                                    <p className="text-[14px] font-black text-gray-900 group-hover:scale-110 transition-transform">{order.items?.length || 0}</p>
                                    <div className="flex justify-center -space-x-2.5 mt-2">
                                      {order.items?.slice(0,3).map((item:any, idx:number)=>(
                                        <div key={idx} className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 overflow-hidden shadow-md ring-1 ring-gray-100">
                                          <img src={item.image || item.images?.[0] || 'https://picsum.photos/seed/placeholder/100/100'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      ))}
                                      {(order.items?.length || 0) > 3 && (
                                        <div className="w-6 h-6 rounded-full border-2 border-white bg-ruby text-[9px] font-black text-white flex items-center justify-center shadow-lg">+{(order.items?.length || 0) - 3}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <p className="text-[17px] font-black text-gray-900 leading-none mb-1">₹{Number(order.total || 0).toLocaleString()}</p>
                                  <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Razorpay</p>
                                </td>
                                <td className="px-6 py-5 text-center">
                                   <StatusBadge status={getEffectiveOrderStatus(order)} />
                                </td>
                                <td className="px-6 py-5 text-center">
                                   <StatusBadge status={order.fulfillmentStatus || 'Unfulfilled'} />
                                </td>
                                <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                                   <div className="flex items-center justify-end gap-1">
                                      <button 
                                        onClick={() => setViewingCustomer(order)}
                                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-ruby transition-all"
                                        title="View Details"
                                      >
                                        <Eye size={16} />
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (confirm('Are you sure you want to delete this order?')) {
                                            try {
                                              const { error } = await supabase
                                                .from('orders')
                                                .delete()
                                                .eq('id', order.id);
                                              if (error) throw error;
                                              setOrders(orders.filter(o => o.id !== order.id));
                                              toast.success('Order deleted successfully');
                                            } catch (err) {
                                              console.error('Error deleting order:', err);
                                              toast.error('Failed to delete order');
                                            }
                                          }
                                        }}
                                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all font-medium"
                                        title="Delete Order"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view Cards */}
                <div className="lg:hidden divide-y divide-gray-50 bg-white">
                  {paginatedOrders.length === 0 ? (
                    <div className="py-24 text-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                        <ShoppingBag size={32} />
                      </div>
                      <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest">No matching orders found</p>
                    </div>
                  ) : (
                    paginatedOrders.map((order, i) => {
                      const customerDoc = customers.find(c => c.uid === order.customerUid || c.email === order.email);
                      const customerPhoto = customerDoc?.photoURL || customerDoc?.photo;
                      const customerName = order.address?.name || order.customerName || customerDoc?.displayName || 'Guest User';
                      const hue = (order.id.charCodeAt(0) + (order.id.charCodeAt(1) || 0)) % 360;
                      const createdAt = ensureDate(order.createdAt);
                      
                      return (
                        <div 
                          key={order.id} 
                          onClick={() => setViewingCustomer(order)}
                          className="p-3 sm:p-5 active:bg-ruby/[0.02] transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="flex justify-between items-start mb-2 sm:mb-4">
                            <div className="flex gap-3 sm:gap-4">
                               {customerPhoto ? (
                                 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-[1rem] overflow-hidden border border-gray-100 shadow-sm flex-shrink-0">
                                   <img src={customerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 </div>
                               ) : (
                                 <div 
                                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-[1rem] flex-shrink-0 flex items-center justify-center text-xs sm:text-sm font-black font-syne shadow-lg shadow-black/5"
                                    style={{ background: `hsl(${hue}, 75%, 95%)`, color: `hsl(${hue}, 60%, 40%)` }}
                                  >
                                    {customerName[0].toUpperCase()}
                                  </div>
                               )}
                                <div className="space-y-0.5">
                                   <div className="flex items-center gap-2">
                                      <p className="text-[13px] sm:text-[15px] font-black text-gray-900 tracking-tight">{order.orderId || `#${order.id.slice(-6).toUpperCase()}`}</p>
                                      <span className="text-[8px] sm:text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full tracking-tighter uppercase whitespace-nowrap">{order.shippingMethod || 'STD'}</span>
                                   </div>
                                   <p className="text-[11px] sm:text-[12px] font-black text-gray-800 uppercase tracking-[0.05em]">{customerName}</p>
                                   <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">{createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[15px] sm:text-[18px] font-black text-gray-900 tracking-tight leading-none">₹{Number(order.total || 0).toLocaleString()}</p>
                               <span className="text-[8px] sm:text-[9px] font-black text-gray-300 tracking-widest uppercase">Total</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <StatusBadge status={getEffectiveOrderStatus(order)} className="scale-[0.8] sm:scale-90 origin-left" />
                             <StatusBadge status={order.fulfillmentStatus || 'Unfulfilled'} className="scale-[0.8] sm:scale-90 origin-left" />
                             <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                                <div className="flex -space-x-1.5 sm:-space-x-2">
                                    {(order.items || []).slice(0, 3).map((it:any, idx:number)=>(
                                       <div key={idx} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white bg-gray-100 overflow-hidden shadow-sm">
                                          <img src={it.image || it.images?.[0] || 'https://picsum.photos/seed/p/50/50'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                       </div>
                                    ))}
                                </div>
                                <span className="text-[9px] sm:text-[10px] font-black text-gray-400 whitespace-nowrap">{(order.items || []).length} ITEMS</span>
                             </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer with Pagination style */}
                <div className="px-8 py-6 border-t border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                   <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">
                     Viewing {paginatedOrders.length} of {filteredOrders.length} records
                   </p>
                   {filteredOrders.length > entriesPerPage && (
                      <div className="flex items-center gap-2.5 bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-ruby hover:text-white transition-all disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronRight className="rotate-180" size={18} />
                        </button>
                        <div className="flex items-center gap-1.5 px-2">
                           <span className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-black shadow-lg">{currentPage}</span>
                           <span className="text-[10px] font-black text-gray-300 uppercase px-2 font-syne">of {Math.ceil(filteredOrders.length / entriesPerPage)}</span>
                        </div>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredOrders.length / entriesPerPage), p + 1))}
                          disabled={currentPage >= Math.ceil(filteredOrders.length / entriesPerPage)}
                          className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-ruby hover:text-white transition-all disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* Order Detail View (Exact Match UI) */}
          {viewingCustomer && (
            <div className="fixed inset-0 bg-shop-bg z-[1000] overflow-y-auto font-sans antialiased text-shop-text">
              
              <div className="max-w-[960px] mx-auto p-4 sm:p-5 pb-16">
                
                {/* BREADCRUMB */}
                <div className="flex items-center gap-1.5 mb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  <button onClick={() => setViewingCustomer(null)} className="text-[13px] text-blue-600 hover:underline">Orders</button>
                  <span className="text-gray-400 text-[13px]">›</span>
                  <span className="text-[13px] text-blue-600 cursor-pointer hover:underline">{viewingCustomer.orderId || `#${viewingCustomer.id.slice(-6).toUpperCase()}`}</span>
                  <span className="text-gray-400 text-[13px]">›</span>
                  <span className="text-[13px] text-gray-500">
                    {(viewingCustomer.status === 'Cancelled' || viewingCustomer.status === 'cancelled') ? 'Cancelled Order' : 
                     (viewingCustomer.status === 'Delivered' || viewingCustomer.status === 'delivered') ? 'Delivered Order' : 
                     'Fulfill items'}
                  </span>
                </div>

                {/* PAGE HEADER */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewingCustomer(null)} className="w-[34px] h-[34px] bg-white border border-shop-border rounded-lg flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors">
                      <ChevronLeft size={16} className="text-shop-text" />
                    </button>
                    <h2 className="text-[20px] font-[700] text-shop-text uppercase tracking-tight">
                      {(viewingCustomer.status === 'Cancelled' || viewingCustomer.status === 'cancelled') ? 'Order Details' : 
                       (viewingCustomer.status === 'Delivered' || viewingCustomer.status === 'delivered') ? 'Order Details' : 
                       'Fulfill items'}
                    </h2>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[12px] font-[600]",
                      (viewingCustomer.status === 'Cancelled' || viewingCustomer.status === 'cancelled') ? "bg-red-100 text-red-700" :
                      (viewingCustomer.status === 'Delivered' || viewingCustomer.status === 'delivered') ? "bg-emerald-100 text-emerald-800" :
                      viewingCustomer.fulfillmentStatus === 'Fulfilled' ? "bg-shop-green-light text-shop-green" : "bg-[#fff7e0] text-[#b98900]"
                    )}>
                      {viewingCustomer.status || viewingCustomer.fulfillmentStatus || 'Unfulfilled'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => generateInvoice(viewingCustomer, settings)} className="px-4 h-9 rounded-lg border border-shop-border bg-white text-[13px] font-[600] text-shop-text hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all active:scale-95">
                      <Download size={14} />
                      <span>Invoice</span>
                    </button>
                    
                    <div className="relative group/status">
                      <button className="px-4 h-9 rounded-lg border border-shop-border bg-white text-[13px] font-[600] text-shop-text hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-all active:scale-95">
                        <Edit2 size={14} />
                        <span className="capitalize">{viewingCustomer.status || 'Status'}</span>
                      </button>
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-shop-border rounded-xl shadow-2xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-[300] p-1.5 space-y-0.5">
                        {['Pending', 'Paid', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Return Requested', 'Returned'].map(s => (
                          <button 
                            key={s}
                            onClick={async () => {
                              const updates: any = { status: s };
                              if (s === 'Returned') {
                                updates.returnStatus = 'Approved';
                              } else if (s === 'Cancelled' || s === 'Refunded') {
                                updates.returnStatus = 'Rejected';
                              }
                              await handleUpdateOrderStatus(viewingCustomer.id, s);
                              setViewingCustomer({ ...viewingCustomer, ...updates });
                            }}
                            className="w-full text-left px-3.5 py-2 rounded-lg text-[13px] font-[500] hover:bg-gray-50 flex items-center justify-between"
                          >
                            <span>{s}</span>
                            {viewingCustomer.status === s && <Check size={14} className="text-shop-green" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRID */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 items-start">
                  
                  {/* LEFT COLUMN */}
                  <div className="space-y-4">

                    {/* CANCELLED ORDER VIEW */}
                    {(viewingCustomer.status === 'Cancelled' || viewingCustomer.status === 'cancelled') ? (
                      <div className="space-y-4">
                        {/* Cancelled Banner */}
                        <div className="bg-red-50 border border-red-200/80 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
                              <XCircle size={22} />
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-red-950">This Order Was Cancelled</h3>
                              <p className="text-xs text-red-700 font-medium">Fulfillment, shipping, and delivery operations are disabled for this order.</p>
                            </div>
                          </div>

                          {(viewingCustomer.returnReason || viewingCustomer.cancelReason) && (
                            <div className="mt-3 pt-3 border-t border-red-200/60 text-xs text-red-900 space-y-1">
                              <p><span className="font-bold text-red-950">Cancellation Reason:</span> {viewingCustomer.returnReason || viewingCustomer.cancelReason}</p>
                              {viewingCustomer.returnComments && (
                                <p className="text-red-800 italic bg-red-100/40 p-2.5 rounded-xl border border-red-200/50 mt-1">
                                  "{viewingCustomer.returnComments}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Static Items Summary */}
                        <div className="bg-white border border-shop-border rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-shop-border flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-sm font-bold text-shop-text">Items in Cancelled Order</h3>
                            <span className="text-xs text-gray-500">{viewingCustomer.items?.length || 0} items</span>
                          </div>
                          <div className="p-5 divide-y divide-gray-100">
                            {viewingCustomer.items?.map((item: any, idx: number) => (
                              <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl border border-shop-border overflow-hidden bg-gray-50 shrink-0">
                                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-shop-text">{item.name}</p>
                                    <p className="text-xs text-gray-400">Qty: {item.quantity} {item.selectedSize ? `• Size: ${item.selectedSize}` : ''}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-bold text-shop-text">₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (viewingCustomer.status === 'Delivered' || viewingCustomer.status === 'delivered') ? (
                      <div className="space-y-4">
                        {/* Delivered Banner */}
                        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                            <CheckCheck size={22} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-emerald-950">Order Delivered</h3>
                            <p className="text-xs text-emerald-700 font-medium">This order has been successfully delivered and completed.</p>
                          </div>
                        </div>

                        {/* Return details info if requested */}
                        {renderAdminReturnCard(viewingCustomer)}

                        {/* Delivered Items Summary */}
                        <div className="bg-white border border-shop-border rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-shop-border flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-sm font-bold text-shop-text">Delivered Items</h3>
                            <span className="text-xs text-gray-500">{viewingCustomer.items?.length || 0} items</span>
                          </div>
                          <div className="p-5 divide-y divide-gray-100">
                            {viewingCustomer.items?.map((item: any, idx: number) => (
                              <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl border border-shop-border overflow-hidden bg-gray-50 shrink-0">
                                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-shop-text">{item.name}</p>
                                    <p className="text-xs text-gray-400">Qty: {item.quantity} {item.selectedSize ? `• Size: ${item.selectedSize}` : ''}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-bold text-shop-text">₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* RETURN REQUEST INFO */}
                        {renderAdminReturnCard(viewingCustomer)}
                    
                    {/* FULFILL FROM */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border">
                        <h3 className="text-[14px] font-[700] text-shop-text">Fulfill from</h3>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2.5 bg-[#f6f6f7] border border-shop-border rounded-lg p-3 sm:p-3.5">
                          <div className="w-9 h-9 bg-shop-green-light rounded-lg flex items-center justify-center shrink-0">
                            <Home size={18} className="text-shop-green" />
                          </div>
                          <div className="flex-1">
                            <div className="text-[14px] font-[700] text-shop-text">The Ruby, Mumbai</div>
                            <div className="text-[12px] text-shop-text-muted mt-0.5">📦 142 items in stock · Primary location</div>
                          </div>
                          <div className="text-[12px] text-blue-600 cursor-pointer font-[500] hover:underline">Change</div>
                        </div>
                      </div>
                    </div>

                    {/* ITEMS TO FULFILL */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between">
                        <h3 className="text-[14px] font-[700] text-shop-text">Items to fulfill</h3>
                        <div className="flex items-center gap-2">
                          <div className="text-[12px] text-shop-text-muted">{(viewingCustomer.items || []).length} items</div>
                          <div className="text-[12px] text-blue-600 cursor-pointer font-[500] hover:underline" onClick={() => {
                            setFulfillmentItems(fulfillmentItems.map((item: any) => ({ ...item, qtyToFulfill: item.quantity })));
                          }}>Select all</div>
                        </div>
                      </div>
                      <div className="px-4">
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto overflow-y-hidden scrollbar-none">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="w-[48px] py-[10px]"></th>
                                <th className="text-[12px] font-[600] text-shop-text-muted uppercase tracking-[0.4px] py-[10px] text-left">Product</th>
                                <th className="w-[120px] text-center text-[12px] font-[600] text-shop-text-muted uppercase tracking-[0.4px] py-[10px]">Qty to fulfill</th>
                                <th className="w-[100px] text-right text-[12px] font-[600] text-shop-text-muted uppercase tracking-[0.4px] py-[10px]">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fulfillmentItems.map((item: any, idx: number) => (
                                <tr key={idx} className="border-t border-[#f0f0f0]">
                                  <td className="py-3">
                                    <div className="w-12 h-12 rounded-lg border border-shop-border overflow-hidden bg-gray-50">
                                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="text-[14px] font-[600] text-shop-text">{item.name}</div>
                                    <div className="text-[12px] text-shop-text-muted">
                                      {item.selectedSize && `Size: ${item.selectedSize}`}
                                      {item.selectedSize && item.selectedColor && ' / '}
                                      {item.selectedColor && `Color: ${item.selectedColor}`}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <div className="flex items-center justify-center gap-2">
                                      <input 
                                        type="number" 
                                        min="0"
                                        max={item.quantity}
                                        value={item.qtyToFulfill}
                                        onChange={(e) => {
                                          const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                          const newItems = [...fulfillmentItems];
                                          newItems[idx].qtyToFulfill = val;
                                          setFulfillmentItems(newItems);
                                        }}
                                        className="w-16 h-[34px] border border-shop-border rounded-lg text-center text-[14px] font-[600] text-shop-text focus:border-shop-green focus:ring-2 focus:ring-shop-green/10 outline-none transition-all"
                                      />
                                      <span className="text-[13px] text-shop-text-muted">of {item.quantity}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="text-[14px] font-[600] text-shop-text">₹{(Number(item.price || 0) * Number(item.qtyToFulfill || 0)).toLocaleString()}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-4 py-4">
                          {fulfillmentItems.map((item: any, idx: number) => (
                            <div key={idx} className="bg-gray-50/50 rounded-xl p-4 border border-shop-border/50">
                              <div className="flex gap-3 mb-3">
                                <div className="w-16 h-16 rounded-lg border border-shop-border overflow-hidden bg-white shrink-0">
                                  <img src={item.image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[14px] font-[700] text-shop-text truncate">{item.name}</div>
                                  <div className="text-[12px] text-shop-text-muted mt-0.5">
                                    {item.selectedSize && `Size: ${item.selectedSize}`}
                                    {item.selectedSize && item.selectedColor && ' / '}
                                    {item.selectedColor && `Color: ${item.selectedColor}`}
                                  </div>
                                  <div className="text-[14px] font-[700] text-shop-text mt-1">₹{(Number(item.price || 0)).toLocaleString()} / each</div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-3 border-t border-shop-border/30">
                                <span className="text-[12px] text-shop-text-muted font-bold uppercase tracking-wider">Qty to fulfill</span>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    min="0"
                                    max={item.quantity}
                                    value={item.qtyToFulfill}
                                    onChange={(e) => {
                                      const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                      const newItems = [...fulfillmentItems];
                                      newItems[idx].qtyToFulfill = val;
                                      setFulfillmentItems(newItems);
                                    }}
                                    className="w-16 h-9 border border-shop-border rounded-lg text-center text-[14px] font-[700] bg-white outline-none"
                                  />
                                  <span className="text-[12px] text-shop-text-muted">of {item.quantity}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-[#fafafa] border-t border-shop-border flex justify-between items-center text-[13px]">
                        <span className="text-shop-text-muted ">Total to fulfill: <strong className="text-shop-text">{fulfillmentItems.reduce((acc: number, curr: any) => acc + Number(curr.qtyToFulfill || 0), 0)} items</strong></span>
                        <span className="text-[14px] font-[700] text-shop-text">₹{fulfillmentItems.reduce((acc: number, curr: any) => acc + (Number(curr.price || 0) * Number(curr.qtyToFulfill || 0)), 0).toLocaleString()}</span>
                      </div>
                    </div>

                      {/* TRACKING */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between">
                        <h3 className="text-[14px] font-[700] text-shop-text">Tracking information</h3>
                        <span className="text-[12px] text-shop-text-muted">Optional</span>
                      </div>
                      <div className="p-4">
                        <div 
                          className="flex items-center gap-2.5 mb-5 cursor-pointer select-none"
                          onClick={() => setIsTrackingEnabled(!isTrackingEnabled)}
                        >
                          <div className={cn(
                            "w-10 h-[22px] rounded-full relative transition-all duration-200 shrink-0",
                            isTrackingEnabled ? "bg-shop-green" : "bg-gray-200"
                          )}>
                            <div className={cn(
                              "w-[16px] h-[16px] bg-white rounded-full absolute top-[3px] transition-all duration-200 shadow-sm",
                              isTrackingEnabled ? "left-[21px]" : "left-[3px]"
                            )} />
                          </div>
                          <span className="text-[14px] font-[500] text-shop-text">Add tracking number</span>
                        </div>

                        <AnimatePresence>
                          {isTrackingEnabled && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden mb-2">
                              <div>
                                <label className="block text-[12px] font-[600] text-shop-text-muted mb-1.5 uppercase tracking-wider">Carrier</label>
                                <div className="relative">
                                  <select 
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                    className="w-full h-10 border border-shop-border rounded-lg px-3 text-[14px] text-shop-text bg-white outline-none focus:border-shop-green transition-colors cursor-pointer appearance-none pr-10 shadow-sm"
                                  >
                                    <option value="">Select carrier</option>
                                    {['Blue Dart', 'Delhivery', 'DTDC', 'Ecom Express', 'FedEx', 'Xpressbees', 'Shadowfax'].map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[12px] font-[600] text-shop-text-muted mb-1.5 uppercase tracking-wider">Tracking number</label>
                                <input 
                                  type="text"
                                  value={trackingNumber}
                                  onChange={(e) => setTrackingNumber(e.target.value)}
                                  placeholder="e.g. BD12345678IN"
                                  className="w-full h-10 border border-shop-border rounded-lg px-3 text-[14px] text-shop-text focus:border-shop-green outline-none transition-colors shadow-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[12px] font-[600] text-shop-text-muted mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                                  Tracking URL <span className="text-[10px] text-gray-400 font-normal lowercase">(auto-filled)</span>
                                </label>
                                <input 
                                  readOnly
                                  type="text"
                                  value={getTrackingUrl(carrier, trackingNumber)}
                                  className="w-full h-10 border border-shop-border rounded-lg px-3 text-[13px] text-shop-text-muted bg-[#f9f9f9] outline-none"
                                />
                                <p className="text-[12px] text-gray-400 mt-2 font-[500]">Customer will receive this link to track their order</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* NOTIFY */}
                      <div className="px-4 py-[14px] border-t border-shop-border flex items-center gap-3">
                        <div 
                          className={cn(
                            "w-[20px] h-[20px] rounded-[5px] border-1.5 flex items-center justify-center cursor-pointer transition-all shadow-sm",
                            notifyCustomer ? "bg-shop-green border-shop-green" : "bg-white border-shop-border"
                          )}
                          onClick={() => setNotifyCustomer(!notifyCustomer)}
                        >
                          {notifyCustomer && <Check size={12} className="text-white stroke-[3px]" />}
                        </div>
                        <div className="text-[13px] text-shop-text leading-tight">
                          Send shipment details to <strong className="font-[600] text-blue-600">{viewingCustomer.email || 'customer'}</strong>
                        </div>
                      </div>

                      {/* FULFILL / DELIVER BTN */}
                      <div className="p-4 pt-1 space-y-2">
                        {viewingCustomer.fulfillmentStatus === 'Fulfilled' && viewingCustomer.status === 'Shipped' ? (
                          <button 
                            onClick={() => handleMarkAsDelivered(viewingCustomer)}
                            className="w-full h-11 bg-shop-text hover:bg-black text-white rounded-lg text-[15px] font-[600] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-md"
                          >
                            <CheckCheck size={18} className="text-white" />
                            <span>Mark as Delivered</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleFulfillOrder(viewingCustomer)}
                            disabled={isFulfilling || viewingCustomer.fulfillmentStatus === 'Fulfilled'}
                            className="w-full h-11 bg-shop-green hover:bg-shop-green-dark text-white rounded-lg text-[15px] font-[600] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md shadow-shop-green/20"
                          >
                            {isFulfilling ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                                  <Check size={14} className="text-white stroke-[3px]" />
                                </div>
                                <span>{viewingCustomer.fulfillmentStatus === 'Fulfilled' ? 'Order Fulfilled' : 'Fulfill items'}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-4">
                    
                    {/* ORDER SUMMARY */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between">
                        <h3 className="text-[14px] font-[700] text-shop-text">Order {viewingCustomer.orderId || `#${viewingCustomer.id.slice(-4).toUpperCase()}`}</h3>
                        <span className="bg-shop-green-light text-shop-green px-2.5 py-1 rounded-full text-[12px] font-[600]">Paid</span>
                      </div>
                      <div className="p-4 space-y-3.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Date</span>
                          <span className="text-[13px] text-shop-text font-[600] text-right">
                            {new Date(viewingCustomer.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(viewingCustomer.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Customer</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] text-blue-600 font-[700] hover:underline cursor-pointer">{viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer || 'Customer'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Email</span>
                          <span className="text-[13px] text-blue-600 font-[600] hover:underline cursor-pointer break-all text-right ml-4">
                            {viewingCustomer.address?.email || viewingCustomer.email || viewingCustomer.customerEmail || viewingCustomer.userEmail || (viewingCustomer.userId && viewingCustomer.userId !== 'guest' ? 'Logged-in User' : 'N/A')}
                          </span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Phone</span>
                          <span className="text-[13px] text-shop-text font-[600] font-mono">{viewingCustomer.address?.phone || viewingCustomer.address?.number || '+91 98765 43210'}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Payment</span>
                          <span className="text-[13px] text-shop-text font-[600]">{viewingCustomer.paymentMethod || 'Razorpay · ****4242'}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-100 flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Subtotal</span>
                          <span className="text-[13px] font-[600] text-shop-text">₹{Number(viewingCustomer.total - (viewingCustomer.tax || 0)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Shipping</span>
                          <div className="text-right">
                            <span className="text-[13px] font-[600] text-shop-text">₹0.00</span>
                            <span className="text-[11px] text-gray-400 ml-1">(Free)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-[13px] text-shop-text-muted font-[500]">Tax (18% GST)</span>
                          <span className="text-[13px] font-[600] text-shop-text">₹{Number(viewingCustomer.tax || 0).toLocaleString()}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200 flex justify-between items-start">
                          <span className="text-[14px] text-shop-text font-[800]">Total</span>
                          <span className="text-[15px] font-800 text-shop-text">₹{Number(viewingCustomer.total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* SHIP TO */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between">
                        <h3 className="text-[14px] font-[700] text-shop-text">Ship to</h3>
                        <button className="text-[12px] text-blue-600 font-[500] hover:underline">Edit</button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="space-y-0.5">
                           <p className="text-[14px] font-[700] text-shop-text">{viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer}</p>
                           <p className="text-[13px] text-shop-text-muted leading-relaxed">
                             {viewingCustomer.address?.address || viewingCustomer.shippingAddress?.line1}
                           </p>
                           <p className="text-[13px] text-shop-text-muted">
                             {viewingCustomer.address?.city || viewingCustomer.shippingAddress?.city}, {viewingCustomer.address?.state || viewingCustomer.shippingAddress?.state} – {viewingCustomer.address?.pincode || viewingCustomer.shippingAddress?.postal_code || '400 058'}
                           </p>
                           <p className="text-[13px] text-shop-text-muted">India</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] text-red-600 font-[600] cursor-pointer hover:underline">
                           <Activity size={14} className="text-red-600" />
                           <span>View on map</span>
                        </div>
                        <div className="bg-[#f6f6f7] rounded-lg p-3.5 border border-shop-border">
                           <p className="text-[10px] text-shop-text-muted font-[700] uppercase tracking-wider mb-1">Shipping Method</p>
                           <p className="text-[13px] font-[700] text-shop-text">{viewingCustomer.shippingMethod || 'Standard Delivery (3–5 days)'}</p>
                           <p className="text-[12px] text-shop-text-muted mt-0.5">Expected by {new Date(new Date(viewingCustomer.createdAt).getTime() + (5 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}–{new Date(new Date(viewingCustomer.createdAt).getTime() + (7 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                    </div>

                    {/* ADD TRACKING EVENT (ADMIN) */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                       <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between bg-gray-50/30">
                         <h3 className="text-[11px] font-[900] text-shop-text uppercase tracking-widest flex items-center gap-2">
                           <Rocket size={14} className="text-ruby" />
                           Track Journey Updates
                         </h3>
                       </div>
                       <div className="p-4 space-y-3">
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Status Title</label>
                               <input 
                                 type="text" 
                                 placeholder="e.g. Arrived at Hub"
                                 value={trackingEvent.status}
                                 onChange={e => setTrackingEvent({...trackingEvent, status: e.target.value})}
                                 className="w-full h-9 border border-shop-border rounded-lg px-3 text-[12px] font-bold outline-none focus:border-ruby transition-colors"
                               />
                            </div>
                            <div>
                               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Location</label>
                               <input 
                                 type="text" 
                                 placeholder="e.g. Delhi Hub"
                                 value={trackingEvent.location}
                                 onChange={e => setTrackingEvent({...trackingEvent, location: e.target.value})}
                                 className="w-full h-9 border border-shop-border rounded-lg px-3 text-[12px] font-bold outline-none focus:border-ruby transition-colors"
                               />
                            </div>
                         </div>
                         <button 
                           onClick={handleAddTrackingHistory}
                           disabled={isAddingEvent || !trackingEvent.status}
                           className="w-full h-9 bg-shop-text text-white rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-ruby transition-all disabled:opacity-40 shadow-lg shadow-gray-200 active:scale-95"
                         >
                           {isAddingEvent ? 'Updating Process...' : 'Publish Journey Event'}
                         </button>
                       </div>
                    </div>

                    {/* TIMELINE */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-[14px] border-b border-shop-border flex items-center justify-between">
                        <h3 className="text-[14px] font-[700] text-shop-text">Timeline Journey</h3>
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Real-time</span>
                      </div>
                      <div className="p-4 pt-5 pb-5">
                        <div className="space-y-6 relative">
                          <div className="absolute left-[11px] top-4 bottom-4 w-px bg-gray-100" />
                          
                          {/* REAL HISTORY IF EXISTS */}
                          {viewingCustomer.trackingHistory && Array.isArray(viewingCustomer.trackingHistory) && viewingCustomer.trackingHistory.length > 0 ? (
                            [...viewingCustomer.trackingHistory].sort((a, b) => {
                              const dateA = a.time?.seconds ? a.time.seconds * 1000 : new Date(a.time).getTime();
                              const dateB = b.time?.seconds ? b.time.seconds * 1000 : new Date(b.time).getTime();
                              return dateB - dateA;
                            }).map((evt, i) => {
                              const dateObj = evt.time?.toDate ? evt.time.toDate() : new Date(evt.time);
                              return (
                                <div key={evt.id || i} className="flex gap-3.5 items-start relative z-10">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-ruby text-white shadow-lg shadow-ruby/20">
                                    <MapPin size={12} />
                                  </div>
                                  <div>
                                    <div className="text-[13px] font-[700] text-shop-text leading-tight">{evt.status}</div>
                                    {evt.location && <p className="text-[11px] text-gray-500 mt-0.5">📍 {evt.location}</p>}
                                    <p className="text-[10px] text-gray-400 mt-1 font-bold italic">
                                      {dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm('Delete this event?')) {
                                        const updatedHistory = viewingCustomer.trackingHistory.filter((it: any) => (it.id || it.time) !== (evt.id || evt.time));
                                        const { error } = await supabase
                                          .from('orders')
                                          .update({
                                            tracking_history: updatedHistory
                                          })
                                          .eq('id', viewingCustomer.id);
                                        if (error) throw error;
                                        setViewingCustomer({ 
                                          ...viewingCustomer, 
                                          trackingHistory: updatedHistory 
                                        });
                                        toast.success('Event removed');
                                      }
                                    }}
                                    className="ml-auto p-1.5 text-gray-200 hover:text-red-500 transition-colors"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            [
                              { title: 'Order Fulfilled', status: viewingCustomer.fulfillmentStatus === 'Fulfilled', date: viewingCustomer.fulfilledAt || null, icon: CheckCheck },
                              { title: `Payment received via ${viewingCustomer.paymentMethod || 'Razorpay'}`, status: true, date: viewingCustomer.createdAt, icon: CreditCard, subtitle: `(₹${Number(viewingCustomer.total || 0).toLocaleString()})` },
                              { title: `Order placed by ${viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer || 'Customer'}`, status: true, date: viewingCustomer.createdAt, icon: ShoppingBag },
                            ].map((evt, i) => (
                              <div key={i} className={cn("flex gap-3.5 items-start relative z-10", !evt.status && "opacity-40 grayscale")}>
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all",
                                  evt.status ? "bg-shop-green text-white" : "bg-white border border-gray-200 text-gray-300",
                                  i === 1 && "bg-yellow-100 text-yellow-600",
                                  i === 2 && "bg-blue-100 text-blue-600"
                                )}>
                                  {i === 1 ? <CreditCard size={12} /> : (i === 2 ? <ShoppingBag size={12} /> : <evt.icon size={12} />)}
                                </div>
                                <div>
                                  <div className={cn("text-[13px] font-[600] text-shop-text leading-tight mt-0.5", i === 0 && "mt-1")}>{evt.title}</div>
                                  {evt.subtitle && <p className="text-[12px] text-shop-text-muted mt-0.5">{evt.subtitle}</p>}
                                  <p className="text-[11px] text-gray-400 mt-1">
                                    {evt.status ? (i === 0 ? new Date(evt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + new Date(evt.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Today at ' + new Date(evt.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })) : 'Pending'}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SHIPPING LABEL */}
                    <div className="bg-white border border-shop-border rounded-xl shadow-sm overflow-hidden">
                       <div className="px-4 py-[14px] border-b border-shop-border flex justify-between items-center">
                         <h3 className="text-[14px] font-[700] text-shop-text">Shipping label</h3>
                         <button className="text-[12px] text-blue-600 font-[700] flex items-center gap-1.5 hover:underline" onClick={() => generateShippingLabel(viewingCustomer)}>
                            <Printer size={13} />
                            <span>Print</span>
                         </button>
                       </div>
                       <div className="p-4">
                          <div className="bg-white rounded-lg p-5 border border-shop-border shadow-inner relative">
                             <div className="flex justify-between items-start mb-6">
                                <div className="space-y-0.5">
                                   <p className="text-[9px] text-shop-text-muted font-[700] uppercase tracking-widest">FROM</p>
                                   <p className="text-[13px] font-[800] text-shop-text">THE RUBY</p>
                                   <p className="text-[11px] text-shop-text-muted">Mumbai, MH 400001</p>
                                </div>
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center opacity-80">
                                   <Package size={20} className="text-orange-600" />
                                </div>
                             </div>

                             <div className="border-t border-dashed border-gray-300 my-4" />

                             <div className="space-y-4">
                                <div className="space-y-0.5">
                                   <p className="text-[9px] text-shop-text-muted font-[700] uppercase tracking-widest">TO</p>
                                   <p className="text-[14px] font-[800] text-shop-text uppercase">{viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer || 'CUSTOMER'}</p>
                                   <p className="text-[11px] text-shop-text-muted leading-relaxed font-[500] max-w-[200px]">
                                      {viewingCustomer.address?.address || viewingCustomer.shippingAddress?.line1}, {viewingCustomer.address?.city || viewingCustomer.shippingAddress?.city}
                                   </p>
                                   <p className="text-[11px] text-shop-text-muted font-[500]">{viewingCustomer.address?.state || viewingCustomer.shippingAddress?.state} – {viewingCustomer.address?.pincode || viewingCustomer.shippingAddress?.postal_code || '400058'}</p>
                                   <p className="text-[11px] text-shop-text-muted font-[600]">{viewingCustomer.address?.phone || viewingCustomer.address?.number || '+91 98765 43210'}</p>
                                </div>

                                {trackingNumber && isTrackingEnabled ? (
                                   <div className="flex flex-col items-center pt-2">
                                      <Barcode 
                                        value={trackingNumber} 
                                        width={1.6} 
                                        height={65} 
                                        displayValue={false}
                                        margin={0}
                                        background="transparent"
                                      />
                                      <p className="text-[11px] font-mono text-gray-500 mt-2.5 uppercase tracking-[4px]">{trackingNumber}</p>
                                   </div>
                                ) : (
                                   <div className="py-8 text-center text-[12px] text-shop-text-muted bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                      Fill tracking details to generate barcode
                                   </div>
                                )}
                             </div>

                             <div className="mt-8 flex justify-between items-center text-[10px] text-shop-text-muted font-[600]">
                                <p>Wt: 0.8 kg</p>
                                <p>Order: {viewingCustomer.orderId || `#${viewingCustomer.id.slice(-4).toUpperCase()}`}</p>
                             </div>
                             
                             {/* Faded Background Element */}
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40px] font-black text-gray-100/40 select-none -rotate-12 pointer-events-none">
                                THE RUBY
                             </div>
                          </div>
                       </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* SUCCESS OVERLAY (Exact Match style) */}
              <AnimatePresence>
                {showSuccessOverlay && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[2000] flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-[400px] w-full text-center shadow-2xl relative overflow-hidden">
                      <div className="w-[64px] h-[64px] bg-shop-green-light rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCheck size={32} className="text-shop-green stroke-[2.5px]" />
                      </div>
                      <h3 className="text-[20px] font-[800] text-shop-text mb-1.5">Fulfillment successful</h3>
                      <p className="text-shop-text-muted text-[14px] leading-relaxed mb-6">The shipment details have been logged and the customer notify queue has been updated.</p>
                      
                      {trackingNumber && (
                        <div className="bg-[#f6f6f7] rounded-lg p-3.5 mb-5 text-left border border-shop-border">
                          <p className="text-[11px] font-[600] text-shop-text-muted uppercase tracking-[0.4px] mb-1">Tracking ID</p>
                          <p className="text-[14px] font-[700] text-shop-text tracking-wider">{trackingNumber}</p>
                        </div>
                      )}

                      <div className="flex gap-2.5">
                        <button onClick={() => setShowSuccessOverlay(false)} className="flex-1 h-[38px] bg-white border border-shop-border rounded-lg text-[13px] font-[600] text-shop-text hover:bg-gray-50 transition-colors">Dismiss</button>
                        <button onClick={() => { 
                          setShowSuccessOverlay(false);
                          setViewingCustomer(null);
                        }} className="flex-1 h-[38px] bg-shop-green text-white rounded-lg text-[13px] font-[600] hover:bg-shop-green-dark transition-colors">Return to orders</button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          )}

          {activeTab === 'returns' && (
            <div className="space-y-6 w-full max-w-full px-1">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
                <div>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1A2C54] tracking-tighter font-syne uppercase flex items-center gap-3">
                    <RotateCcw className="text-purple-600" size={32} />
                    <span>Returns & Refunds</span>
                  </h1>
                  <p className="text-gray-400 mt-1 text-sm sm:text-base font-medium">
                    Manage Flipkart/Amazon-style customer return requests, pickups, and refunds.
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-shop-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Order ID, Customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-shop-border bg-gray-50/50 text-xs font-semibold focus:bg-white focus:border-purple-500 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                  {['All', 'Requested', 'Approved', 'Refunded', 'Rejected'].map((statusFilter) => {
                    const isSelected = (statusTab || 'All') === statusFilter;
                    return (
                      <button
                        key={statusFilter}
                        onClick={() => setStatusTab(statusFilter)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                          isSelected
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {statusFilter}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Returns List */}
              {(() => {
                const returnOrders = orders.filter(o => {
                  const hasReturn = o.returnStatus || o.returnReason || o.status === 'Return Requested' || o.status === 'Returned' || o.status === 'returned';
                  if (!hasReturn) return false;

                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    const matchesId = o.orderId?.toLowerCase().includes(query) || o.id?.toLowerCase().includes(query);
                    const matchesName = (o.address?.name || o.customerName || '').toLowerCase().includes(query);
                    if (!matchesId && !matchesName) return false;
                  }

                  if (statusTab && statusTab !== 'All') {
                    const rStatus = o.returnStatus || 'Requested';
                    if (statusTab === 'Requested' && (rStatus.toLowerCase() === 'requested' || rStatus.toLowerCase() === 'pending')) return true;
                    if (rStatus.toLowerCase() !== statusTab.toLowerCase()) return false;
                  }

                  return true;
                });

                if (returnOrders.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl border border-shop-border p-12 text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                        <RotateCcw size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">No Return Requests Found</h3>
                      <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        There are currently no customer return requests matching your filter.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {returnOrders.map((order) => {
                      const currentReturnStatus = order.returnStatus || 'Requested';
                      return (
                        <div key={order.id} className="bg-white rounded-2xl border border-shop-border shadow-sm overflow-hidden hover:border-purple-200 transition-all">
                          {/* Card Top Header */}
                          <div className="p-4 sm:p-5 bg-gray-50/70 border-b border-shop-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                                <RotateCcw size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-bold text-gray-900">{order.orderId || `#${order.id.slice(-6).toUpperCase()}`}</h3>
                                  <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                                    currentReturnStatus === 'Approved' ? "bg-blue-100 text-blue-700" :
                                    currentReturnStatus === 'Refunded' ? "bg-emerald-100 text-emerald-700" :
                                    currentReturnStatus === 'Rejected' ? "bg-red-100 text-red-700" :
                                    "bg-purple-100 text-purple-800"
                                  )}>
                                    {currentReturnStatus}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 font-medium">
                                  Customer: <strong className="text-gray-800">{order.address?.name || order.customerName || 'Customer'}</strong> ({order.address?.phone || order.address?.email || 'N/A'})
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                              <span className="text-xs text-gray-400 font-medium">
                                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              <button
                                onClick={() => {
                                  setViewingCustomer(order);
                                  setActiveTab('orders');
                                }}
                                className="px-3.5 py-1.5 rounded-xl border border-shop-border bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5"
                              >
                                <span>Full Order</span>
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Reason & Comments Box */}
                          <div className="p-4 sm:p-5 border-b border-shop-border bg-purple-50/30 space-y-2 text-xs">
                            <div className="flex items-start gap-2 text-purple-950">
                              <span className="font-bold shrink-0">Return Reason:</span>
                              <span className="font-semibold text-purple-900">{order.returnReason || 'Not specified'}</span>
                            </div>
                            {order.returnComments && (
                              <div className="p-3 bg-white/80 rounded-xl border border-purple-100 text-purple-900 italic">
                                "{order.returnComments}"
                              </div>
                            )}
                          </div>

                          {/* Items Grid */}
                          <div className="p-4 sm:p-5 divide-y divide-gray-100">
                            {order.items?.map((item: any, idx: number) => (
                              <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-lg border border-shop-border overflow-hidden bg-gray-50 shrink-0">
                                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-gray-900">{item.name}</p>
                                    <p className="text-[11px] text-gray-400">Qty: {item.quantity} {item.selectedSize ? `• Size: ${item.selectedSize}` : ''}</p>
                                  </div>
                                </div>
                                <p className="text-xs font-bold text-gray-900">₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>

                          {/* Admin Action Bar */}
                          <div className="p-4 sm:p-5 bg-gray-50/50 border-t border-shop-border flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-gray-500 font-medium">
                              Total Order Value: <strong className="text-gray-900 text-sm">₹{Number(order.total || 0).toLocaleString()}</strong>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              {(currentReturnStatus.toLowerCase() === 'requested' || currentReturnStatus.toLowerCase() === 'pending') && (
                                <>
                                  <button
                                    onClick={() => handleUpdateReturnStatus(order.id, 'Approved')}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                                  >
                                    <Check size={14} />
                                    <span>Approve Return</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejecting return?");
                                      if (reason !== null) {
                                        handleUpdateReturnStatus(order.id, 'Rejected', reason);
                                      }
                                    }}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <X size={14} />
                                    <span>Reject Request</span>
                                  </button>
                                </>
                              )}

                              {currentReturnStatus.toLowerCase() === 'approved' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateReturnStatus(order.id, 'Picked Up')}
                                    className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                                  >
                                    <Truck size={14} />
                                    <span>Mark Picked Up</span>
                                  </button>
                                  <button
                                    onClick={() => handleUpdateReturnStatus(order.id, 'Refunded')}
                                    className="flex-1 sm:flex-none px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Mark Picked Up & Refund</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejecting return?");
                                      if (reason !== null) {
                                        handleUpdateReturnStatus(order.id, 'Rejected', reason);
                                      }
                                    }}
                                    className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <X size={14} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {(currentReturnStatus.toLowerCase() === 'picked up' || currentReturnStatus.toLowerCase() === 'picked_up') && (
                                <>
                                  <button
                                    onClick={() => handleUpdateReturnStatus(order.id, 'Refunded')}
                                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 size={14} />
                                    <span>Process Refund</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejecting return?");
                                      if (reason !== null) {
                                        handleUpdateReturnStatus(order.id, 'Rejected', reason);
                                      }
                                    }}
                                    className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <X size={14} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {currentReturnStatus.toLowerCase() === 'refunded' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                  <CheckCircle2 size={14} />
                                  <span>Refund Processed & Completed</span>
                                </span>
                              )}

                              {currentReturnStatus.toLowerCase() === 'rejected' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                                  <XCircle size={14} />
                                  <span>Return Request Rejected</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'category' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Categories</h2>
                  <p className="text-sm text-gray-400">Manage product categories</p>
                </div>
                <button onClick={handleAddCategory} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Category
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col space-y-4 group hover:border-ruby/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden border border-gray-100">
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button onClick={() => handleEditCategory(cat)} className="p-2 text-gray-300 hover:text-ruby transition-colors" title="Edit Category">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Delete Category">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2C54] flex items-center justify-between">
                        <span>{cat.name}</span>
                        {cat.sortOrder !== undefined && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono">
                            Order: {cat.sortOrder}
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">{cat.slug}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'colour' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Colors</h2>
                  <p className="text-sm text-gray-400">Manage product color options</p>
                </div>
                <button onClick={handleAddColor} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Color
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {colors.map(color => (
                  <div key={color.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 group hover:border-ruby/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl shadow-inner border border-gray-100" style={{ backgroundColor: color.hex }}></div>
                      <button onClick={() => handleDeleteColor(color.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2C54]">{color.name}</h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">{color.hex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'size' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Sizes</h2>
                  <p className="text-sm text-gray-400">Manage product size options</p>
                </div>
                <button onClick={handleAddSize} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Size
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-6">
                {sizes.map(size => (
                  <div key={size.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-2 group hover:border-ruby/30 transition-all">
                    <span className="text-xl font-black text-[#1A2C54]">{size.name}</span>
                    <button onClick={() => handleDeleteSize(size.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'coupon' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Coupons</h2>
                  <p className="text-sm text-gray-400">Manage discount codes</p>
                </div>
                <button onClick={handleAddCoupon} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Coupon
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.map(coupon => (
                  <div key={coupon.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 group hover:border-ruby/30 transition-all relative overflow-hidden flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="px-3 py-1 bg-ruby/10 text-ruby rounded-lg text-xs font-black tracking-widest uppercase">
                          {coupon.code}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button onClick={() => handleEditCoupon(coupon)} className="p-2 text-gray-300 hover:text-ruby transition-colors" title="Edit Coupon">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Delete Coupon">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-[#1A2C54]">
                          {coupon.type === 'free_shipping' ? 'FREE SHIPPING' : coupon.type === 'percentage' ? `${coupon.value ?? coupon.discount}% OFF` : `₹${coupon.value ?? coupon.discount} OFF`}
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                          {coupon.type === 'free_shipping' ? 'Free Shipping Offer' : coupon.type === 'percentage' ? 'Percentage Discount' : 'Flat Discount'}
                        </p>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-500 font-medium pt-2 border-t border-gray-50">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-400">Min Cart Value:</span>
                          <span className="font-bold text-[#1A2C54]">₹{coupon.min_cart_value || coupon.minCartValue || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-400">Usage Count:</span>
                          <span className="font-bold text-[#1A2C54]">
                            {coupon.used_count ?? coupon.usedCount ?? 0} {coupon.usage_limit || coupon.usageLimit ? `/ ${coupon.usage_limit || coupon.usageLimit}` : '(Unlimited)'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${coupon.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{coupon.active ? 'Active' : 'Inactive'}</span>
                      </div>
                      {(coupon.end_date || coupon.expiryDate) && (
                        <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">
                          Exp: {new Date(coupon.end_date || coupon.expiryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'promotions' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div>
                  <h2 className="text-2xl font-black text-[#1A2C54] tracking-tight uppercase italic">Promotion Engine <span className="text-ruby">PRO</span> 🔥</h2>
                  <p className="text-sm text-gray-400 font-medium">Create and manage your advanced store offers and multi-buy logic</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingPromotion(null);
                    setPromotionForm({
                      name: '',
                      description: '',
                      priority: 1,
                      status: 'draft',
                      type: 'bxgy',
                      conditions: { minCartValue: 0, minQuantity: 0, productIds: [], categoryIds: [], userType: 'all', startDate: '', endDate: '' },
                      bxgyConfig: { buyQty: 2, getQty: 1, applyOn: 'same', maxFree: 1, repeat: false },
                      reward: { method: 'auto', value: 100 },
                      limits: { perUser: 1, totalUsage: 100, maxDiscount: 0 },
                      stackable: false
                    });
                    setIsPromotionModalOpen(true);
                  }} 
                  className="bg-ruby text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-xl shadow-ruby/20 active:scale-95"
                >
                  <Plus size={18} className="mr-2" /> Create New Offer
                </button>
              </div>

              {/* Promotion List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.map((promo) => (
                  <motion.div 
                    key={promo.id}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col group hover:border-ruby/30 transition-all"
                  >
                    <div className={`p-6 ${promo.status === 'active' ? 'bg-emerald-50/50' : 'bg-gray-50/50'} border-b border-gray-50 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${promo.status === 'active' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-gray-200 text-gray-400 uppercase'}`}>
                          {promo.type === 'bxgy' ? <Zap size={18} /> : promo.type === 'percentage' ? <Percent size={18} /> : (promo.type === 'shipping' ? <Truck size={18} /> : <Ticket size={18} />)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{promo.type} offer</p>
                          <h3 className="text-sm font-black text-[#1A2C54] truncate max-w-[120px]">{promo.name}</h3>
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ring-1 ring-inset ${
                        promo.status === 'active' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-400 ring-gray-200'
                      }`}>
                        {promo.status}
                      </div>
                    </div>
                    
                    <div className="p-6 flex-grow space-y-4">
                      <p className="text-[11px] text-gray-500 line-clamp-2 font-medium leading-relaxed">{promo.description || 'No description provided for this promotion.'}</p>
                      
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-50">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Priority</p>
                          <p className="text-xs font-black text-[#1A2C54]">{promo.priority}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Stackable</p>
                          <p className="text-xs font-black text-[#1A2C54]">{promo.stackable ? 'YES ✅' : 'NO ❌'}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Conditions</h4>
                        <div className="flex flex-wrap gap-2">
                          {promo.conditions.minCartValue > 0 && (
                            <span className="px-2 py-1 bg-ruby/5 text-ruby text-[9px] font-bold rounded-md">Min: ₹{promo.conditions.minCartValue}</span>
                          )}
                          {promo.conditions.minQuantity > 0 && (
                            <span className="px-2 py-1 bg-ruby/5 text-ruby text-[9px] font-bold rounded-md">Qty: {promo.conditions.minQuantity}+</span>
                          )}
                          <span className="px-2 py-1 bg-ruby/5 text-ruby text-[9px] font-bold rounded-md uppercase tracking-tight">Users: {promo.conditions.userType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50/50 flex items-center justify-between gap-3">
                      <button 
                        onClick={() => {
                          setEditingPromotion(promo);
                          setPromotionForm({
                            name: promo.name || '',
                            description: promo.description || '',
                            priority: promo.priority ?? 1,
                            status: promo.status || 'draft',
                            type: promo.type || 'bxgy',
                            conditions: {
                              minCartValue: promo.conditions?.minCartValue ?? 0,
                              minQuantity: promo.conditions?.minQuantity ?? 0,
                              productIds: promo.conditions?.productIds || [],
                              categoryIds: promo.conditions?.categoryIds || [],
                              userType: promo.conditions?.userType || 'all',
                              startDate: promo.conditions?.startDate || '',
                              endDate: promo.conditions?.endDate || ''
                            },
                            bxgyConfig: {
                              buyQty: (promo.bxgyConfig || promo.bxgy_config)?.buyQty ?? 2,
                              getQty: (promo.bxgyConfig || promo.bxgy_config)?.getQty ?? 1,
                              applyOn: (promo.bxgyConfig || promo.bxgy_config)?.applyOn || 'same',
                              maxFree: (promo.bxgyConfig || promo.bxgy_config)?.maxFree ?? 1,
                              repeat: (promo.bxgyConfig || promo.bxgy_config)?.repeat ?? false
                            },
                            reward: {
                              method: promo.reward?.method || 'auto',
                              value: promo.reward?.value ?? 100
                            },
                            limits: {
                              perUser: promo.limits?.perUser ?? 1,
                              totalUsage: promo.limits?.totalUsage ?? 100,
                              maxDiscount: promo.limits?.maxDiscount ?? 0
                            },
                            stackable: promo.stackable ?? false
                          });
                          setIsPromotionModalOpen(true);
                        }}
                        className="flex-grow py-2.5 bg-white border border-gray-100 text-[#1A2C54] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A2C54] hover:text-white transition-all shadow-sm"
                      >
                        Edit Offer
                      </button>
                      <button 
                        onClick={() => handleDeletePromotion(promo.id)}
                        className="p-2.5 bg-white text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm border border-gray-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}

                {promotions.length === 0 && (
                  <div className="col-span-full py-20 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-6">
                    <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-gray-200">
                      <Zap size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">No active promotions</p>
                      <p className="text-xs text-gray-400 font-medium">Click the button above to start creating your first advanced offer!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'customer' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-[#1A2C54]">Customers</h2>
                  <p className="text-sm text-gray-400 font-medium">Manage your community and user insights</p>
                </div>
              </div>

              {selectedCustomer ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 max-w-[1000px] mx-auto pb-20"
                >
                  {/* BREADCRUMB */}
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setSelectedCustomer(null)} className="text-blue-600 hover:underline">Customers</button>
                    <span className="text-gray-400">›</span>
                    <span className="text-gray-500">{selectedCustomer.displayName || 'Anonymous'}</span>
                  </div>

                  {/* PAGE HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedCustomer(null)}
                        className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm hover:border-gray-400 transition-all"
                      >
                        <ArrowLeft size={16} className="text-gray-700" />
                      </button>
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 font-syne tracking-tight">{selectedCustomer.displayName || 'Anonymous'}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider">
                            {selectedCustomer.role || 'Customer'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">• Customer since {ensureDate(selectedCustomer.createdAt).getFullYear()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => {
                          const customerId = selectedCustomer.id || selectedCustomer.email;
                          const existingChat = chats.find(c => c.id === customerId || c.userId === customerId || c.user_id === customerId || (selectedCustomer.email && c.userEmail === selectedCustomer.email));
                          if (existingChat) {
                            setSelectedChat(existingChat);
                            setActiveTab('chats');
                          } else {
                            toast.error("No active chat found for this customer.");
                          }
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <MessageSquare size={14} />
                        Message
                      </button>
                      <button 
                        onClick={() => handleUpdateUserRole(selectedCustomer.id, selectedCustomer.role || 'user')}
                        className="flex-1 sm:flex-none px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm"
                      >
                        Edit Role
                      </button>
                    </div>
                  </div>

                  {/* GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
                    
                    {/* LEFT COLUMN */}
                    <div className="space-y-4">
                      
                      {/* STATS GRID */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { 
                            label: 'Total Orders', 
                            value: orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).length, 
                            icon: ShoppingBag, 
                            color: 'text-blue-600', 
                            bgColor: 'bg-blue-50' 
                          },
                          { 
                            label: 'Lifetime Value', 
                            value: `₹${orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}`, 
                            icon: TrendingUp, 
                            color: 'text-green-600', 
                            bgColor: 'bg-green-50' 
                          },
                          { 
                            label: 'Loyalty Points', 
                            value: selectedCustomer.loyaltyPoints || 0, 
                            icon: Star, 
                            color: 'text-yellow-600', 
                            bgColor: 'bg-yellow-50' 
                          },
                          { 
                            label: 'Avg. Order', 
                            value: `₹${Math.round(orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).reduce((sum, o) => sum + (o.total || 0), 0) / (orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).length || 1)).toLocaleString()}`, 
                            icon: Activity, 
                            color: 'text-purple-600', 
                            bgColor: 'bg-purple-50' 
                          },
                        ].map((stat, i) => (
                          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 group hover:border-gray-400 transition-all">
                            <div className={`w-10 h-10 rounded-xl ${stat.bgColor} ${stat.color} flex items-center justify-center shadow-sm`}>
                              <stat.icon size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                              <p className="text-lg font-black text-gray-900 truncate font-syne">{stat.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ORDER HISTORY */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
                          <span className="text-xs text-gray-500">{orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).length} orders total</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                              <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                                <th className="py-3 px-4">Order</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).length > 0 ? (
                                orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).map((order, i) => (
                                  <tr 
                                    key={i} 
                                    className="group hover:bg-gray-50/50 transition-colors cursor-pointer"
                                    onClick={() => {
                                      setSelectedCustomer(null);
                                      setViewingCustomer(order);
                                      setActiveTab('orders');
                                    }}
                                  >
                                    <td className="py-3 px-4">
                                      <span className="text-sm font-bold text-blue-600 hover:underline">#{order.orderId || order.id.slice(-6)}</span>
                                    </td>
                                    <td className="py-3 px-4 text-xs text-gray-500">
                                      {ensureDate(order.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-4">
                                      <StatusBadge status={getEffectiveOrderStatus(order)} />
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-sm text-gray-900">
                                      ₹{Number(order.total || 0).toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="py-12 text-center">
                                    <ShoppingBag size={32} className="text-gray-200 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No orders found</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* SAVED ADDRESSES */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-sm font-bold text-gray-900">Saved Addresses</h3>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                            selectedCustomer.addresses.map((addr: any, i: number) => (
                              <div key={i} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 relative group">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{addr.type || 'Address'}</span>
                                  {addr.isDefault && <CheckCheck size={14} className="text-green-600" />}
                                </div>
                                <p className="text-sm font-bold text-gray-900">{addr.fullName}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  {addr.addressLine1}, {addr.city}, {addr.state} - {addr.pincode}
                                </p>
                                <button className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <Activity size={24} className="text-gray-300 mx-auto mb-2" />
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No addresses saved</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* LOYALTY POINTS HISTORY */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-500" />
                            Loyalty Points History
                          </h3>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                            Balance: {selectedCustomer.loyaltyPoints || 0} pts
                          </span>
                        </div>
                        <div className="p-4">
                          {loadingCustomerLogs ? (
                            <div className="py-6 text-center text-xs text-gray-400 font-medium">Loading history...</div>
                          ) : customerLoyaltyLogs.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {customerLoyaltyLogs.map((log) => {
                                const isEarned = log.type === 'earned' || log.type === 'bonus';
                                return (
                                  <div key={log.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs border border-gray-100">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className={cn(
                                        "w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0",
                                        log.type === 'earned' ? "bg-emerald-100 text-emerald-700" :
                                        log.type === 'bonus' ? "bg-purple-100 text-purple-700" :
                                        "bg-rose-100 text-rose-700"
                                      )}>
                                        {isEarned ? '+' : '-'}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="font-bold text-gray-800 truncate">{log.description || log.type}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                      </div>
                                    </div>
                                    <span className={cn("font-bold shrink-0 ml-2", isEarned ? "text-emerald-600" : "text-rose-600")}>
                                      {isEarned ? `+${log.points}` : `-${log.points}`} pts
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No loyalty activity logged</p>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="space-y-4">
                      
                      {/* CUSTOMER OVERVIEW */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-6 text-center border-b border-gray-100">
                          <div className="relative inline-block mb-4">
                            <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden mx-auto">
                              <img 
                                src={selectedCustomer.photoURL || selectedCustomer.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedCustomer.displayName || selectedCustomer.email}`} 
                                alt="Avatar" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-green-500 border-2 border-white rounded-lg flex items-center justify-center shadow-sm">
                              <CheckCheck size={14} className="text-white" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">{selectedCustomer.displayName || 'Anonymous'}</h3>
                          <p className="text-xs text-gray-500 mt-1">Customer since {ensureDate(selectedCustomer.createdAt).getFullYear()}</p>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-900 truncate flex-1 mr-2">{selectedCustomer.email}</p>
                              <button className="text-blue-600"><Mail size={14} /></button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-900">{selectedCustomer.phoneNumber || 'Not provided'}</p>
                              <button className="text-green-600"><Phone size={14} /></button>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-gray-100 space-y-2">
                            <button 
                              onClick={() => {
                                setBonusPointsInput('100');
                                setBonusReasonInput('VIP Reward Bonus');
                                setIsGrantBonusModalOpen(true);
                              }}
                              className="w-full py-2 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Sparkles size={12} />
                              Grant Bonus Points
                            </button>
                            <button 
                              onClick={() => {
                                setCustomerToDelete(selectedCustomer);
                                setIsCustomerDeleteModalOpen(true);
                              }}
                              className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 size={12} />
                              Delete Customer
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* TAGS / NOTES */}
                      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900">Tags</h3>
                          <button className="text-xs font-bold text-blue-600 hover:underline">Edit</button>
                        </div>
                        <div className="p-4 flex flex-wrap gap-2">
                          {['VIP', 'Frequent Buyer', 'Mumbai'].map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {tag}
                            </span>
                          ))}
                          <button className="w-6 h-6 border border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                    </div>

                  </div>
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6">
                  {customers.map(customer => (
                    <motion.div 
                      key={customer.id}
                      whileHover={{ y: -5 }}
                      onClick={() => setSelectedCustomer(customer)}
                      className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-ruby/20 transition-all cursor-pointer text-center space-y-4 group"
                    >
                      <div className="relative mx-auto w-20 h-20">
                        <div className="w-full h-full rounded-[1.5rem] bg-gray-50 border-2 border-white shadow-lg overflow-hidden group-hover:scale-105 transition-transform">
                          <img 
                            src={customer.photoURL || customer.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${customer.displayName || customer.email}`} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg shadow-md flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full ${customer.role === 'admin' ? 'bg-ruby' : 'bg-blue-500'}`} />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#1A2C54] truncate group-hover:text-ruby transition-colors">{customer.displayName || 'Anonymous'}</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 truncate">{customer.email}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rocket' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Marketing & Promotions</h2>
                  <p className="text-sm text-gray-400">Manage homepage banners and promotional content</p>
                </div>
                <button onClick={handleOpenAddBanner} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Banner
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {banners.map(banner => (
                  <div key={banner.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-ruby/30 transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      {banner.image && <img src={banner.image} alt="Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button 
                          onClick={() => handleToggleBanner(banner.id, banner.active)}
                          className={`p-2 rounded-xl backdrop-blur-md border border-white/20 transition-all text-[10px] font-bold uppercase tracking-widest ${banner.active ? 'bg-green-500/80 text-white' : 'bg-gray-500/80 text-white'}`}
                        >
                          {banner.active ? 'Active' : 'Inactive'}
                        </button>
                        <button 
                          onClick={() => handleEditBanner(banner)}
                          className="p-2 bg-blue-500/80 text-white rounded-xl backdrop-blur-md border border-white/20 hover:bg-blue-600 transition-all"
                          title="Edit Banner"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-2 bg-red-500/80 text-white rounded-xl backdrop-blur-md border border-white/20 hover:bg-red-600 transition-all"
                          title="Delete Banner"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 items-start">
                        {banner.title && (
                          <div className="bg-[#1A1A1A]/90 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider">
                            {banner.title}
                          </div>
                        )}
                        {banner.link && (
                          <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-gray-600 truncate max-w-[200px]">
                            Link: {banner.link}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight underline decoration-dotted decoration-gray-300 underline-offset-8">Business Analytics</h2>
                  <p className="text-sm text-gray-400 font-medium mt-3">Deep dive into your store's performance metrics</p>
                </div>
                <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                  {['7D', '30D', '90D', 'ALL'].map((period) => (
                    <button 
                      key={period}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === '30D' ? 'bg-ruby text-white shadow-lg shadow-ruby/20' : 'text-gray-400 hover:text-[#1A2C54]'}`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={20} className="text-ruby" />
                      Revenue Growth
                    </h3>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Period Revenue</p>
                      <p className="text-xl font-black text-ruby">₹{totalRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="h-[350px] w-full">
                    <ChartContainer isMounted={isMounted}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E11D48" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#9CA3AF', fontSize: 10, fontWeight: 'bold'}} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#9CA3AF', fontSize: 10, fontWeight: 'bold'}}
                          tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}}
                          itemStyle={{fontWeight: '900', fontSize: '14px'}}
                          labelStyle={{fontWeight: 'bold', color: '#9CA3AF', marginBottom: '4px'}}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#E11D48" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorRevenue)" 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest">Order Status</h3>
                  <div className="h-[250px] relative">
                    <ChartContainer isMounted={isMounted}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Delivered', value: orders.filter(o => o.status === 'Delivered').length, color: '#22C55E' },
                            { name: 'Pending', value: orders.filter(o => o.status === 'Pending').length, color: '#FACC15' },
                            { name: 'Shipped', value: orders.filter(o => o.status === 'Shipped').length, color: '#3B82F6' },
                            { name: 'Cancelled', value: orders.filter(o => o.status === 'Cancelled').length, color: '#EF4444' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {[
                            { color: '#22C55E' },
                            { color: '#FACC15' },
                            { color: '#3B82F6' },
                            { color: '#EF4444' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ChartContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-2xl font-black text-[#1A2C54]">{orders.length}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Orders</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Delivered', color: 'bg-green-500', count: orders.filter(o => o.status === 'Delivered').length },
                      { label: 'Pending', color: 'bg-yellow-400', count: orders.filter(o => o.status === 'Pending').length },
                      { label: 'Shipped', color: 'bg-blue-500', count: orders.filter(o => o.status === 'Shipped').length },
                      { label: 'Cancelled', color: 'bg-red-500', count: orders.filter(o => o.status === 'Cancelled').length },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{item.label}</span>
                        <span className="text-[10px] font-black text-[#1A2C54] ml-auto">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Categories */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest">Category Performance</h3>
                  <div className="space-y-6">
                    {categories.slice(0, 4).map((cat, i) => {
                      const catOrders = orders.filter(o => o.items?.some((item: any) => item.category === cat.name)).length;
                      const percentage = orders.length > 0 ? (catOrders / orders.length) * 100 : 0;
                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-ruby">
                                <Tags size={14} />
                              </div>
                              <span className="text-xs font-bold text-[#1A2C54]">{cat.name}</span>
                            </div>
                            <span className="text-xs font-black text-ruby">{Math.round(percentage)}%</span>
                          </div>
                          <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className="h-full bg-ruby rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { 
                      label: 'Average Order Value', 
                      value: `₹${(totalRevenue / (orders.length || 1)).toFixed(2)}`, 
                      trend: '+5.2%', 
                      trendUp: true,
                      desc: 'Revenue per unique order'
                    },
                    { 
                      label: 'Customer Acquisition', 
                      value: customers.filter(c => {
                        const joined = new Date(c.createdAt);
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return joined > thirtyDaysAgo;
                      }).length, 
                      trend: '+12.4%', 
                      trendUp: true,
                      desc: 'New users in last 30 days'
                    },
                    { 
                      label: 'Return Customer Rate', 
                      value: '24.8%', 
                      trend: '+2.1%', 
                      trendUp: true,
                      desc: 'Customers with >1 order'
                    },
                    { 
                      label: 'Abandoned Cart Rate', 
                      value: `${Math.round((abandonedCarts.length / (orders.length + abandonedCarts.length || 1)) * 100)}%`, 
                      trend: '-1.5%', 
                      trendUp: false,
                      desc: 'Potential revenue lost'
                    },
                  ].map((metric, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 group hover:border-ruby/20 transition-all">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{metric.label}</p>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${metric.trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {metric.trend}
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-black text-[#1A2C54]">{metric.value}</p>
                        <p className="text-[10px] font-medium text-gray-400 mt-1">{metric.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">Notifications</h2>
                  <p className="text-xs md:text-sm text-gray-400">Stay updated with your store activities</p>
                </div>
                <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                  <button 
                    onClick={requestNotificationPermission}
                    disabled={isSubscribingPush}
                    className="flex-1 sm:flex-none bg-ruby text-white px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    <Smartphone size={14} className="md:w-4 md:h-4" />
                    {isSubscribingPush ? 'Enabling...' : 'Enable Push'}
                  </button>
                  <button 
                    onClick={() => setNotifications([])}
                    className="flex-1 sm:flex-none bg-ruby/10 text-ruby px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-ruby/20 transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {notifications.length === 0 ? (
                  <div className="p-12 md:p-20 text-center space-y-4">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                      <Bell size={32} className="md:w-10 md:h-10" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">No new notifications at the moment.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className="p-4 md:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group border-b border-gray-50 last:border-0"
                      >
                        <div className="flex items-start space-x-3 md:space-x-4 w-full">
                          <div className={cn(
                            "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0",
                            notif.type === 'test' ? "bg-blue-50 text-blue-600" : "bg-ruby/10 text-ruby"
                          )}>
                            {notif.type === 'test' ? <Bell size={20} className="md:w-6 md:h-6" /> : <ShoppingBag size={20} className="md:w-6 md:h-6" />}
                          </div>
                          <div className="space-y-1 min-w-0 flex-grow">
                            <h4 className="text-xs md:text-sm font-bold text-[#1A2C54] truncate capitalize">
                              {notif.title || (notif.type === 'test' ? 'Test Notification' : 'New Order Received!')}
                            </h4>
                            <p className="text-[10px] md:text-xs text-gray-500 leading-relaxed line-clamp-2 md:line-clamp-none">
                              {notif.message || (
                                <>Order <span className="font-bold text-ruby">{notif.orderId?.startsWith('#') ? notif.orderId : `#${notif.orderId || notif.id?.slice(-6)}`}</span> was placed by <span className="font-bold text-[#1A2C54]">{notif.address?.name || 'Guest'}</span>.</>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {notif.total && <span className="text-[9px] md:text-[10px] font-bold text-ruby uppercase tracking-widest">₹{Number(notif.total).toLocaleString()}</span>}
                              {notif.total && <span className="text-gray-300">•</span>}
                              <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {notif.createdAt ? (notif.createdAt.toDate ? new Date(notif.createdAt.toDate()).toLocaleString() : new Date(notif.createdAt).toLocaleString()) : 'Just now'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {notif.orderId && (
                          <button 
                            onClick={() => {
                              setActiveTab('orders');
                              setViewingCustomer(notif);
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-gray-50 border border-gray-100 text-ruby rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby hover:text-white transition-all sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            View Order
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notification_logs' && (
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">Notification Logs</h2>
                  <p className="text-xs md:text-sm text-gray-400">Track delivery status and payloads of the last 10 triggered push notifications</p>
                </div>
                <div>
                  <button 
                    onClick={async () => {
                      setLoadingPushLogs(true);
                      try {
                        const { data } = await supabase
                          .from('push_notification_logs')
                          .select('*')
                          .order('timestamp', { ascending: false })
                          .limit(10);
                        setPushLogs(data || []);
                        toast.success("Logs updated successfully!");
                      } catch (err: any) {
                        console.error("Error fetching logs:", err);
                        toast.error("Failed to refresh notification logs.");
                      } finally {
                        setLoadingPushLogs(false);
                      }
                    }}
                    disabled={loadingPushLogs}
                    className="bg-ruby text-white px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={loadingPushLogs ? "animate-spin" : ""} />
                    {loadingPushLogs ? 'Refreshing...' : 'Refresh Logs'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingPushLogs ? (
                  <div className="p-12 md:p-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-ruby">
                      <RefreshCw size={32} className="animate-spin" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">Loading recent dispatch events...</p>
                  </div>
                ) : pushLogs.length === 0 ? (
                  <div className="p-12 md:p-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                      <History size={32} />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">No push notifications logged yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-gray-400">Timestamp</th>
                          <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-gray-400">Recipient</th>
                          <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-gray-400">Notification Details</th>
                          <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pushLogs.map((log) => {
                          let statusClass = "bg-red-50 text-red-600 border-red-100";
                          let statusLabel = "Failed";
                          if (log.status === "success") {
                            statusClass = "bg-green-50 text-green-600 border-green-100";
                            statusLabel = "Delivered";
                          } else if (log.status === "simulated") {
                            statusClass = "bg-blue-50 text-blue-600 border-blue-100";
                            statusLabel = "Simulated";
                          } else if (log.status === "warning") {
                            statusClass = "bg-yellow-50 text-yellow-600 border-yellow-100";
                            statusLabel = "Warning";
                          }

                          return (
                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-4 md:p-5 whitespace-nowrap">
                                <span className="text-xs font-medium text-gray-500 font-mono">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                                </span>
                              </td>
                              <td className="p-4 md:p-5 whitespace-nowrap">
                                <span className="text-xs font-semibold text-[#1A2C54] capitalize">
                                  {log.recipient || 'Broadcast'}
                                </span>
                              </td>
                              <td className="p-4 md:p-5">
                                <div className="space-y-1 max-w-lg">
                                  <h4 className="text-xs font-bold text-[#1A2C54]">{log.title}</h4>
                                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 md:line-clamp-none">
                                    {log.body}
                                  </p>
                                </div>
                              </td>
                              <td className="p-4 md:p-5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-200px)] flex bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm relative">
              {/* Chat List */}
              <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-gray-100 flex-col bg-white`}>
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-xl font-bold text-[#1A2C54]">Customer Support</h2>
                  <p className="text-xs text-gray-400 mt-1">Manage real-time conversations</p>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
                  {chats.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 text-gray-200 rounded-3xl flex items-center justify-center mx-auto">
                        <MessageCircle size={32} />
                      </div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No active chats</p>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={`w-full p-5 flex items-center space-x-4 hover:bg-gray-50 transition-all border-b border-gray-50 text-left relative group ${
                          selectedChat?.id === chat.id ? 'bg-ruby/5' : ''
                        }`}
                      >
                        {selectedChat?.id === chat.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-ruby rounded-r-full" />
                        )}
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center text-[#1A2C54] font-bold shadow-sm group-hover:scale-105 transition-transform">
                            {chat.userName?.charAt(0).toUpperCase()}
                          </div>
                          {chat.unreadCountAdmin > 0 && (
                            <span className="absolute -top-1 -right-1 bg-ruby text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                              {chat.unreadCountAdmin}
                            </span>
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="text-sm font-bold text-[#1A2C54] truncate group-hover:text-ruby transition-colors">{chat.userName}</h3>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              {chat.lastMessageAt && typeof chat.lastMessageAt.toDate === 'function' ? new Date(chat.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate font-medium leading-tight">{chat.lastMessage}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Window */}
              <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-gray-50/30 relative`}>
                {selectedChat ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 md:p-6 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
                      <div className="flex items-center space-x-4">
                        <button 
                          onClick={() => setSelectedChat(null)}
                          className="md:hidden p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <div className="w-10 h-10 bg-ruby/10 text-ruby rounded-xl flex items-center justify-center font-bold shadow-inner">
                          {selectedChat.userName?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#1A2C54]">{selectedChat.userName}</h3>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate max-w-[120px] md:max-w-none">Online Support</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <button className="p-2.5 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all">
                          <Phone size={18} />
                        </button>
                        <button className="p-2.5 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all">
                          <Video size={18} />
                        </button>
                        <button className="p-2.5 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Messages */}
                    <div 
                      ref={chatScrollRef}
                      className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
                    >
                      {chatMessages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`flex ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[90%] md:max-w-[70%] space-y-1.5 ${msg.senderId === 'admin' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-4 rounded-2xl text-sm shadow-md transition-all hover:shadow-lg ${
                              msg.senderId === 'admin' 
                                ? 'bg-[#1A2C54] text-white rounded-tr-none' 
                                : 'bg-white text-[#1A2C54] border border-gray-100 rounded-tl-none'
                            }`}>
                              {msg.type === 'image' && msg.image ? (
                                <div className="relative group">
                                  <img 
                                    src={msg.image} 
                                    alt="Sent image" 
                                    className="rounded-lg max-w-full h-auto cursor-pointer transition-all"
                                    onClick={() => window.open(msg.image, '_blank')}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center pointer-events-none">
                                    <ImageIcon className="text-white" size={24} />
                                  </div>
                                </div>
                              ) : (
                                <p className="leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                              )}
                            </div>
                             <div className={`flex items-center space-x-2 px-1 ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                {msg.createdAt && typeof msg.createdAt.toDate === 'function' ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...')}
                              </span>
                              {msg.senderId === 'admin' && <CheckCheck size={12} className="text-ruby" />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Admin Input */}
                    <div className="p-4 md:p-6 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                      <form onSubmit={handleSendAdminMessage} className="flex items-center gap-2 md:gap-4">
                        <button 
                          type="button"
                          onClick={() => adminChatFileRef.current?.click()}
                          className="p-3 text-gray-400 hover:text-ruby hover:bg-ruby/5 rounded-2xl transition-all flex-shrink-0 border border-gray-100"
                        >
                          <ImageIcon size={20} />
                        </button>
                        <input 
                          type="file"
                          ref={adminChatFileRef}
                          onChange={handleAdminImageUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex-grow relative">
                          <input 
                            type="text"
                            value={adminMessage}
                            onChange={(e) => setAdminMessage(e.target.value)}
                            placeholder="Write your message..."
                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-medium text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 focus:border-ruby/30 outline-none transition-all placeholder:text-gray-400"
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={!adminMessage.trim()}
                          className="p-3.5 bg-[#1A2C54] text-white rounded-2xl hover:bg-ruby transition-all shadow-lg shadow-[#1A2C54]/20 disabled:opacity-50 disabled:shadow-none flex-shrink-0"
                        >
                          <TrendingUp size={20} className="rotate-90" />
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-12 space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl border border-gray-50 flex items-center justify-center text-ruby animate-bounce-slow">
                        <MessageCircle size={48} />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-ruby rounded-full border-4 border-white flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-[#1A2C54] uppercase tracking-tight">Support Dashboard</h3>
                      <p className="text-sm text-gray-400 max-w-xs mx-auto font-medium">Select a customer conversation to provide real-time assistance.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-[#1A2C54] tracking-tight">Customer Feedback</h2>
                  <p className="text-sm text-gray-400 font-medium">Monitor and manage your store's reputation</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/20">
                  <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-yellow-500">
                    <Star size={24} className="fill-yellow-400" />
                  </div>
                  <div className="pr-6">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Store Rating</p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-2xl font-black text-[#1A2C54]">
                        {reviews.length > 0 
                          ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1) 
                          : '0.0'}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">/ 5.0</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Cards / Desktop Table */}
              <div className="grid grid-cols-1 md:hidden gap-4">
                {reviews.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto text-gray-200">
                      <Star size={32} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No reviews yet</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4">
                        <button 
                          onClick={() => handleDeleteReview(review.id)}
                          className="p-2 text-gray-300 hover:text-ruby transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-[#1A2C54] font-bold text-lg shadow-inner">
                          {review.userName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1A2C54]">{review.userName || 'Anonymous'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={10} 
                                className={i < (review.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0 shadow-sm">
                            {review.productImage && <img src={review.productImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                          </div>
                          <p className="text-xs font-bold text-[#1A2C54] truncate">{review.productName || 'Unknown Product'}</p>
                        </div>
                        <p className="text-sm text-gray-500 italic leading-relaxed">"{review.comment || 'No comment'}"</p>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                        </p>
                        <p className="text-[10px] font-bold text-ruby uppercase tracking-widest">{review.userEmail || 'No email'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-50">
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Product</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Rating</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Review</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {reviews.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-24 text-center">
                            <div className="space-y-4">
                              <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto text-gray-200">
                                <Star size={40} />
                              </div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No reviews found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        reviews.map((review) => (
                          <tr key={review.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="py-6 px-8">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-[#1A2C54] font-bold text-sm shadow-sm">
                                  {review.userName?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-[#1A2C54]">{review.userName || 'Anonymous'}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{review.userEmail || 'No email'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 px-8">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner">
                                  {review.productImage && <img src={review.productImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                </div>
                                <p className="text-sm font-bold text-[#1A2C54] max-w-[150px] truncate">{review.productName || 'Unknown Product'}</p>
                              </div>
                            </td>
                            <td className="py-6 px-8">
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    size={12} 
                                    className={i < (review.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} 
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="py-6 px-8">
                              <p className="text-sm text-gray-500 max-w-[250px] line-clamp-2 italic font-medium leading-relaxed">"{review.comment || 'No comment'}"</p>
                            </td>
                            <td className="py-6 px-8">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </p>
                            </td>
                            <td className="py-6 px-8 text-right">
                              <button 
                                onClick={() => handleDeleteReview(review.id)}
                                className="p-3 text-gray-300 hover:text-ruby hover:bg-ruby/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'abandoned' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-[#1A2C54] tracking-tight">Abandoned Carts</h2>
                  <p className="text-sm text-gray-400 font-medium">Recover lost sales by reminding customers</p>
                </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={sendBulkAbandonedCartReminders}
                      disabled={isSendingBulkReminders || abandonedCarts.length === 0}
                      className="px-6 py-3 bg-[#1A2C54] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-ruby transition-all flex items-center gap-2 shadow-xl shadow-[#1A2C54]/10 disabled:opacity-50"
                    >
                      <Zap size={14} className="fill-current" /> Recover All
                    </button>
                    <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/20">
                      <div className="w-12 h-12 bg-ruby/10 rounded-2xl flex items-center justify-center text-ruby">
                        <ShoppingCart size={24} />
                      </div>
                      <div className="pr-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Lost</p>
                        <p className="text-2xl font-black text-[#1A2C54]">
                          Rs. {abandonedCarts.reduce((acc, cart) => acc + (cart.totalAmount || 0), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 md:hidden gap-4">
                {abandonedCarts.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto text-gray-200">
                      <ShoppingCart size={32} />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No abandoned carts</p>
                  </div>
                ) : (
                  abandonedCarts.map((cart) => (
                    <div key={cart.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-[#1A2C54]">{cart.userEmail || 'Guest'}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cart.userId ? 'Registered User' : 'Unknown'}</p>
                        </div>
                        <p className="text-sm font-black text-ruby">Rs. {cart.totalAmount?.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {cart.items?.map((item: any, i: number) => (
                          <div key={i} className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
                            {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {cart.updatedAt ? (cart.updatedAt.toDate ? new Date(cart.updatedAt.toDate()).toLocaleDateString() : new Date(cart.updatedAt).toLocaleDateString()) : 'N/A'}
                        </p>
                        <button 
                          onClick={() => sendAbandonedCartReminder(cart)}
                          className="px-4 py-2 bg-ruby text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#1A2C54] transition-all shadow-lg shadow-ruby/20"
                        >
                          Remind
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-50">
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Customer</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Items</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Value</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Activity</th>
                        <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {abandonedCarts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-24 text-center">
                            <div className="space-y-4">
                              <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto text-gray-200">
                                <ShoppingCart size={40} />
                              </div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No abandoned carts found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        abandonedCarts.map((cart) => (
                          <tr key={cart.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="py-6 px-8">
                              <div>
                                <p className="text-sm font-bold text-[#1A2C54]">{cart.userEmail || 'Guest'}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cart.userId ? 'Registered User' : 'Unknown'}</p>
                              </div>
                            </td>
                            <td className="py-6 px-8">
                              <div className="flex -space-x-2">
                                {cart.items?.slice(0, 3).map((item: any, i: number) => (
                                  <div key={i} className="w-8 h-8 rounded-lg border-2 border-white overflow-hidden bg-gray-100 shadow-sm">
                                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                                  </div>
                                ))}
                                {cart.items?.length > 3 && (
                                  <div className="w-8 h-8 rounded-lg border-2 border-white bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                    +{cart.items.length - 3}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-6 px-8">
                              <p className="text-sm font-bold text-[#1A2C54]">Rs. {cart.totalAmount?.toFixed(2)}</p>
                            </td>
                            <td className="py-6 px-8">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {cart.updatedAt ? (cart.updatedAt.toDate ? new Date(cart.updatedAt.toDate()).toLocaleString() : new Date(cart.updatedAt).toLocaleString()) : 'N/A'}
                              </p>
                            </td>
                            <td className="py-6 px-8 text-right">
                              <button 
                                onClick={() => sendAbandonedCartReminder(cart)}
                                className="px-4 py-2 bg-ruby text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#1A2C54] transition-all shadow-lg shadow-ruby/20"
                              >
                                Send Reminder
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-10 max-w-4xl mx-auto py-10 px-4">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-ruby/10 text-ruby rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-ruby/10">
                  <Settings size={40} />
                </div>
                <h2 className="text-3xl font-black text-[#1A2C54] tracking-tight uppercase italic">Settings</h2>
                <p className="text-gray-400 font-medium max-w-md mx-auto italic">General application settings and configurations.</p>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 text-center">
                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No maintenance tools required at this time.</p>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-10 pb-20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-[#1A2C54] tracking-tight">Product Insights ✨</h2>
                  <p className="text-sm text-gray-400 font-medium">AI-powered analysis of your inventory and customer behavior</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-1 bg-ruby/5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-ruby animate-pulse"></div>
                    <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">Live Analysis</span>
                  </div>
                </div>
              </div>

              {/* AI Insight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Inventory Alert',
                    desc: `${products.filter(p => p.stock < 5).length} products are running low on stock. Restock soon to avoid lost sales.`,
                    icon: AlertTriangle,
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    action: 'View Low Stock'
                  },
                  {
                    title: 'Trending Up',
                    desc: 'Women\'s Summer Collection has seen a 40% increase in views this week.',
                    icon: TrendingUp,
                    color: 'text-green-600',
                    bgColor: 'bg-green-50',
                    action: 'Promote Now'
                  },
                  {
                    title: 'Abandoned Recovery',
                    desc: 'Sending reminders for abandoned carts could recover up to ₹45,000 this month.',
                    icon: ShoppingCart,
                    color: 'text-ruby',
                    bgColor: 'bg-ruby/5',
                    action: 'Send Reminders'
                  }
                ].map((insight, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6 relative overflow-hidden group"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${insight.bgColor} ${insight.color} flex items-center justify-center`}>
                      <insight.icon size={24} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">{insight.title}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{insight.desc}</p>
                    </div>
                    <button className="text-[10px] font-black text-ruby uppercase tracking-widest hover:underline">
                      {insight.action} →
                    </button>
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-gray-50 rounded-full group-hover:scale-150 transition-transform -z-10 opacity-50" />
                  </motion.div>
                ))}
              </div>

              {/* Campaign Studio AI Tool */}
              <div className="bg-[#1A2C54] rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-ruby/20 rounded-full blur-[100px] -mr-48 -mt-48 transition-transform group-hover:scale-125 duration-700" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/20 rounded-full blur-[100px] -ml-32 -mb-32" />
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
                  <div className="flex-grow space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-ruby rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-ruby/20">
                      <Sparkles size={12} className="fill-current" /> AI Marketing Assistant
                    </div>
                    <h3 className="text-4xl font-black tracking-tighter max-w-xl">
                      Launch high-converting <span className="text-ruby italic">Ad Campaigns</span> in seconds.
                    </h3>
                    <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-lg">
                      Our AI analyzes your inventory, trending products, and abandoned carts to generate the perfect marketing strategy for your brand.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-4">
                      <button 
                        onClick={generateAICampaign}
                        disabled={isGeneratingCampaign}
                        className="px-8 py-4 bg-white text-[#1A2C54] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-ruby hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-2 group/btn"
                      >
                        <Rocket size={18} className="group-hover/btn:animate-bounce" />
                        {isGeneratingCampaign ? 'Analyzing Data...' : 'Generate Smart Campaign'}
                      </button>
                      <button 
                        className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2"
                      >
                        <Megaphone size={18} /> View Past Ads
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {campaignResult ? (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full lg:w-[450px] bg-white/10 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-8 space-y-6"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ruby mb-1">Recommended Sale</p>
                              <h4 className="text-xl font-black tracking-tight">{campaignResult.saleName}</h4>
                            </div>
                            <div className="px-3 py-1 bg-ruby/20 border border-ruby/30 rounded-lg text-xs font-black text-ruby">
                              {campaignResult.suggestedDiscount}% OFF
                            </div>
                          </div>
                          <p className="text-xs text-gray-300 font-medium leading-relaxed italic border-l-2 border-ruby/30 pl-3">
                            "{campaignResult.saleLogic}"
                          </p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Winning Ad Captions</p>
                          <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                            {campaignResult.adCaptions?.map((cap: string, i: number) => (
                              <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 group/cap relative">
                                <p className="text-[11px] font-bold leading-relaxed text-gray-100">{cap}</p>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(cap);
                                    toast.success("Caption copied!");
                                  }}
                                  className="absolute top-2 right-2 opacity-0 group-hover/cap:opacity-100 transition-opacity p-1 bg-white/10 rounded-md hover:bg-ruby"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 flex items-center gap-3">
                          <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                            <Zap size={14} className="fill-current" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Expert Tip</p>
                            <p className="text-[10px] text-gray-300 font-medium">{campaignResult.marketingTip}</p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="w-full lg:w-[450px] aspect-square rounded-[2.5rem] bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center p-12 space-y-6">
                        <div className="w-20 h-20 bg-ruby/10 rounded-[2rem] flex items-center justify-center text-ruby animate-pulse">
                          <Sparkles size={40} />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xl font-bold tracking-tight">Strategy Lab</p>
                          <p className="text-sm text-gray-500 font-medium italic">Hit "Generate" to see the future of your store.</p>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={20} className="text-ruby" />
                      Customer Interest
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#1A2C54]"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Views</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-ruby"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Wishlists</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ChartContainer isMounted={isMounted}>
                      <BarChart data={products.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }}
                          interval={0}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} />
                        <Tooltip 
                          cursor={{ fill: '#F9FAFB' }}
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }}
                        />
                        <Bar dataKey="viewCount" name="Views" fill="#1A2C54" radius={[6, 6, 0, 0]} barSize={24} />
                        <Bar dataKey="wishlistCount" name="Wishlists" fill="#E11D48" radius={[6, 6, 0, 0]} barSize={24} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>

                {/* Conversion Gap */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                    <TrendingDown size={20} className="text-ruby" />
                    Conversion Opportunities
                  </h3>
                  <div className="space-y-4">
                    {products
                      .map(p => {
                        const sales = orders.filter(o => o.items?.some((i: any) => i.id === p.id)).length;
                        const interest = (p.viewCount || 0) + (p.wishlistCount || 0);
                        const gap = interest > 0 ? (interest - sales) / interest : 0;
                        return { ...p, sales, interest, gap };
                      })
                      .sort((a, b) => b.gap - a.gap)
                      .slice(0, 4)
                      .map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-5 bg-gray-50 rounded-[2rem] border border-gray-100 group hover:border-ruby/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border border-gray-100">
                              {p.images[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-[#1A2C54]">{p.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-xs font-black text-ruby">{Math.round(p.gap * 100)}% Gap</span>
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.interest} Interest vs {p.sales} Sales</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

              {/* Popularity Grid */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest">Engagement Heatmap</h3>
                    <p className="text-xs text-gray-400 font-medium">Visualizing product popularity across the catalog</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Low</span>
                    <div className="w-32 h-2 bg-gradient-to-r from-ruby/5 to-ruby rounded-full"></div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">High</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {products.slice(0, 16).map((p, idx) => {
                    const popularity = (p.viewCount || 0) + (p.wishlistCount || 0) * 2;
                    const maxPopularity = Math.max(...products.map(pr => (pr.viewCount || 0) + (pr.wishlistCount || 0) * 2), 1);
                    const intensity = popularity / maxPopularity;
                    
                    return (
                      <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.05 }}
                        className="aspect-square rounded-3xl p-4 flex flex-col items-center justify-center text-center space-y-1 relative group overflow-hidden transition-all border border-transparent"
                        style={{ 
                          backgroundColor: `rgba(225, 29, 72, ${Math.max(0.05, intensity)})`,
                          borderColor: intensity > 0.7 ? '#E11D48' : 'transparent'
                        }}
                      >
                        <div className="absolute inset-0 bg-[#1A2C54]/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-white">
                          <p className="text-[8px] font-black uppercase tracking-widest mb-2 leading-tight">{p.name}</p>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">Views: {p.viewCount || 0}</span>
                            <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">Wish: {p.wishlistCount || 0}</span>
                          </div>
                        </div>
                        <p className={`text-xl font-black ${intensity > 0.5 ? 'text-white' : 'text-ruby'}`}>
                          {popularity}
                        </p>
                        <p className={`text-[8px] font-black uppercase tracking-widest ${intensity > 0.5 ? 'text-white/80' : 'text-gray-400'}`}>
                          Score
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Site Settings</h2>
                  <p className="text-sm text-gray-400">Configure your store's global parameters</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button 
                    onClick={handleCheckFullHealth}
                    disabled={isLoadingStatus}
                    className="flex-1 md:flex-none border border-gray-200 text-[#1A2C54] px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Activity size={14} className={isLoadingStatus ? 'animate-spin' : ''} />
                    {isLoadingStatus ? 'Scanning...' : 'Check Health'}
                  </button>
                  <button 
                    onClick={handleSaveSettings}
                    className="flex-1 md:flex-none bg-ruby text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Technical Health Overview (Quick View) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                   { label: 'Database', key: 'firebase', icon: Database },
                   { label: 'Email', key: 'email', icon: Mail },
                   { label: 'Payments', key: 'razorpay', icon: CreditCard },
                   { label: 'Push', key: 'oneSignal', icon: Bell }
                ].map((item) => {
                  const serviceStatus = systemHealth?.services?.[item.key]?.status || 'Checking...';
                  const isSuccess = serviceStatus.includes('✅') || serviceStatus.includes('🔐') || serviceStatus.includes('Initialized');
                  
                  return (
                    <div key={item.key} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                        isSuccess ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                      )}>
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                        <p className={cn(
                          "text-[11px] font-bold truncate",
                          isSuccess ? "text-green-600" : "text-[#1A2C54]"
                        )}>
                          {serviceStatus}
                        </p> 
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-8">
                {/* Settings Content */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[400px]">
                  <AnimatePresence mode="wait">
                    {activeSettingsTab === 'profile' && (
                      <motion.div 
                        key="profile"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-10"
                      >
                        <div className="flex flex-col md:flex-row gap-10">
                          {/* Profile Card */}
                          <div className="w-full md:w-80 space-y-6">
                            <div className="bg-gray-50 rounded-[2.5rem] p-8 text-center border border-gray-100 shadow-inner relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-full h-1 bg-ruby" />
                              <div className="relative inline-block cursor-pointer" onClick={() => document.getElementById('admin-profile-image-upload')?.click()}>
                                <input 
                                  type="file" 
                                  id="admin-profile-image-upload" 
                                  className="hidden" 
                                  accept="image/*" 
                                  onChange={handleAdminPhotoUpload} 
                                />
                                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] bg-white p-2 shadow-2xl border border-gray-100 mx-auto overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                  <img 
                                    src={(user && localStorage.getItem(`user_photo_${user.uid}`)) || profile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                                    alt="Admin Avatar" 
                                    className="w-full h-full object-cover rounded-[1.5rem]"
                                  />
                                </div>
                                <button type="button" className="absolute -bottom-2 -right-2 w-10 h-10 bg-ruby text-white rounded-xl flex items-center justify-center shadow-xl border-4 border-white hover:scale-110 active:scale-95 transition-all">
                                  <Camera size={18} />
                                </button>
                              </div>
                              <div className="mt-6 space-y-1">
                                <h3 className="text-xl font-black text-[#1A2C54] tracking-tight">{profile?.displayName || user?.displayName || 'Admin User'}</h3>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-ruby/10 text-ruby rounded-lg">
                                  <Shield size={12} />
                                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Super Administrator</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-gray-400 font-medium mt-4">{user?.email}</p>
                            </div>

                            <div className="bg-white border border-gray-100 rounded-3xl p-6 space-y-4">
                              <h4 className="text-[11px] font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                                <History size={14} className="text-ruby" /> Security Logs
                              </h4>
                              <div className="space-y-3">
                                {[
                                  { event: 'Logged in', time: 'Just now', icon: CheckCircle, color: 'text-green-500' },
                                  { event: 'Password changed', time: '2 days ago', icon: Shield, color: 'text-blue-500' },
                                  { event: 'New IP detected', time: '5 days ago', icon: Activity, color: 'text-amber-500' },
                                ].map((log, idx) => (
                                  <div key={idx} className="flex items-start gap-3">
                                    <div className={cn("p-1.5 rounded-lg bg-gray-50", log.color)}>
                                      <log.icon size={12} />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-bold text-gray-700 leading-none">{log.event}</p>
                                      <p className="text-[9px] text-gray-400 mt-0.5">{log.time}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Edit Forms */}
                          <div className="flex-grow space-y-8">
                            <form onSubmit={handleUpdateProfile} className="space-y-6 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                              <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                                <User size={20} className="text-ruby" /> Profile Information
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                  <input 
                                    type="text" 
                                    value={profileFormData.displayName}
                                    onChange={(e) => setProfileFormData({...profileFormData, displayName: e.target.value})}
                                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 transition-all outline-none"
                                    placeholder="Enter your name"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Avatar URL</label>
                                  <input 
                                    type="text" 
                                    value={profileFormData.photoURL}
                                    onChange={(e) => setProfileFormData({...profileFormData, photoURL: e.target.value})}
                                    className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] focus:ring-4 focus:ring-ruby/5 focus:border-ruby/20 transition-all outline-none"
                                    placeholder="https://example.com/avatar.png"
                                  />
                                </div>
                              </div>
                              <button 
                                type="submit" 
                                disabled={isUpdatingProfile}
                                className="bg-gray-900 text-white px-10 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-50"
                              >
                                {isUpdatingProfile ? 'Saving...' : 'Update Details'}
                              </button>
                            </form>

                            <form onSubmit={handleChangePassword} className="space-y-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50">
                              <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest flex items-center gap-2">
                                <Shield size={20} className="text-ruby" /> Security & Password
                              </h3>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Password</label>
                                  <input 
                                    type="password" 
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-50 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] outline-none focus:bg-white focus:ring-4 focus:ring-ruby/5 transition-all"
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                                    <input 
                                      type="password" 
                                      value={passwordForm.newPassword}
                                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                                      className="w-full bg-gray-50 border border-gray-50 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] outline-none focus:bg-white focus:ring-4 focus:ring-ruby/5 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                                    <input 
                                      type="password" 
                                      value={passwordForm.confirmPassword}
                                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                                      className="w-full bg-gray-50 border border-gray-50 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] outline-none focus:bg-white focus:ring-4 focus:ring-ruby/5 transition-all"
                                    />
                                  </div>
                                </div>
                              </div>
                              <button 
                                type="submit" 
                                disabled={isUpdatingProfile}
                                className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-xl shadow-ruby/20 active:scale-95 disabled:opacity-50"
                              >
                                {isUpdatingProfile ? 'Changing...' : 'Change Password'}
                              </button>
                            </form>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'store' && (
                      <motion.div 
                        key="store"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Settings size={20} className="mr-2 text-ruby" /> General Store Settings
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Store Logo</label>
                            <div className="flex items-center space-x-4">
                              <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl p-4 hover:border-ruby/30 transition-all cursor-pointer relative group">
                                {settings.storeLogo ? (
                                  <div className="relative w-full h-20 rounded-lg overflow-hidden">
                                    <img src={settings.storeLogo} alt="Logo Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    <button 
                                      type="button"
                                      onClick={() => setSettings({...settings, storeLogo: ''})}
                                      className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-2 bg-gray-50 rounded-lg text-gray-400 mb-1">
                                      <ImageIcon size={20} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Upload Logo</p>
                                  </>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 5 * 1024 * 1024) {
                                        toast.error("Image size must be less than 5MB");
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setSettings({...settings, storeLogo: reader.result as string});
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              This logo will appear in the Razorpay checkout and order emails.
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Store Name</label>
                            <input 
                              type="text" 
                              value={settings.storeName || ''}
                              onChange={(e) => setSettings({...settings, storeName: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Support Email</label>
                            <input 
                              type="email" 
                              value={settings.supportEmail || ''}
                              onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Currency Symbol</label>
                            <input 
                              type="text" 
                              value={settings.currency || ''}
                              onChange={(e) => setSettings({...settings, currency: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>

                          <div className="pt-4 border-t border-gray-50">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest mb-4">Razorpay Configuration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Razorpay Key ID</label>
                                <input 
                                  type="text" 
                                  placeholder="rzp_live_..."
                                  value={settings.razorpayKeyId || ''}
                                  onChange={(e) => setSettings({...settings, razorpayKeyId: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Razorpay Key Secret</label>
                                <input 
                                  type="password" 
                                  placeholder="Enter your Secret Key"
                                  value={settings.razorpayKeySecret || ''}
                                  onChange={(e) => setSettings({...settings, razorpayKeySecret: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-gray-50">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest mb-4">Footer Contact Info</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Contact Email</label>
                                <input 
                                  type="email" 
                                  placeholder="hello@yourstore.com"
                                  value={settings.footerContact?.email || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerContact: { ...settings.footerContact, email: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Contact Phone</label>
                                <input 
                                  type="text" 
                                  placeholder="+91 98765 43210"
                                  value={settings.footerContact?.phone || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerContact: { ...settings.footerContact, phone: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Store Address</label>
                                <input 
                                  type="text" 
                                  placeholder="123 Fashion Street, City, Country"
                                  value={settings.footerContact?.address || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerContact: { ...settings.footerContact, address: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>

                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest mb-4">Footer Social Links</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Instagram URL</label>
                                <input 
                                  type="url" 
                                  placeholder="https://instagram.com/yourstore"
                                  value={settings.footerSocials?.instagram || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerSocials: { ...settings.footerSocials, instagram: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">X (Twitter) URL</label>
                                <input 
                                  type="url" 
                                  placeholder="https://x.com/yourstore"
                                  value={settings.footerSocials?.x || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerSocials: { ...settings.footerSocials, x: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Facebook URL</label>
                                <input 
                                  type="url" 
                                  placeholder="https://facebook.com/yourstore"
                                  value={settings.footerSocials?.facebook || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerSocials: { ...settings.footerSocials, facebook: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">YouTube URL</label>
                                <input 
                                  type="url" 
                                  placeholder="https://youtube.com/yourstore"
                                  value={settings.footerSocials?.youtube || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerSocials: { ...settings.footerSocials, youtube: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">WhatsApp Number (with country code)</label>
                                <input 
                                  type="text" 
                                  placeholder="919876543210"
                                  value={settings.footerSocials?.whatsapp || ''}
                                  onChange={(e) => setSettings({
                                    ...settings, 
                                    footerSocials: { ...settings.footerSocials, whatsapp: e.target.value }
                                  })}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 flex justify-end">
                            <button 
                              onClick={handleSaveSettings}
                              className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                            >
                              <Save size={16} /> Save Store Settings
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'push' && (
                      <motion.div 
                        key="push"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Bell size={20} className="mr-2 text-ruby" /> OneSignal Push Settings
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                              <p className="text-xs font-bold text-[#1A2C54]">Push Notifications</p>
                              <p className="text-[10px] text-gray-400 leading-relaxed italic">Enable admin alerts for new orders and messages</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={requestNotificationPermission}
                                disabled={isSubscribingPush}
                                className="px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg hover:bg-blue-200 transition-colors uppercase tracking-wider disabled:opacity-50"
                              >
                                {isSubscribingPush ? 'Enabling...' : 'Enable Notifications'}
                              </button>
                              <button 
                                onClick={() => handleSendTestPush(false)}
                                disabled={isSendingTestPush}
                                className="px-3 py-1.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-lg hover:bg-green-200 transition-colors uppercase tracking-wider disabled:opacity-50"
                              >
                                {isSendingTestPush ? 'Sending...' : 'Send All'}
                              </button>
                              {onesignalSubscriptionId && (
                                <button 
                                  onClick={() => handleSendTestPush(true)}
                                  disabled={isSendingTestPush}
                                  className="px-3 py-1.5 bg-ruby text-white text-[10px] font-bold rounded-lg hover:bg-ruby-dark transition-colors uppercase tracking-wider disabled:opacity-50 shadow-md shadow-ruby/20"
                                >
                                  {isSendingTestPush ? '...' : 'Direct Test 🎯'}
                                </button>
                              )}
                              <button 
                                onClick={handleTestOneSignal}
                                disabled={isTestingOneSignal}
                                className="px-3 py-1.5 bg-ruby/10 text-ruby text-[10px] font-bold rounded-lg hover:bg-ruby/20 transition-colors uppercase tracking-wider disabled:opacity-50"
                              >
                                {isTestingOneSignal ? 'Testing...' : 'Test Configuration'}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">OneSignal App ID</label>
                              <input 
                                type="text" 
                                placeholder="Enter OneSignal App ID"
                                value={settings.oneSignalAppId || ''}
                                onChange={(e) => setSettings(prev => ({...prev, oneSignalAppId: e.target.value}))}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">OneSignal REST API Key</label>
                              <input 
                                type="password" 
                                placeholder="Enter REST API Key"
                                value={settings.oneSignalRestApiKey || ''}
                                onChange={(e) => setSettings(prev => ({...prev, oneSignalRestApiKey: e.target.value}))}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                              />
                            </div>
                          </div>
                          
                          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                             <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest flex items-center">
                               <Smartphone size={14} className="mr-2" /> Native App (APK) Setup
                             </h4>
                             <p className="text-[10px] text-amber-600 font-medium leading-relaxed">
                               For APK notifications, <b>Google Android (FCM)</b> setup is required in the OneSignal Dashboard. 
                               There you will need to upload the <b>Service Account JSON</b> file extracted from the <b>Firebase Console</b>.
                             </p>
                           </div>
                           
                           <p className="text-[10px] text-gray-400 leading-relaxed italic">
                            Get these from OneSignal Dashboard &gt; Settings &gt; Keys & IDs.
                          </p>

                          {/* Real-time OneSignal Device Diagnostics Panel */}
                          <div className="mt-6 space-y-4">
                            <div className="p-5 bg-[#1a2c54]/5 rounded-2xl border border-[#1a2c54]/10">
                              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1a2c54]/10">
                                <div>
                                  <h4 className="text-[11px] font-bold text-[#1a2c54] uppercase tracking-widest flex items-center gap-2">
                                    <Activity size={14} className="text-[#1a2c54] animate-pulse" /> Live Device Push Diagnostics
                                  </h4>
                                  <p className="text-[9px] text-gray-400 italic">Real-time inspection of current browser or native connection Status</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => {
                                      const OS = (window as any).OneSignal;
                                      if (OS) {
                                        try {
                                          const subId = OS.User?.PushSubscription?.id || OS.User?.pushSubscriptionId;
                                          if (subId) {
                                            setOnesignalSubscriptionId(subId);
                                            localStorage.setItem("onesignal_real_sub_id", subId);
                                          }
                                          const osUserId = OS.User?.onesignalId;
                                          if (osUserId) setOnesignalUserId(osUserId);
                                        } catch(e) {}
                                      }
                                      fetchRegisteredDevices();
                                      toast.success("Diagnostics refreshed! 🔄");
                                    }}
                                    className="p-1 px-2.5 bg-white text-[#1A2C54] text-[9px] font-bold rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <RefreshCw size={10} /> Refresh
                                  </button>
                                  <button 
                                    onClick={handleSimulateDevice}
                                    className="p-1 px-2.5 bg-ruby/10 text-ruby text-[9px] font-bold rounded-lg hover:bg-ruby/20 transition-colors uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <Sparkles size={10} /> Simulate Developer ID
                                  </button>
                                  {(onesignalSubscriptionId && onesignalSubscriptionId.startsWith('sim_sub')) && (
                                    <button 
                                      onClick={handleClearSimulatedDevice}
                                      className="p-1 px-2 bg-red-100 text-red-600 text-[9px] font-bold rounded-lg hover:bg-red-200 transition-colors uppercase"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Subscription ID</span>
                                  <div className="mt-1 flex items-center justify-between gap-1.5">
                                    <span className="text-[11px] font-mono font-bold text-[#1A2C54] truncate max-w-[130px]">
                                      {onesignalSubscriptionId || "None / Ignored"}
                                    </span>
                                    {onesignalSubscriptionId && (
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(onesignalSubscriptionId);
                                          toast.success("Subscription ID copied!");
                                        }}
                                        className="text-gray-400 hover:text-ruby p-0.5"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Associated User ID (External)</span>
                                  <div className="mt-1 flex items-center justify-between gap-1.5">
                                    <span className="text-[11px] font-mono font-bold text-[#1A2C54] truncate max-w-[130px]">
                                      {user?.uid || "Not Authenticated"}
                                    </span>
                                    {user?.uid && (
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(user.uid);
                                          toast.success("User UID copied!");
                                        }}
                                        className="text-gray-400 hover:text-[#1A2C54] p-0.5"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Status ('isSubscribed')</span>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    {onesignalSubscriptionId ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
                                        TRUE (Subscribed)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                                        FALSE (Idle)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 text-[10px] bg-white rounded-xl p-3 border border-gray-100">
                                <h5 className="font-bold text-[#1A2C54] uppercase tracking-wider text-[9px] mb-2 flex items-center gap-1">
                                  <Info size={11} className="text-blue-500" /> Push Protocol Requirements Checklist
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">HTTPS Protocol (or localhost)</span>
                                    <span className={window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                                      {window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? "✅ Verified" : "⚠️ HTTP Not Supported"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">OneSignal Javascript SDK</span>
                                    <span className={(window as any).OneSignal ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                      {(window as any).OneSignal ? "✅ Active" : "❌ Blocked / Not Loaded"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Browser Permissions</span>
                                    <span className={String((window as any).Notification?.permission) === 'granted' ? "text-green-600 font-bold" : "text-amber-500 font-bold"}>
                                      {String((window as any).Notification?.permission || 'Unsupported')}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Iframe Sandbox Boundary</span>
                                    {window.self !== window.top ? (
                                      <span className="text-amber-600 font-bold flex items-center gap-1">
                                        ⚠️ Limited (Run in New Tab to Test)
                                      </span>
                                    ) : (
                                      <span className="text-green-600 font-bold">✅ None (Direct host)</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Firebase Registration status</span>
                                    <span className={firebaseStatus.includes('Connected') ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                      {firebaseStatus}
                                    </span>
                                  </div>
                                  {onesignalUserId && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500">OneSignal Backend User Profile</span>
                                      <span className="text-green-600 font-bold truncate max-w-[120px]" title={onesignalUserId}>
                                        ✅ {onesignalUserId.substring(0, 8)}...
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Stored Users Registered Devices (Full Database View) */}
                            <div className="p-5 bg-white border border-gray-150 rounded-2xl shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="text-[11px] font-bold text-[#1A2C54] uppercase tracking-widest flex items-center gap-1.5">
                                    <Database size={13} className="text-[#1a2c54]" /> Firebase Device Database
                                  </h4>
                                  <p className="text-[9px] text-gray-400">All saved user subscriptions (onesignalId) synchronized in Firestore</p>
                                </div>
                                <button 
                                  onClick={fetchRegisteredDevices}
                                  disabled={isLoadingDevices}
                                  className="p-1 px-3 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                  <RefreshCw size={11} className={isLoadingDevices ? "animate-spin" : ""} />
                                  {isLoadingDevices ? "fetching..." : "Sync List"}
                                </button>
                              </div>

                              {registeredDevices.length === 0 ? (
                                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                  <Smartphone size={24} className="mx-auto text-gray-300 mb-2" />
                                  <p className="text-[11px] font-bold text-gray-500">No registered devices found</p>
                                  <p className="text-[9px] text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                                    Devices appear here automatically when a user opens the application and grants push permission.
                                  </p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-150">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-150 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="py-2.5 px-3">User</th>
                                        <th className="py-2.5 px-3">Role</th>
                                        <th className="py-2.5 px-3">Subscription Token ID</th>
                                        <th className="py-2.5 px-3 text-right">Diagnostic Push</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {registeredDevices.map((device) => (
                                        <tr key={device.id} className="text-[10px] hover:bg-gray-50/50 transition-colors">
                                          <td className="py-2 px-3">
                                            <div className="font-bold text-[#1A2C54]">{device.name}</div>
                                            <div className="text-[9px] text-gray-400">{device.email}</div>
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${
                                              device.role === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-50 text-gray-600'
                                            }`}>
                                              {device.role}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 font-mono text-[9px] text-gray-500">
                                            <div className="flex items-center gap-2">
                                              <span className="truncate max-w-[120px]" title={device.onesignalId}>
                                                {device.onesignalId}
                                              </span>
                                              <button 
                                                onClick={() => {
                                                  navigator.clipboard.writeText(device.onesignalId);
                                                  toast.success("Device token copied!");
                                                }}
                                                className="text-gray-300 hover:text-ruby"
                                              >
                                                <Copy size={10} />
                                              </button>
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <button 
                                              onClick={() => handleSendDirectPush(device.onesignalId, device.name)}
                                              className="bg-ruby text-white text-[9px] font-bold py-1 px-2.5 rounded-lg hover:bg-ruby-dark transition-colors inline-flex items-center gap-1 shadow-md shadow-ruby/10 animate-fade-in"
                                            >
                                              <Send size={10} /> Send Push
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-6 flex justify-end">
                            <button 
                              onClick={handleSaveSettings}
                              className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                            >
                              <Save size={16} /> Save Push Settings
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'promotions' && (
                      <motion.div 
                        key="promotions"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                            <Ticket size={20} className="mr-2 text-ruby" /> Marketing & Promotion Offers
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Buy 2 Get 1 Free Card */}
                          <div className={`p-6 rounded-[2rem] border-2 transition-all ${settings.buy2Get1Free ? 'border-ruby bg-ruby/5' : 'border-gray-100 bg-white'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.buy2Get1Free ? 'bg-ruby text-white' : 'bg-gray-50 text-gray-400'}`}>
                                <Zap size={24} />
                              </div>
                              <button
                                onClick={() => setSettings({ 
                                  ...settings, 
                                  buy2Get1Free: !settings.buy2Get1Free, 
                                  buy2GetPercentEnabled: false 
                                })}
                                className={`w-12 h-6 rounded-full relative transition-all ${settings.buy2Get1Free ? 'bg-ruby' : 'bg-gray-300'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.buy2Get1Free ? 'left-7' : 'left-1'}`} />
                              </button>
                            </div>
                            <h4 className="text-base font-bold text-[#1A2C54]">Buy 2 Get 1 Free</h4>
                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                              When active, customers will get the 3rd item for free when buying 3 of the same product. 
                              <br /><b className="text-ruby">Note:</b> This overrides percentage discounts.
                            </p>
                          </div>

                          {/* Buy 2 Get X% Off Card */}
                          <div className={`p-6 rounded-[2rem] border-2 transition-all ${settings.buy2GetPercentEnabled ? 'border-ruby bg-ruby/5' : 'border-gray-100 bg-white'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.buy2GetPercentEnabled ? 'bg-ruby text-white' : 'bg-gray-50 text-gray-400'}`}>
                                <Percent size={24} />
                              </div>
                              <button
                                onClick={() => setSettings({ 
                                  ...settings, 
                                  buy2GetPercentEnabled: !settings.buy2GetPercentEnabled,
                                  buy2Get1Free: false // Mutual exclusion
                                })}
                                className={`w-12 h-6 rounded-full relative transition-all ${settings.buy2GetPercentEnabled ? 'bg-ruby' : 'bg-gray-300'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.buy2GetPercentEnabled ? 'left-7' : 'left-1'}`} />
                              </button>
                            </div>
                            <h4 className="text-base font-bold text-[#1A2C54]">Buy 2 Get % Off</h4>
                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                              Apply a percentage discount when a customer buys 2 or more of the same item.
                            </p>
                            
                            <div className="mt-4 flex items-center gap-3">
                              <div className="relative flex-grow">
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  disabled={!settings.buy2GetPercentEnabled}
                                  value={settings.buy2GetPercentOff || ''}
                                  onChange={(e) => setSettings({ ...settings, buy2GetPercentOff: parseInt(e.target.value) || 0 })}
                                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-ruby/20 outline-none disabled:opacity-50"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Discount</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <Info size={20} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-800 uppercase tracking-tight">How it works</p>
                            <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                              These offers are calculated automatically in the cart. 
                              "Buy 2 Get 1 Free" means the 3rd, 6th, 9th... item is free. 
                              "Buy 2 Get % Off" applies the discount to all items of that product if quantity is 2 or more.
                            </p>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-gray-50 flex justify-end">
                           <button 
                            onClick={handleSaveSettings}
                            className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                          >
                            <Save size={16} /> Save Promotions
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'firebase' && (
                      <motion.div 
                        key="firebase"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Cloud size={20} className="mr-2 text-ruby" /> Firebase Database Status
                        </h3>
                        
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-xl ${firebaseStatus === 'Connected ✅' ? 'bg-green-100 text-green-600' : (firebaseStatus.includes('Error') ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400')}`}>
                                <Database size={24} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Connection Status</p>
                                <h4 className={`text-xl font-black ${firebaseStatus === 'Connected ✅' ? 'text-green-600' : (firebaseStatus.includes('Error') ? 'text-red-500' : 'text-[#1A2C54]')}`}>
                                  {firebaseStatus || 'Checking...'}
                                </h4>
                              </div>
                            </div>
                            <button 
                              onClick={() => checkFirebaseStatus(true)}
                              disabled={isLoadingStatus}
                              className={`flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1A2C54] hover:bg-gray-50 transition-all ${isLoadingStatus ? 'opacity-50' : ''}`}
                            >
                              <RefreshCw size={14} className={isLoadingStatus ? 'animate-spin' : ''} />
                              <span>Force Re-sync</span>
                            </button>
                          </div>

                          {firebaseDiagnostics && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Project ID</p>
                                  <p className="text-sm font-bold text-[#1A2C54] truncate">{firebaseDiagnostics.projectId || 'Unknown'}</p>
                                </div>
                                <div className="p-4 bg-white rounded-xl border border-gray-100">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Database ID</p>
                                  <p className="text-sm font-bold text-[#1A2C54] truncate">{firebaseDiagnostics.databaseId || '(default)'}</p>
                                </div>
                              </div>

                              {firebaseDiagnostics.error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                  <p className="text-xs font-bold text-red-600 mb-1">Status Message:</p>
                                  <p className="text-xs text-[#1A2C54] opacity-80 leading-relaxed font-bold">
                                    {firebaseDiagnostics.error.includes('NOT_FOUND') 
                                      ? "Database is not ready yet. Please wait a moment or verify Firebase setup." 
                                      : "Connection problem. Please refresh your browser or check your internet."}
                                  </p>
                                </div>
                              )}
                              
                              {firebaseStatus === 'Connected ✅' && (
                                <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                                  <p className="text-xs font-bold text-green-600 flex items-center">
                                    <CheckCircle size={14} className="mr-2" /> Everything is set! Database is successfully connected.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="p-6 bg-ruby/5 rounded-2xl border border-ruby/10">
                          <h4 className="text-sm font-bold text-[#1A2C54] mb-2">Technical Information</h4>
                          <p className="text-xs text-gray-500 leading-relaxed mb-4">
                            Firebase database is required for backend functions (saving orders, managing users, etc). 
                            If this is "Not Connected", some app features might work slowly or fail.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'sheets' && (
                      <motion.div 
                        key="sheets"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Database size={20} className="mr-2 text-ruby" /> Google Sheets Integration
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Google Sheet URL</label>
                            <input 
                              type="text" 
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                              value={settings.googleSheetUrl || ''}
                              onChange={(e) => setSettings({...settings, googleSheetUrl: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sheet API Key</label>
                            <input 
                              type="password" 
                              placeholder="Enter your Sheet API Key"
                              value={settings.googleSheetApiKey || ''}
                              onChange={(e) => setSettings({...settings, googleSheetApiKey: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <button 
                            onClick={handleSaveSettings}
                            className="w-full bg-ruby text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 mt-4"
                          >
                            Save Settings
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'email' && (
                      <motion.div 
                        key="email"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Mail size={20} className="mr-2 text-ruby" /> Email Service Configuration
                        </h3>
                        <div className="space-y-6">
                          {/* Resend Configuration */}
                          <div className="p-5 border border-gray-100 rounded-3xl space-y-4">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                              Service: Resend API (Professional)
                            </h4>
                            
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                              <h4 className="text-[11px] font-bold text-blue-700 uppercase tracking-widest flex items-center">
                                <Info size={14} className="mr-2" /> Resend Instructions
                              </h4>
                              <ul className="text-[10px] text-blue-600 space-y-1 font-medium leading-relaxed">
                                <li>• Visit <a href="https://resend.com" target="_blank" className="underline font-bold">Resend.com</a> to get your API Key.</li>
                                <li>• Verify your domain to send emails to customers.</li>
                              </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resend API Key</label>
                                <input 
                                  type="password" 
                                  placeholder="re_..."
                                  value={settings.resendApiKey || ''}
                                  onChange={(e) => setSettings({...settings, resendApiKey: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">From Email (Verified Domain)</label>
                                <input 
                                  type="text" 
                                  placeholder="The Ruby <hello@yourdomain.com>"
                                  value={settings.fromEmail || ''}
                                  onChange={(e) => setSettings({...settings, fromEmail: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Gmail SMTP Configuration */}
                          <div className="p-5 border border-ruby/10 bg-ruby/[0.02] rounded-3xl space-y-4">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 bg-ruby rounded-full"></span>
                              Service: Gmail SMTP (Simple)
                            </h4>

                            <div className="bg-ruby/[0.05] border border-ruby/10 rounded-2xl p-4 space-y-2">
                              <h4 className="text-[11px] font-bold text-ruby uppercase tracking-widest flex items-center">
                                <Info size={14} className="mr-2" /> Gmail Setup Instructions
                              </h4>
                              <ul className="text-[10px] text-ruby/80 space-y-1 font-medium leading-relaxed">
                                <li>1. Enable <b>2-Step Verification</b> in your Google Account.</li>
                                <li>2. Create an <b>App Password</b> (Security -&gt; App Passwords).</li>
                                <li>3. Enter your Gmail and that 16-character code below.</li>
                              </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Gmail Address</label>
                                <input 
                                  type="email" 
                                  placeholder="yourname@gmail.com"
                                  value={settings.smtpUser || ''}
                                  onChange={(e) => setSettings({...settings, smtpUser: e.target.value})}
                                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Gmail App Password</label>
                                <input 
                                  type="password" 
                                  placeholder="xxxx xxxx xxxx xxxx"
                                  value={settings.smtpPass || ''}
                                  onChange={(e) => setSettings({...settings, smtpPass: e.target.value})}
                                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 flex flex-col sm:flex-row gap-4">
                            <button 
                              onClick={handleSaveSettings}
                              className="flex-1 bg-ruby text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                            >
                              Save All Settings
                            </button>
                            <button 
                              onClick={handleTestEmail}
                              disabled={isTestingEmail}
                              className="px-8 py-4 bg-gray-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <Mail size={14} />
                              <span>{isTestingEmail ? 'Sending...' : 'Test Connection'}</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'sms' && (
                      <motion.div 
                        key="sms"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Smartphone size={20} className="mr-2 text-ruby" /> SMS & OTP Configuration (Compliance Safe Mode)
                        </h3>
                        <div className="space-y-6">
                          <div className="p-5 border border-gray-100 rounded-3xl space-y-4">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-wider flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              Service: Local Sandbox Verification (100% Offline & Regulatory Safe)
                            </h4>
                            
                            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 space-y-2">
                              <h4 className="text-[11px] font-bold text-green-700 uppercase tracking-widest flex items-center">
                                <Info size={14} className="mr-2" /> Compliance & Telecom Safety Information
                              </h4>
                              <ul className="text-[10px] text-green-600 space-y-1 font-medium leading-relaxed">
                                <li>• To comply with strict telecom regulatory frameworks, <b>all third-party gateway integrations (Textbee) have been permanently disabled and removed</b>.</li>
                                <li>• There is absolutely <b>zero telecom transmission</b>, meaning no SMS messages are broadcasted over cellular networks.</li>
                                <li>• This guarantees 100% safety from compliance penalties, unauthorized broadcast fines, or commercial abuse.</li>
                                <li>• For checkout flows that require verifying customer numbers, the checkout modal will generate and display a secure local code directly on screen.</li>
                              </ul>
                            </div>

                            {/* OTP Enable Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                              <div>
                                <h5 className="text-xs font-bold text-[#1A2C54]">Enable Phone OTP Verification (Simulated)</h5>
                                <p className="text-[10px] text-gray-400 font-medium">Require customer mobile number verification using compliance-safe local codes during checkout</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={settings.phoneOtpEnabled || false}
                                  onChange={(e) => setSettings({...settings, phoneOtpEnabled: e.target.checked})}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ruby"></div>
                              </label>
                            </div>
                          </div>

                          {/* Test SMS dispatch block */}
                          <div className="p-5 border border-ruby/10 bg-ruby/[0.01] rounded-3xl space-y-4">
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-wider">
                              Test Gateway SMS Connection
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Test Phone Number</label>
                                <input 
                                  type="text" 
                                  placeholder="+919876543210"
                                  value={testPhone}
                                  onChange={(e) => setTestPhone(e.target.value)}
                                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div className="flex items-end">
                                <button 
                                  onClick={handleSendTestSms}
                                  disabled={isTestingSms || !testPhone}
                                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {isTestingSms ? 'Sending...' : 'Send Test SMS'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2">
                            <button 
                              onClick={handleSaveSettings}
                              className="w-full bg-ruby text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                            >
                              Save All Settings
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'security' && (
                      <motion.div 
                        key="security"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                          <h3 className="text-xl font-black text-[#1A2C54] flex items-center tracking-tight">
                            <Shield size={24} className="mr-3 text-ruby" /> Security & Usage Limits
                          </h3>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                            <AlertTriangle size={24} />
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Protective Guard Active</h4>
                            <p className="text-xs text-amber-700 leading-relaxed font-medium">
                              These limits protect you from unwanted bills. If you're on the Blaze plan and many OTPs are sent unexpectedly, the system will stop them at 9,999 to save costs.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="p-6 bg-gray-50/50 rounded-3xl border border-gray-100 space-y-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest leading-none mb-2">Monthly OTP Limit</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Maximum emails/SMS per month</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">Safety Cap</span>
                                </div>
                                <input 
                                  type="number" 
                                  value={settings.otpMonthlyLimit || 9999}
                                  onChange={(e) => setSettings({...settings, otpMonthlyLimit: parseInt(e.target.value) || 0})}
                                  className="w-32 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-black text-ruby focus:ring-2 focus:ring-ruby/20 transition-all text-center"
                                />
                              </div>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-100">
                                <h4 className="text-[11px] font-bold text-[#1A2C54] uppercase tracking-widest mb-4">Why 9,999?</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="p-4 bg-white rounded-2xl border border-gray-100 space-y-2">
                                    <p className="text-[10px] font-black text-[#1A2C54] uppercase tracking-tight">Firebase Free Tier</p>
                                    <p className="text-[10px] text-gray-500 leading-normal font-medium">Firebase allows roughly 10,000 verifications/month for free in most regions. Setting it to 9,999 keeps you safe from the first paid rupee.</p>
                                  </div>
                                  <div className="p-4 bg-white rounded-2xl border border-gray-100 space-y-2">
                                    <p className="text-[10px] font-black text-ruby uppercase tracking-tight">Hard vs Soft Limit</p>
                                    <p className="text-[10px] text-gray-500 leading-normal font-medium">To strictly prevent any charges, you must also set a budget limit in your Google Cloud Console Billing section.</p>
                                  </div>
                                </div>
                            </div>
                          </div>

                          <div className="p-8 border-2 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-ruby/5 text-ruby rounded-full flex items-center justify-center group flex-shrink-0">
                               <Shield size={32} className="group-hover:rotate-12 transition-transform" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Full Zero-Cost Guarantee</h4>
                              <p className="text-[10px] text-gray-400 font-medium max-w-xs mx-auto">
                                Always monitor 'Usage & Billing' in the Firebase Console. To increase the limit, change the value above and save.
                              </p>
                            </div>
                            <button 
                               onClick={() => window.open('https://console.firebase.google.com/project/_/usage', '_blank')}
                               className="text-[10px] font-black text-ruby uppercase tracking-widest hover:underline flex items-center gap-2"
                            >
                              Check Live Usage <ExternalLink size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                          <button 
                            onClick={handleSaveSettings}
                            className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                          >
                            Activate Limit Settings
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'maintenance' && (
                      <motion.div 
                        key="maintenance"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-8"
                      >
                        <div className="bg-red-50 border border-red-100 rounded-3xl p-8 space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                              <ShieldCheck size={32} />
                            </div>
                            <div>
                               <h3 className="text-xl font-bold text-red-900 uppercase tracking-tight">System Status: Protected</h3>
                               <p className="text-sm text-red-600">The maintenance controls are currently managed by the secure server layer.</p>
                            </div>
                          </div>

                          <div className="bg-white/50 p-6 rounded-2xl border border-red-100">
                             <h4 className="text-[11px] font-bold text-red-900 uppercase tracking-widest mb-2">Maintenance Note</h4>
                             <p className="text-xs text-red-700 leading-relaxed">
                               The "Wipe & Reset" button has been removed from the dashboard as per your request. 
                               Cleanup operations are now restricted for safety. If you need to perform a cleanup, 
                               ensure you use the authenticated admin channel.
                             </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'sound' && (
                      <motion.div 
                        key="sound"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Volume2 size={20} className="mr-2 text-ruby" /> Notification Alerts
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Order Alert Sound URL</label>
                            <div className="flex space-x-2">
                              <input 
                                type="url" 
                                placeholder="https://example.com/sound.mp3"
                                value={settings.notificationSound || ''}
                                onChange={(e) => setSettings({...settings, notificationSound: e.target.value})}
                                className="flex-grow bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                              />
                              <button 
                                onClick={() => {
                                  if (audioRef.current) {
                                    audioRef.current.src = settings.notificationSound;
                                    audioRef.current.play();
                                  }
                                }}
                                className="p-3 bg-gray-50 text-gray-400 hover:text-ruby rounded-xl transition-all border border-gray-100"
                                title="Test Sound"
                              >
                                <Volume2 size={18} />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              This sound will play whenever a new order is received. You can use any direct MP3/WAV link.
                            </p>
                          </div>

                          <div className="pt-6 flex justify-end">
                            <button 
                              onClick={handleSaveSettings}
                              className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                            >
                              <Save size={16} /> Save Sound Settings
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'seo' && (
                      <motion.div 
                        key="seo"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-bold text-[#1A2C54] flex items-center">
                          <Globe size={20} className="mr-2 text-ruby" /> SEO & Branding Configuration
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Store Favicon</label>
                            <div className="flex items-center space-x-4">
                              <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl p-4 hover:border-ruby/30 transition-all cursor-pointer relative group">
                                {settings.favicon ? (
                                  <div className="relative w-full h-16 rounded-lg overflow-hidden flex items-center justify-center">
                                    <img src={settings.favicon} alt="Favicon Preview" className="h-full object-contain" referrerPolicy="no-referrer" />
                                    <button 
                                      type="button"
                                      onClick={() => setSettings({...settings, favicon: ''})}
                                      className="absolute top-1 right-1 p-1 bg-white/80 backdrop-blur-sm rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="p-2 bg-gray-50 rounded-lg text-gray-400 mb-1">
                                      <ImageIcon size={20} />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Upload Favicon</p>
                                  </>
                                )}
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > 5 * 1024 * 1024) {
                                        toast.error("Image size must be less than 5MB");
                                        return;
                                      }
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setSettings({...settings, favicon: reader.result as string});
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              This icon will appear in the browser tab. Use a square image (32x32 or 64x64).
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Site Title (SEO)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. RUBY Store | Best Fashion Online"
                              value={settings.siteTitle || ''}
                              onChange={(e) => setSettings({...settings, siteTitle: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              This is the title that appears in Google search results and on the browser tab.
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Meta Description</label>
                            <textarea 
                              rows={4}
                              placeholder="Describe your store for search engines..."
                              value={settings.metaDescription || ''}
                              onChange={(e) => setSettings({...settings, metaDescription: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium resize-none" 
                            />
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              A brief summary of your store. Google often shows this in search results.
                            </p>
                          </div>

                          <div className="border-t border-gray-100 pt-6 mt-6 space-y-6">
                            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center">
                              <Share2 size={16} className="mr-2 text-ruby" /> Social Share & Open Graph (OG) Tags
                            </h4>
                            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                              These tags control how your store is displayed when shared on social media platforms like Facebook, Twitter, WhatsApp, and LinkedIn.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Social Share Title (og:title)</label>
                                  <input 
                                    type="text" 
                                    placeholder="e.g. Premium Clothing & Luxury Wear | The Ruby"
                                    value={settings.ogTitle || ''}
                                    onChange={(e) => setSettings({...settings, ogTitle: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                  />
                                  <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                                    Defaults to Site Title if left empty.
                                  </p>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Social Share Description (og:description)</label>
                                  <textarea 
                                    rows={4}
                                    placeholder="Describe your store for social media previews..."
                                    value={settings.ogDescription || ''}
                                    onChange={(e) => setSettings({...settings, ogDescription: e.target.value})}
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium resize-none" 
                                  />
                                  <p className="text-[9px] text-gray-400 mt-1 leading-normal">
                                    Defaults to Meta Description if left empty.
                                  </p>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Social Share Image (og:image)</label>
                                <div className="flex flex-col space-y-4">
                                  <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl p-6 hover:border-ruby/30 transition-all cursor-pointer relative group h-40 bg-gray-50/50">
                                    {settings.ogImage ? (
                                      <div className="relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center">
                                        <img src={settings.ogImage} alt="OG Image Preview" className="h-full object-contain" referrerPolicy="no-referrer" />
                                        <button 
                                          type="button"
                                          onClick={() => setSettings({...settings, ogImage: ''})}
                                          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-md"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="p-3 bg-white rounded-xl text-gray-400 mb-2 shadow-sm">
                                          <ImageIcon size={24} className="text-ruby" />
                                        </div>
                                        <p className="text-[10px] text-[#1A2C54] font-bold uppercase tracking-widest">Upload Social Image</p>
                                        <p className="text-[9px] text-gray-400 mt-1 text-center max-w-[200px]">
                                          Recommended: 1200 x 630 px.
                                        </p>
                                      </>
                                    )}
                                    <input 
                                      type="file" 
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          if (file.size > 5 * 1024 * 1024) {
                                            toast.error("Image size must be less than 5MB");
                                            return;
                                          }
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            setSettings({...settings, ogImage: reader.result as string});
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Or Paste Image URL</label>
                                    <input 
                                      type="text" 
                                      placeholder="https://example.com/social-preview.jpg"
                                      value={settings.ogImage && !settings.ogImage.startsWith('data:') ? settings.ogImage : ''}
                                      onChange={(e) => setSettings({...settings, ogImage: e.target.value})}
                                      className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-8 p-6 bg-amber-50 border border-amber-100 rounded-2xl space-y-4">
                            <h4 className="text-sm font-bold text-amber-800 flex items-center">
                              <AlertTriangle size={18} className="mr-2" /> Custom Domain Login Issue?
                            </h4>
                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                              If you are using a custom domain (like <b>therubyfashion.shop</b>) and login is failing, you must add your domain to the <b>Authorized Domains</b> list in your Firebase Console.
                            </p>
                            <div className="space-y-2">
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Steps to fix:</p>
                              <ol className="text-[10px] text-amber-700 space-y-1 list-decimal ml-4 font-medium">
                                <li>Go to <a href="https://console.firebase.google.com/" target="_blank" className="underline font-bold">Firebase Console</a></li>
                                <li>Select your project &gt; <b>Authentication</b> &gt; <b>Settings</b> tab</li>
                                <li>If you see a back arrow (←) next to "User account linking", click it to see the main settings list</li>
                                <li>Scroll down and click on <b>Authorized domains</b></li>
                                <li>Click <b>Add domain</b> and add <b>therubyfashion.shop</b></li>
                              </ol>
                            </div>
                          </div>

                          <div className="pt-6 flex justify-end">
                            <button 
                              onClick={handleSaveSettings}
                              className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                            >
                              <Save size={16} /> Save Branding & SEO
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSettingsTab === 'promo_ticker' && (
                      <motion.div 
                        key="promo_ticker"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                          <div>
                            <h3 className="text-xl font-black text-[#1A2C54] flex items-center tracking-tight gap-2">
                              <Megaphone size={24} className="text-ruby animate-bounce" /> Smart Promo Ticker Bar
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Configure an engaging promotional announcement header with real-time countdown or rolling marquee banner</p>
                          </div>
                        </div>

                        {/* Interactive Visual Preview */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Live Admin Preview</label>
                          <div 
                            style={{ 
                              backgroundColor: settings.promoBgColor || '#A11B35', 
                              color: settings.promoTextColor || '#FFFFFF' 
                            }}
                            className="rounded-2xl p-4 text-center font-bold text-xs shadow-inner overflow-hidden relative min-h-[44px] flex items-center justify-center transition-all duration-300"
                          >
                            {!settings.promoEnabled ? (
                              <span className="opacity-50 italic font-medium font-sans">Ticker Bar is currently disabled. Enable to see live preview.</span>
                            ) : (
                              <div className={`w-full flex items-center justify-center ${settings.promoScrolling ? 'animate-pulse' : ''}`}>
                                <span className="font-sans mr-2">
                                  {settings.promoMessage || '🔥 Limited Sale Ends:'}
                                </span>
                                {settings.promoType === 'timer' ? (
                                  <span className="font-mono bg-black/20 px-2 py-0.5 rounded ml-1 font-bold">
                                    02d 14h 22m 18s (Simulated)
                                  </span>
                                ) : (
                                  <span className="font-sans bg-white/10 px-2 py-0.5 rounded ml-1 text-xs">
                                    {settings.promoScrolling ? 'Scrolling Mode ⚡' : 'Static Mode ⚡'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Left Column: Basic Settings */}
                          <div className="space-y-6">
                            {/* Toggle: Enable Bar */}
                            <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
                              <div>
                                <p className="text-sm font-bold text-[#1A2C54]">Enable Ticker Bar</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Toggle ON the promo header on user screens</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSettings({ ...settings, promoEnabled: !settings.promoEnabled })}
                                className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${settings.promoEnabled ? 'bg-ruby' : 'bg-gray-300'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.promoEnabled ? 'left-7' : 'left-1'}`} />
                              </button>
                            </div>

                            {/* Bar Type Selector */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 font-sans">Bar Feature Mode</label>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { id: 'timer', label: '⏳ Live Countdown', description: 'Interactive end-time ticking timer' },
                                  { id: 'text', label: '📢 Scrolling Message', description: 'Moving marquee / static message info' }
                                ].map((type) => (
                                  <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setSettings({ ...settings, promoType: type.id as any })}
                                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                                      settings.promoType === type.id 
                                        ? 'border-ruby bg-ruby/5 text-ruby' 
                                        : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <span className="font-bold text-xs">{type.label}</span>
                                    <span className="text-[9px] text-gray-400 font-sans leading-none">{type.description}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Promo Message */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Promotional Text Message</label>
                              <input 
                                type="text"
                                value={settings.promoMessage}
                                onChange={(e) => setSettings({ ...settings, promoMessage: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] outline-none focus:bg-white focus:ring-4 focus:ring-ruby/5 transition-all animate-none"
                                placeholder="e.g. 🔥 Mega Deal Ends In:"
                              />
                            </div>

                            {/* End Date (Timer Mode Only) */}
                            {settings.promoType === 'timer' && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Campaign End DateTime</label>
                                <input 
                                  type="datetime-local"
                                  value={settings.promoEndDate ? settings.promoEndDate.substring(0, 19) : ''}
                                  onChange={(e) => setSettings({ ...settings, promoEndDate: e.target.value })}
                                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-[#1A2C54] outline-none focus:bg-white focus:ring-4 focus:ring-ruby/5 transition-all font-mono animate-none"
                                />
                                <p className="text-[9px] text-[#A2A4B0] leading-tight font-medium">Once this time concludes on visitors' screens, the bar will automatically toggle off or display standard announcements gracefully.</p>
                              </div>
                            )}

                            {/* Moving text / Scrolling Toggle */}
                            <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100">
                              <div>
                                <p className="text-sm font-bold text-[#1A2C54]">Enable Scrolling Animation</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Make marquee text slide horizontally in loops</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSettings({ ...settings, promoScrolling: !settings.promoScrolling })}
                                className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${settings.promoScrolling ? 'bg-ruby' : 'bg-gray-300'}`}
                              >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.promoScrolling ? 'left-7' : 'left-1'}`} />
                              </button>
                            </div>
                          </div>

                          {/* Right Column: Colors & Styling */}
                          <div className="space-y-6">
                            {/* Background Color Picker & Presets */}
                            <div className="space-y-4 p-5 bg-gray-50/50 rounded-3xl border border-gray-100">
                              <div>
                                <p className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest leading-none">Background Style</p>
                                <p className="text-[9px] text-gray-400 font-sans mt-0.5">Set branding banner shade</p>
                              </div>

                              <div className="flex items-center gap-4">
                                <input 
                                  type="color"
                                  value={settings.promoBgColor || '#A11B35'}
                                  onChange={(e) => setSettings({ ...settings, promoBgColor: e.target.value })}
                                  className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1 bg-white"
                                />
                                <div className="flex-grow">
                                  <input 
                                    type="text"
                                    value={settings.promoBgColor || '#A11B35'}
                                    onChange={(e) => setSettings({ ...settings, promoBgColor: e.target.value })}
                                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-700 outline-none animate-none"
                                    placeholder="#A11B35"
                                  />
                                </div>
                              </div>

                              {/* Presets */}
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Cool Presets</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {[
                                    { name: 'Saree Crimson', hex: '#A11B35' },
                                    { name: 'Velvet Midnight', hex: '#111827' },
                                    { name: 'Luxury Gold', hex: '#c4a882' },
                                    { name: 'Emerald Forest', hex: '#065F46' },
                                    { name: 'Amber Copper', hex: '#D97706' },
                                    { name: 'Oceanic Indigo', hex: '#3730A3' }
                                  ].map((pColor) => (
                                    <button
                                      key={pColor.hex}
                                      type="button"
                                      onClick={() => setSettings({ ...settings, promoBgColor: pColor.hex })}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-[10px] font-bold font-sans transition-all text-gray-700"
                                    >
                                      <span style={{ backgroundColor: pColor.hex }} className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shrink-0" />
                                      <span>{pColor.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Text Color Picker & Presets */}
                            <div className="space-y-4 p-5 bg-gray-50/50 rounded-3xl border border-gray-100">
                              <div>
                                <p className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest leading-none">Text & Symbol Shade</p>
                                <p className="text-[9px] text-gray-400 font-sans mt-0.5">Set countdown text color</p>
                              </div>

                              <div className="flex items-center gap-4">
                                <input 
                                  type="color"
                                  value={settings.promoTextColor || '#FFFFFF'}
                                  onChange={(e) => setSettings({ ...settings, promoTextColor: e.target.value })}
                                  className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1 bg-white"
                                />
                                <div className="flex-grow">
                                  <input 
                                    type="text"
                                    value={settings.promoTextColor || '#FFFFFF'}
                                    onChange={(e) => setSettings({ ...settings, promoTextColor: e.target.value })}
                                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-700 outline-none animate-none"
                                    placeholder="#FFFFFF"
                                  />
                                </div>
                              </div>

                              {/* Presets */}
                              <div className="space-y-1.5">
                                <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase leading-none">Cool Presets</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {[
                                    { name: 'Pristine White', hex: '#FFFFFF' },
                                    { name: 'Cream Ivory', hex: '#FDFBF7' },
                                    { name: 'Warm Charcoal', hex: '#1F2937' },
                                    { name: 'Soft Mustard', hex: '#FEF08A' },
                                    { name: 'Rich Peach', hex: '#FFEDD5' }
                                  ].map((pColor) => (
                                    <button
                                      key={pColor.hex}
                                      type="button"
                                      onClick={() => setSettings({ ...settings, promoTextColor: pColor.hex })}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-[10px] font-bold font-sans transition-all text-gray-700"
                                    >
                                      <span style={{ backgroundColor: pColor.hex }} className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shrink-0" />
                                      <span>{pColor.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Save Action */}
                        <div className="pt-6 border-t border-gray-50 flex justify-end">
                          <button 
                            onClick={handleSaveSettings}
                            className="bg-ruby text-white px-10 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95 flex items-center gap-2"
                          >
                            <Save size={16} /> Save Ticker configurations
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {!['dashboard', 'products', 'orders', 'category', 'colour', 'size', 'coupon', 'promotions', 'customer', 'rocket', 'stats', 'settings', 'notifications', 'notification_logs', 'chats', 'reviews', 'abandoned', 'insights'].includes(activeTab) && !viewingCustomer && (
            <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400 space-y-4">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                <Settings size={32} className="text-gray-200 animate-spin-slow" />
              </div>
              <p className="text-sm font-medium italic">{activeTab} management is under development</p>
            </div>
          )}
        </>
      )}
    </div>
  </main>

      <DeleteConfirmationModal 
        isOpen={isCustomerDeleteModalOpen}
        onCancel={() => setIsCustomerDeleteModalOpen(false)}
        onConfirm={handleDeleteCustomer}
        title="Delete Customer"
        message={`Are you sure you want to delete ${customerToDelete?.displayName || customerToDelete?.email}? This will remove their data from Firestore and Auth.`}
      />

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <h2 className="text-xl font-bold text-gray-800">{editingCategory ? "Edit Category" : "Add Category"}</h2>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category Name</label>
                  <input 
                    type="text" 
                    required
                    value={categoryForm.name || ''}
                    onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    placeholder="e.g. Summer Collection"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category Image</label>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl p-6 hover:border-ruby/30 transition-all cursor-pointer relative group">
                    {categoryForm.image ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                        <img src={categoryForm.image} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setCategoryForm({...categoryForm, image: ''})}
                          className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-gray-50 rounded-xl text-gray-400 mb-2">
                          <ImageIcon size={24} />
                        </div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest font-sans">Click to upload image</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error("Image size must be less than 5MB");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const compressed = await compressImage(reader.result as string, 400, 400, 0.6);
                            setCategoryForm({...categoryForm, image: compressed});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sort Order (Sequence Number)</label>
                  <input 
                    type="number" 
                    value={categoryForm.sortOrder || ''}
                    onChange={e => setCategoryForm({...categoryForm, sortOrder: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-mono"
                    placeholder="e.g. 1 (lower numbers show first)"
                    min="0"
                  />
                  <p className="text-[9px] text-[#A2A4B0] leading-tight">Specify a numeric order value. Smaller numbers are displayed first (e.g. 1, 2, 3).</p>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Category'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Color Modal */}
      <AnimatePresence>
        {isColorModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsColorModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Add Color</h2>
                <button onClick={() => setIsColorModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveColor} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Color Name</label>
                  <input 
                    type="text" 
                    required
                    value={colorForm.name || ''}
                    onChange={e => setColorForm({...colorForm, name: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    placeholder="e.g. Ruby Red"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Color Hex Code</label>
                  <div className="flex items-center space-x-4">
                    <input 
                      type="color" 
                      value={colorForm.hex || '#000000'}
                      onChange={e => setColorForm({...colorForm, hex: e.target.value})}
                      className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                    />
                    <input 
                      type="text" 
                      required
                      value={colorForm.hex || '#000000'}
                      onChange={e => setColorForm({...colorForm, hex: e.target.value})}
                      className="flex-grow border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95">
                  Save Color
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Size Modal */}
      <AnimatePresence>
        {isSizeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSizeModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Add Size</h2>
                <button onClick={() => setIsSizeModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveSize} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Size Name</label>
                  <input 
                    type="text" 
                    required
                    value={sizeForm.name || ''}
                    onChange={e => setSizeForm({...sizeForm, name: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    placeholder="e.g. XL, 42, Large"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95">
                  Save Size
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Coupon Modal */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCouponModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg p-6 md:p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <h2 className="text-xl font-bold text-gray-800">{editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}</h2>
                <button onClick={() => setIsCouponModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveCoupon} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Coupon Code</label>
                  <input 
                    type="text" 
                    required
                    value={couponForm.code || ''}
                    onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                    className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-black tracking-widest text-[#1A2C54]"
                    placeholder="e.g. SUMMER50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discount Type</label>
                    <select 
                      value={couponForm.type || 'percentage'}
                      onChange={e => setCouponForm({...couponForm, type: e.target.value})}
                      className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </div>

                  {couponForm.type !== 'free_shipping' ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discount Value</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        value={couponForm.value ?? couponForm.discount ?? ''}
                        onChange={e => setCouponForm({...couponForm, value: parseFloat(e.target.value) || 0, discount: parseFloat(e.target.value) || 0})}
                        className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                        placeholder={couponForm.type === 'percentage' ? 'e.g. 20' : 'e.g. 500'}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discount Value</label>
                      <input 
                        type="text" 
                        disabled
                        value="100% Free Shipping"
                        className="w-full border-b border-gray-200 py-2 text-sm bg-gray-50 text-gray-400 font-medium cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Min Cart Value (₹)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={couponForm.min_cart_value ?? couponForm.minCartValue ?? ''}
                      onChange={e => setCouponForm({...couponForm, min_cart_value: parseFloat(e.target.value) || 0})}
                      className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                      placeholder="e.g. 499 (0 for no min)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Usage Limit (Total)</label>
                    <input 
                      type="number" 
                      min="1"
                      value={couponForm.usage_limit ?? ''}
                      onChange={e => setCouponForm({...couponForm, usage_limit: e.target.value})}
                      className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                      placeholder="Blank for unlimited"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Start Date</label>
                    <input 
                      type="date" 
                      value={couponForm.start_date || ''}
                      onChange={e => setCouponForm({...couponForm, start_date: e.target.value})}
                      className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">End Date / Expiry</label>
                    <input 
                      type="date" 
                      value={couponForm.end_date || couponForm.expiryDate || ''}
                      onChange={e => setCouponForm({...couponForm, end_date: e.target.value, expiryDate: e.target.value})}
                      className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</label>
                  <select 
                    value={couponForm.active ? 'true' : 'false'}
                    onChange={e => setCouponForm({...couponForm, active: e.target.value === 'true'})}
                    className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-medium"
                  >
                    <option value="true">Active ✅</option>
                    <option value="false">Inactive ❌</option>
                  </select>
                </div>

                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95">
                  {editingCoupon ? 'Update Coupon' : 'Save Coupon'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modals */}

      <AnimatePresence>
        {isBannerModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBannerModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">{editingBanner ? "Edit Banner" : "Add New Banner"}</h2>
                <button onClick={() => setIsBannerModalOpen(false)} className="p-2 hover:text-ruby transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveBanner} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Banner Image</label>
                  <div 
                    onClick={() => bannerImageInputRef.current?.click()}
                    className="aspect-video w-full border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center bg-gray-50 cursor-pointer overflow-hidden relative group"
                  >
                    {bannerForm.image ? (
                      <img src={bannerForm.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center space-y-2">
                        <Camera size={24} className="mx-auto text-gray-300" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Click to upload</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={bannerImageInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleBannerImageUpload} 
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Banner Title</label>
                    <input 
                      type="text" 
                      placeholder="Enter title (e.g. Summer Collection)"
                      value={bannerForm.title}
                      onChange={e => setBannerForm({...bannerForm, title: e.target.value})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Target Action</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['category', 'product', 'link'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setBannerLinkType(type as any);
                            setBannerLinkValue('');
                            setBannerForm({ ...bannerForm, link: '' });
                          }}
                          className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                            bannerLinkType === type 
                            ? 'bg-ruby text-white border-ruby shadow-md' 
                            : 'bg-white text-gray-400 border-gray-100 hover:border-ruby/30'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                      {bannerLinkType === 'category' && (
                        <select
                          value={bannerLinkValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBannerLinkValue(val);
                            setBannerForm({ ...bannerForm, link: `/shop?category=${encodeURIComponent(val)}` });
                          }}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ruby"
                        >
                          <option value="">Select Category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      )}

                      {bannerLinkType === 'product' && (
                        <select
                          value={bannerLinkValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBannerLinkValue(val);
                            setBannerForm({ ...bannerForm, link: `/product/${val}` });
                          }}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ruby"
                        >
                          <option value="">Select Product</option>
                          {products.map(prod => (
                            <option key={prod.id} value={prod.id}>{prod.name}</option>
                          ))}
                        </select>
                      )}

                      {bannerLinkType === 'link' && (
                        <input 
                          type="text" 
                          placeholder="https://example.com or /shop"
                          value={bannerForm.link || ''}
                          onChange={e => setBannerForm({...bannerForm, link: e.target.value})}
                          className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all">
                  {editingBanner ? "Update Banner" : "Add Banner"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteProduct}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
      />

      <DeleteConfirmationModal 
        isOpen={deleteCategoryModalOpen}
        onCancel={() => setDeleteCategoryModalOpen(false)}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        message="Are you sure you want to delete this category? This will not delete products in this category but will remove the category organization. This action cannot be undone."
      />

      <DeleteConfirmationModal 
        isOpen={deletePromotionModalOpen}
        onCancel={() => setDeletePromotionModalOpen(false)}
        onConfirm={confirmDeletePromotion}
        title="Delete Offer"
        message="Are you sure you want to delete this promotional offer? This action cannot be undone."
      />

      <DeleteConfirmationModal 
        isOpen={genericDeleteModal.isOpen}
        onCancel={() => setGenericDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={genericDeleteModal.onConfirm}
        title={genericDeleteModal.title}
        message={genericDeleteModal.message}
      />

      <DeleteConfirmationModal 
        isOpen={deleteOrderModalOpen}
        onCancel={() => setDeleteOrderModalOpen(false)}
        onConfirm={confirmDeleteOrder}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
      />

      <DeleteConfirmationModal 
        isOpen={deleteReviewModalOpen}
        onCancel={() => setDeleteReviewModalOpen(false)}
        onConfirm={confirmDeleteReview}
        title="Delete Review"
        message="Are you sure you want to delete this review? This action cannot be undone."
      />

      <AnimatePresence>
        {showWipeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWipeModal(false)}
              className="absolute inset-0 bg-[#0A0E1A]/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border border-red-50 space-y-8"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto ring-8 ring-red-50/50">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-[#1A2C54]">Extreme Caution!</h3>
                  <p className="text-sm text-gray-400 font-medium px-4">You are about to delete ALL orders, customers, reviews, and analytics. This action <span className="text-red-500 font-bold underline">CANNOT BE UNDONE.</span></p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Type Secret Password</label>
                  <input 
                    type="password"
                    value={wipePassword}
                    onChange={(e) => setWipePassword(e.target.value)}
                    placeholder="Enter password to confirm"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-red-500/50 outline-none transition-all"
                  />
                </div>
                
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 items-start">
                   <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                   <p className="text-[10px] text-amber-900 leading-relaxed font-bold">
                     HINT: Password is the one you usually use for final server resets (e.g. RESET_THE_RUBY_2026).
                   </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={performWipe}
                  disabled={isCleaningUp || !wipePassword}
                  className="w-full py-5 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {isCleaningUp ? 'Destroying Data...' : 'Wipe Everything'}
                </button>
                <button 
                  onClick={() => {
                    setShowWipeModal(false);
                    setWipePassword('');
                  }}
                  disabled={isCleaningUp}
                  className="w-full py-4 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:text-gray-600 transition-colors"
                >
                  Cancel & Go Back
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promotion Engine Modal */}
      <AnimatePresence>
        {isPromotionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPromotionModalOpen(false)}
              className="absolute inset-0 bg-[#1A2C54]/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex items-center justify-between ruby-gradient shrink-0">
                <div className="flex items-center gap-4 text-white">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-lg border border-white/20">
                    <Zap size={28} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic">{editingPromotion ? 'Edit Offer' : 'Craft New Offer'} 💎</h2>
                    <p className="text-xs text-white/70 font-bold uppercase tracking-widest leading-none mt-1">Promotion Engine Configuration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPromotionModalOpen(false)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 transition-all rounded-xl flex items-center justify-center text-white border border-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Scrollable Area */}
              <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar bg-gray-50/30">
                
                {/* 1. BASIC INFO */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-ruby/10 text-ruby flex items-center justify-center">
                      <Info size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 1: Basic Info</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-ruby">Offer Name *</label>
                       <input 
                         type="text" 
                         value={promotionForm.name}
                         onChange={e => setPromotionForm({...promotionForm, name: e.target.value})}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 transition-all placeholder:text-gray-300"
                         placeholder="e.g. Summer Mega Sale"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Priority (1-10)</label>
                       <input 
                         type="number" 
                         min="1"
                         max="10"
                         value={promotionForm.priority === '' || promotionForm.priority === null || promotionForm.priority === undefined || isNaN(promotionForm.priority) ? '' : promotionForm.priority}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                           setPromotionForm({...promotionForm, priority: isNaN(val as any) ? '' : val});
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 transition-all"
                       />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                       <textarea 
                         value={promotionForm.description}
                         onChange={e => setPromotionForm({...promotionForm, description: e.target.value})}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 transition-all min-h-[80px]"
                         placeholder="Short details about this offer..."
                       />
                    </div>
                  </div>
                </div>

                {/* 2. OFFER TYPE */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-ruby/10 text-ruby flex items-center justify-center">
                      <Zap size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 2: Offer Type</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { id: 'bxgy', label: 'Buy X Get Y', icon: Zap },
                      { id: 'percentage', label: 'Percentage', icon: Percent },
                      { id: 'flat', label: 'Flat Off', icon: Tag },
                      { id: 'shipping', label: 'Free Shipping', icon: Truck },
                      { id: 'bundle', label: 'Bundle', icon: ShoppingBag },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setPromotionForm({...promotionForm, type: type.id as any})}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                          promotionForm.type === type.id 
                            ? 'border-ruby bg-ruby text-white' 
                            : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-ruby/20 hover:text-ruby'
                        }`}
                      >
                        <type.icon size={20} />
                        <span className="text-[9px] font-black uppercase tracking-tight">{type.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Config based on Type */}
                  <AnimatePresence mode="wait">
                    {promotionForm.type === 'bxgy' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-ruby/5 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6"
                      >
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-ruby uppercase tracking-widest">Buy Qty</label>
                          <input 
                            type="number" 
                            value={promotionForm.bxgyConfig?.buyQty === '' || promotionForm.bxgyConfig?.buyQty === null || promotionForm.bxgyConfig?.buyQty === undefined || isNaN(promotionForm.bxgyConfig?.buyQty) ? '' : promotionForm.bxgyConfig?.buyQty}
                            onChange={e => {
                              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                              setPromotionForm({
                                ...promotionForm, 
                                bxgyConfig: { ...promotionForm.bxgyConfig, buyQty: isNaN(val as any) ? '' : val }
                              });
                            }}
                            className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm font-bold text-ruby"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-ruby uppercase tracking-widest">Get Qty (Free)</label>
                          <input 
                            type="number" 
                            value={promotionForm.bxgyConfig?.getQty === '' || promotionForm.bxgyConfig?.getQty === null || promotionForm.bxgyConfig?.getQty === undefined || isNaN(promotionForm.bxgyConfig?.getQty) ? '' : promotionForm.bxgyConfig?.getQty}
                            onChange={e => {
                              const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                              setPromotionForm({
                                ...promotionForm, 
                                bxgyConfig: { ...promotionForm.bxgyConfig, getQty: isNaN(val as any) ? '' : val }
                              });
                            }}
                            className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm font-bold text-ruby"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-ruby uppercase tracking-widest">Apply On</label>
                          <select 
                            value={promotionForm.bxgyConfig?.applyOn || 'same'}
                            onChange={e => setPromotionForm({
                              ...promotionForm, 
                              bxgyConfig: { ...promotionForm.bxgyConfig, applyOn: e.target.value as any }
                            })}
                            className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm font-bold text-ruby outline-none"
                          >
                            <option value="same">Same Product</option>
                            <option value="cheapest">Cheapest in Cart</option>
                            <option value="specific">Specific Items</option>
                          </select>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3. CONDITIONS */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                   <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Shield size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 3: Conditions</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Min Cart Value (₹)</label>
                       <input 
                         type="number" 
                         value={promotionForm.conditions?.minCartValue === '' || promotionForm.conditions?.minCartValue === null || promotionForm.conditions?.minCartValue === undefined || isNaN(promotionForm.conditions?.minCartValue) ? '' : promotionForm.conditions?.minCartValue}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                           setPromotionForm({
                             ...promotionForm,
                             conditions: { ...promotionForm.conditions, minCartValue: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Min Quantity</label>
                       <input 
                         type="number" 
                         value={promotionForm.conditions?.minQuantity === '' || promotionForm.conditions?.minQuantity === null || promotionForm.conditions?.minQuantity === undefined || isNaN(promotionForm.conditions?.minQuantity) ? '' : promotionForm.conditions?.minQuantity}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                           setPromotionForm({
                             ...promotionForm,
                             conditions: { ...promotionForm.conditions, minQuantity: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Target User Segment</label>
                       <select 
                         value={promotionForm.conditions?.userType || 'all'}
                         onChange={e => setPromotionForm({
                           ...promotionForm,
                           conditions: { ...promotionForm.conditions, userType: e.target.value as any }
                         })}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54] outline-none"
                       >
                         <option value="all">Every Customer</option>
                         <option value="new">First Time Buyers</option>
                         <option value="loyal">Repeat Customers</option>
                       </select>
                    </div>
                  </div>
                </div>

                {/* 4. REWARDS */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Gift size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 4: Rewards</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount Method</label>
                       <select 
                         value={promotionForm.reward?.method || 'auto'}
                         onChange={e => setPromotionForm({
                           ...promotionForm,
                           reward: { ...promotionForm.reward, method: e.target.value as any }
                         })}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54] outline-none"
                       >
                         <option value="auto">Automatic (Cart Discount)</option>
                         <option value="discount">Dynamic Percentage</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount Value (%)</label>
                       <input 
                         type="number" 
                         value={promotionForm.reward?.value === '' || promotionForm.reward?.value === null || promotionForm.reward?.value === undefined || isNaN(promotionForm.reward?.value) ? '' : promotionForm.reward?.value}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                           setPromotionForm({
                             ...promotionForm,
                             reward: { ...promotionForm.reward, value: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                         placeholder="Value (e.g. 10)"
                       />
                    </div>
                  </div>
                </div>

                {/* 5. LIMITS & USAGE */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                   <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <History size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 5: Limits & Usage</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Usage per Customer</label>
                       <input 
                         type="number" 
                         value={promotionForm.limits?.perUser === '' || promotionForm.limits?.perUser === null || promotionForm.limits?.perUser === undefined || isNaN(promotionForm.limits?.perUser) ? '' : promotionForm.limits?.perUser}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                           setPromotionForm({
                             ...promotionForm,
                             limits: { ...promotionForm.limits, perUser: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total Store Usage</label>
                       <input 
                         type="number" 
                         value={promotionForm.limits?.totalUsage === '' || promotionForm.limits?.totalUsage === null || promotionForm.limits?.totalUsage === undefined || isNaN(promotionForm.limits?.totalUsage) ? '' : promotionForm.limits?.totalUsage}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                           setPromotionForm({
                             ...promotionForm,
                             limits: { ...promotionForm.limits, totalUsage: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Max Cap Discount (₹)</label>
                       <input 
                         type="number" 
                         value={promotionForm.limits?.maxDiscount === '' || promotionForm.limits?.maxDiscount === null || promotionForm.limits?.maxDiscount === undefined || isNaN(promotionForm.limits?.maxDiscount) ? '' : promotionForm.limits?.maxDiscount}
                         onChange={e => {
                           const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                           setPromotionForm({
                             ...promotionForm,
                             limits: { ...promotionForm.limits, maxDiscount: isNaN(val as any) ? '' : val }
                           });
                         }}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                  </div>
                </div>

                {/* 6. SCHEDULING (Combine Status here) */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 6: Scheduling & Status</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Date</label>
                       <input 
                         type="date" 
                         value={promotionForm.conditions.startDate || ''}
                         onChange={e => setPromotionForm({
                           ...promotionForm,
                           conditions: { ...promotionForm.conditions, startDate: e.target.value }
                         })}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Date</label>
                       <input 
                         type="date" 
                         value={promotionForm.conditions.endDate || ''}
                         onChange={e => setPromotionForm({
                           ...promotionForm,
                           conditions: { ...promotionForm.conditions, endDate: e.target.value }
                         })}
                         className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-[#1A2C54]"
                       />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between p-4 bg-gray-50 rounded-3xl">
                      <div>
                        <p className="text-[10px] font-black text-[#1A2C54] uppercase tracking-widest">Offer Status</p>
                        <p className="text-xs text-gray-400 font-medium italic">Active turns offer live instantly</p>
                      </div>
                      <div className="flex gap-2">
                        {['draft', 'active', 'expired'].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setPromotionForm({...promotionForm, status: status as any})}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              promotionForm.status === status 
                                ? 'bg-[#1A2C54] text-white' 
                                : 'bg-white border border-gray-100 text-gray-400'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. STACKING RULES */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Layers size={16} />
                    </div>
                    <h3 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest">Section 7: Stacking Rules</h3>
                  </div>
                  <div className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between ${promotionForm.stackable ? 'border-emerald-100 bg-emerald-50/50' : 'border-gray-50 bg-gray-50/50'}`}>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-[#1A2C54]">Allow Stacking?</h4>
                      <p className="text-[10px] text-gray-500 font-medium">Can this offer be used with other active promotions?</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPromotionForm({...promotionForm, stackable: !promotionForm.stackable})}
                      className={`w-14 h-8 rounded-full relative transition-all ${promotionForm.stackable ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${promotionForm.stackable ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-gray-100 flex items-center justify-between shrink-0 bg-white">
                <button 
                  onClick={() => setIsPromotionModalOpen(false)}
                  className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all border border-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePromotion}
                  disabled={loading}
                  className="bg-ruby text-white px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-xl shadow-ruby/30 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                >
                  <Save size={18} />
                  {loading ? 'Saving...' : (editingPromotion ? 'Update Offer' : 'Save Offer')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GRANT BONUS POINTS MODAL */}
      <AnimatePresence>
        {isGrantBonusModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGrantBonusModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative z-10 border border-gray-100 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Grant Bonus Points</h3>
                    <p className="text-xs text-gray-500">Add custom loyalty points to {selectedCustomer.displayName || selectedCustomer.email || 'Customer'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsGrantBonusModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Points Amount</label>
                  <input 
                    type="number" 
                    value={bonusPointsInput} 
                    onChange={(e) => setBonusPointsInput(e.target.value)} 
                    placeholder="e.g. 100" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Reason / Description</label>
                  <input 
                    type="text" 
                    value={bonusReasonInput} 
                    onChange={(e) => setBonusReasonInput(e.target.value)} 
                    placeholder="e.g. Special VIP Gift, Goodwill Bonus" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsGrantBonusModalOpen(false)} 
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    const pts = parseInt(bonusPointsInput);
                    if (isNaN(pts) || pts <= 0) {
                      toast.error("Please enter a valid points amount");
                      return;
                    }
                    await updateLoyaltyPoints(selectedCustomer.id, pts, bonusReasonInput || 'Admin bonus points');
                    setIsGrantBonusModalOpen(false);
                  }} 
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-amber-500/20 font-bold"
                >
                  Grant Points
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
