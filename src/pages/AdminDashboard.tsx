import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth, messaging } from '../firebase';
import { getToken } from 'firebase/messaging';
import { Product, Category } from '../types';
import { toast } from 'sonner';
import { 
  LayoutDashboard, Package, Tags, ShoppingBag, Palette, Maximize2, 
  Ticket, Users, Settings, LogOut, Search, Bell, Menu, X, 
  TrendingUp, ShoppingCart, UserPlus, AlertTriangle, ChevronRight, ChevronLeft,
  MoreVertical, Edit2, Trash2, Plus, Image as ImageIcon, Database, BarChart3,
  Home, ArrowLeft, Camera, ChevronDown, ChevronUp, Bold, Heading, Globe, Truck,
  TrendingDown, Shield, Volume2, Mail, Smartphone, Calendar, MessageCircle, Phone, Video, CheckCheck, Star, Info, MapPin, History,
  Activity, Send, Rocket, MessageSquare, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cn } from '../lib/utils';

import { generateInvoice } from '../utils/invoiceGenerator';
import { generateShippingLabel } from '../utils/shippingLabelGenerator';
import ReactGlobe from 'react-globe.gl';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const chartDataSample = [];
const recentOrdersSample = [];
const topProductsSample = [];

type Tab = 'home' | 'dashboard' | 'products' | 'category' | 'orders' | 'colour' | 'size' | 'coupon' | 'customer' | 'settings' | 'rocket' | 'stats' | 'notifications' | 'chats' | 'reviews' | 'abandoned' | 'insights' | 'live';

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

function AddProductPage({ formData, setFormData, onSave, onCancel, isEditing, categories, colors, sizes }: any) {
  const [activeDescriptionTab, setActiveDescriptionTab] = useState<'edit' | 'preview'>('edit');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
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
      // Check file size (limit to 1MB for Firestore)
      if (file.size > 1024 * 1024) {
        toast.error("Image size too large. Please select an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateImage(galleryTargetIndex, base64String);
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
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```html|```/g, '').trim();
      
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
    <div className="space-y-6 md:space-y-8 pb-20">
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
              <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">Supported formats: JPG, PNG, WEBP (Max 1MB)</p>
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

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</label>
                  <select 
                    value={formData.category || 'Women'}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent appearance-none"
                  >
                    {categories.length > 0 ? (
                      categories.map((cat: any) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Women">Women</option>
                        <option value="Men">Men</option>
                        <option value="New Arrivals">New Arrivals</option>
                      </>
                    )}
                  </select>
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

                <div className="md:col-span-2 flex items-center space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isTrending: !formData.isTrending })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.isTrending ? 'bg-ruby' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isTrending ? 'left-7' : 'left-1'}`} />
                  </button>
                  <div>
                    <p className="text-sm font-bold text-[#1A2C54]">Trending Product</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Show this product on the home page trending section</p>
                  </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Size</label>
                  <select 
                    value={newVariant.size || ''}
                    onChange={e => setNewVariant({...newVariant, size: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10"
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
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10"
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
                      className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                    />
                    <button 
                      type="button"
                      onClick={addVariant}
                      className="p-2.5 bg-ruby text-white rounded-xl hover:bg-black transition-all"
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
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-8 border-t border-gray-100">
          <button 
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-10 py-4 bg-white border border-gray-100 text-gray-400 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="w-full sm:w-auto px-12 py-4 bg-ruby text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-xl shadow-ruby/20 active:scale-95"
          >
            {isEditing ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminMessage, setAdminMessage] = useState('');
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const adminChatFileRef = React.useRef<HTMLInputElement>(null);
  const bannerImageInputRef = React.useRef<HTMLInputElement>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isCustomerDeleteModalOpen, setIsCustomerDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);

  const [categoryForm, setCategoryForm] = useState({ name: '', image: '' });
  const [colorForm, setColorForm] = useState({ name: '', hex: '#000000' });
  const [sizeForm, setSizeForm] = useState({ name: '' });
  const [couponForm, setCouponForm] = useState({ code: '', discount: 0, expiryDate: '', type: 'percentage' as 'percentage' | 'fixed' });
  const [bannerForm, setBannerForm] = useState({ image: '', link: '', active: true });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'live' | 'reports'>('overview');
  
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const globeContainerRef = React.useRef<HTMLDivElement>(null);
  const [globeSize, setGlobeSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (activeTab !== 'live' || !globeContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setGlobeSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });
    observer.observe(globeContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  const totalRevenue = orders.reduce((acc, order) => acc + (order.total || 0), 0);

  const topStates = React.useMemo(() => {
    const counts: Record<string, number> = {};
    liveSessions.forEach(s => {
      const state = s.region || 'Unknown';
      counts[state] = (counts[state] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [liveSessions]);

  const topCountries = React.useMemo(() => {
    const counts: Record<string, number> = {};
    liveSessions.forEach(s => {
      const country = s.country || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));
  }, [liveSessions]);
  
  const topProducts = React.useMemo(() => {
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
    storeName: 'The Ruby',
    storeLogo: '',
    supportEmail: 'support@theruby.com',
    currency: 'INR (₹)',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    googleSheetUrl: '',
    googleSheetApiKey: '',
    notificationSound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    favicon: '',
    siteTitle: 'The Ruby | Premium Clothing',
    metaDescription: 'Discover the latest trends in fashion at The Ruby.',
    resendApiKey: '',
    fromEmail: 'The Ruby <onboarding@resend.dev>',
    fast2smsApiKey: '',
    fast2smsTestPhone: '',
    fcmVapidKey: '',
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
    }
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio(settings.notificationSound);
    
    // Real-time orders listener for notifications
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(10));
    let isInitialLoad = true;

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      // ... existing orders logic ...
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    // Real-time chats listener
    const chatsQuery = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chats');
    });

    // Real-time active sessions listener
    const unsubscribeSessions = onSnapshot(collection(db, 'active_sessions'), (snapshot) => {
      setLiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'active_sessions');
    });

    // Real-time notifications listener
    const notificationsQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => {
      unsubscribeOrders();
      unsubscribeChats();
      unsubscribeSessions();
      unsubscribeNotifications();
    };
  }, [settings.notificationSound]);

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

  const [activeSettingsTab, setActiveSettingsTab] = useState('store');

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushNotification.title || !pushNotification.body) {
      toast.error("Please fill in both title and body");
      return;
    }

    setIsSendingNotification(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        ...pushNotification,
        createdAt: new Date().toISOString(),
        sentBy: auth.currentUser?.email,
        status: 'Sent'
      });
      
      // Send real push notification via server
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pushNotification.title,
          body: pushNotification.body,
          url: '/',
          type: pushNotification.type
        })
      });

      toast.success("Push notification sent successfully! 🚀");
      setPushNotification({ title: '', body: '', type: 'all' });
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Failed to send notification");
    } finally {
      setIsSendingNotification(false);
    }
  };

  const requestNotificationPermission = async () => {
    // @ts-ignore
    const OneSignal = window.OneSignal;
    
    if (!OneSignal) {
      toast.error("OneSignal is not loaded yet. Please refresh the page.");
      return;
    }

    setIsSubscribingPush(true);
    try {
      console.log("OneSignal Button Clicked. Requesting permission...");
      await OneSignal.Notifications.requestPermission();
      
      const isSubscribed = OneSignal.User.PushSubscription.optedIn;
      console.log("OneSignal Subscription status:", isSubscribed);
      
      if (isSubscribed) {
        toast.success("Push Notifications Enabled via OneSignal! 🔔");
      } else {
        toast.info("Please allow notifications in your browser to receive updates.");
      }
    } catch (error: any) {
      console.error("Error enabling push:", error);
      toast.error(error.message || "Failed to enable push notifications");
    } finally {
      setIsSubscribingPush(false);
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

  const handleSaveSettings = async () => {
    try {
      // Save to Firestore
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (settingsSnap.empty) {
        await addDoc(collection(db, 'settings'), settings);
      } else {
        await updateDoc(doc(db, 'settings', settingsSnap.docs[0].id), settings);
      }
      
      // Sync API Keys with server
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resendApiKey: settings.resendApiKey,
          razorpayKeyId: settings.razorpayKeyId,
          razorpayKeySecret: settings.razorpayKeySecret,
          fast2smsApiKey: settings.fast2smsApiKey
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
    if (!settings.resendApiKey) {
      toast.error('Please enter a Resend API Key first');
      return;
    }
    
    setIsTestingEmail(true);
    try {
      // Sync Resend API Key with server first
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resendApiKey: settings.resendApiKey })
      });

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: settings.supportEmail,
          from: settings.fromEmail || 'The Ruby <onboarding@resend.dev>',
          subject: 'Test Email from The Ruby ✨',
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAFAFA; padding: 40px 20px; color: #1A2C54;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 40px; padding: 60px; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.08); border: 1px solid #F0F0F0;">
                <div style="text-align: center; margin-bottom: 50px;">
                  ${settings.storeLogo ? `<img src="${settings.storeLogo}" alt="${settings.storeName}" style="max-height: 60px; margin-bottom: 10px;">` : `<h1 style="font-size: 32px; font-weight: bold; letter-spacing: -1px; margin: 0; color: #E11D48;">${settings.storeName?.toUpperCase() || 'THE RUBY'}</h1>`}
                </div>
                
                <div style="text-align: center; margin-bottom: 40px;">
                  <div style="display: inline-block; background-color: #FDF2F8; color: #E11D48; padding: 12px 24px; border-radius: 100px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px;">Connection Test</div>
                  <h2 style="font-size: 28px; font-weight: bold; margin: 0 0 16px 0; color: #1A2C54;">Email Integration Successful! 🚀</h2>
                  <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0;">This is a test email to verify your Resend API configuration. If you're reading this, your store is ready to send professional notifications to your customers.</p>
                </div>

                <div style="background-color: #F9FAFB; border-radius: 24px; padding: 32px; margin-bottom: 40px; border: 1px solid #F3F4F6;">
                  <p style="font-size: 14px; color: #666666; margin: 0; text-align: center;">Your API Key is correctly configured and the server is ready to handle email requests.</p>
                </div>

                <div style="text-align: center; border-top: 1px solid #F0F0F0; pt-40px;">
                  <p style="font-size: 16px; font-weight: bold; color: #1A2C54; margin: 0;">The Ruby Admin Panel</p>
                  <p style="font-size: 14px; color: #E11D48; font-weight: bold; margin: 4px 0 0 0;">System Notification</p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 40px;">
                <p style="font-size: 12px; color: #9CA3AF;">&copy; ${new Date().getFullYear()} ${settings.storeName || 'The Ruby'}. All rights reserved.</p>
              </div>
            </div>
          `
        })
      });
      
      if (response.ok) {
        toast.success(`Test email sent to ${settings.supportEmail}`);
      } else {
        const data = await response.json();
        if (data.name === 'validation_error') {
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

  const [orderSearchTerm, setOrderSearchTerm] = useState('');
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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Women' as Category,
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
    variants: [] as { size: string; color: string; stock: number }[]
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
          const orderDate = new Date(o.createdAt);
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
          const orderDate = new Date(o.createdAt);
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
          const orderDate = new Date(o.createdAt);
          return orderDate > new Date(d.getTime() - 5 * 24 * 60 * 60 * 1000) && orderDate <= d;
        });
        const sales = periodOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
        data.push({ name: label, sales, orders: periodOrders.length });
      }
    }
    
    setChartData(data.length > 0 ? data : chartDataSample);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [productsSnap, ordersSnap, usersSnap, categoriesSnap, colorsSnap, sizesSnap, couponsSnap, bannersSnap, settingsSnap, reviewsSnap, cartsSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, 'products')).catch(e => handleFirestoreError(e, OperationType.GET, 'products')),
        getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))).catch(e => handleFirestoreError(e, OperationType.GET, 'orders')),
        getDocs(collection(db, 'users')).catch(e => handleFirestoreError(e, OperationType.GET, 'users')),
        getDocs(collection(db, 'categories')).catch(e => handleFirestoreError(e, OperationType.GET, 'categories')),
        getDocs(collection(db, 'colors')).catch(e => handleFirestoreError(e, OperationType.GET, 'colors')),
        getDocs(collection(db, 'sizes')).catch(e => handleFirestoreError(e, OperationType.GET, 'sizes')),
        getDocs(collection(db, 'coupons')).catch(e => handleFirestoreError(e, OperationType.GET, 'coupons')),
        getDocs(collection(db, 'banners')).catch(e => handleFirestoreError(e, OperationType.GET, 'banners')),
        getDocs(collection(db, 'settings')).catch(e => handleFirestoreError(e, OperationType.GET, 'settings')),
        getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))).catch(e => handleFirestoreError(e, OperationType.GET, 'reviews')),
        getDocs(query(collection(db, 'carts'), orderBy('updatedAt', 'desc'))).catch(e => handleFirestoreError(e, OperationType.GET, 'carts')),
        getDocs(collection(db, 'active_sessions')).catch(e => handleFirestoreError(e, OperationType.GET, 'active_sessions'))
      ]);

      if (!settingsSnap.empty) {
        const settingsData = settingsSnap.docs[0].data();
        setSettings(prev => ({ ...prev, ...settingsData }));
      }

      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setUsersCount(usersSnap.size);
      setCustomers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setColors(colorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSizes(sizesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCoupons(couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setReviews(reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAbandonedCarts(cartsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(cart => cart.status === 'active' && cart.items?.length > 0));
      setLiveSessions(sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedChat) return;

    const q = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Mark as read by admin
      updateDoc(doc(db, 'chats', selectedChat.id), {
        unreadCountAdmin: 0
      }).catch(() => {});
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${selectedChat.id}/messages`);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendAdminMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!selectedChat || (!adminMessage.trim() && !imageUrl)) return;

    const text = adminMessage.trim();
    setAdminMessage('');

    try {
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
        text: text || '',
        image: imageUrl || null,
        type: imageUrl ? 'image' : 'text',
        senderId: 'admin',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: imageUrl ? 'Sent an image' : text,
        lastMessageAt: serverTimestamp(),
        unreadCountUser: (selectedChat.unreadCountUser || 0) + 1
      });
    } catch (error) {
      console.error("Error sending admin message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleAdminImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error("Image size must be less than 1MB");
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
      await deleteDoc(doc(db, 'orders', orderToDelete));
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
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      const order = orders.find(o => o.id === orderId);
      
      // Send OneSignal notification to customer
      if (order && order.userId && order.userId !== 'guest') {
        try {
          await fetch('/api/send-user-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: order.userId,
              title: 'Order Status Updated! 📦',
              body: `Your order ${order.orderId} is now ${newStatus}.`,
              url: '/my-orders'
            })
          });
        } catch (e) {
          console.error("Failed to send customer push notification:", e);
        }
      }

      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (viewingCustomer && viewingCustomer.id === orderId) {
        setViewingCustomer({ ...viewingCustomer, status: newStatus });
      }
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleAddOrder = async () => {
    try {
      const orderId = `#LF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const newOrder = {
        orderId,
        address: {
          name: 'Test Customer',
          email: 'test@example.com',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          number: '9876543210'
        },
        status: 'Pending',
        total: Math.floor(Math.random() * 5000) + 500,
        createdAt: new Date().toISOString(),
        items: [],
        paymentMethod: 'COD',
        shippingMethod: 'Standard Delivery'
      };
      const docRef = await addDoc(collection(db, 'orders'), newOrder);
      // No need to manually update state as onSnapshot will handle it
      toast.success('Order added successfully');
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
    const matchesStatus = orderStatusFilter === 'All Status' || order.status === orderStatusFilter;
    
    let matchesDate = true;
    if (orderStartDate || orderEndDate) {
      const orderDate = new Date(order.createdAt || Date.now());
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
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('phone_user');
    await auth.signOut();
    navigate('/login');
    window.location.reload();
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success("Product added successfully");
      }
      setShowAddProductPage(false);
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
        variants: []
      });
      fetchProducts();
    } catch (error) {
      toast.error("Failed to save product");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setProductToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      toast.success("Product deleted");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to delete product");
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        let successCount = 0;
        for (const item of data) {
          if (item.name && item.price) {
            await addDoc(collection(db, 'products'), {
              name: item.name,
              price: Number(item.price),
              description: item.description || '',
              category: item.category || '',
              stock: Number(item.stock) || 0,
              images: item.images ? item.images.split(',') : [],
              createdAt: new Date().toISOString(),
              status: 'active'
            });
            successCount++;
          }
        }
        toast.success(`Successfully uploaded ${successCount} products!`);
        fetchDashboardData();
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Bulk Upload Error:", error);
      toast.error("Failed to upload products");
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
        new Date(order.createdAt).toLocaleDateString(),
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
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text(`Total Orders: ${orders.length}`, 14, finalY);
      doc.text(`Total Revenue: Rs. ${totalRevenue.toFixed(2)}`, 14, finalY + 7);

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
    toast.info(`Sending reminder to ${cart.userEmail || 'customer'}...`);
    // In a real app, you'd call a backend function that uses Resend
    // For demo, we'll simulate it
    setTimeout(() => {
      toast.success("Reminder email sent successfully!");
    }, 1500);
  };

  const updateLoyaltyPoints = async (userId: string, points: number) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = customers.find(u => u.id === userId);
      const currentPoints = userDoc?.loyaltyPoints || 0;
      await updateDoc(userRef, { loyaltyPoints: currentPoints + points });
      toast.success(`Added ${points} points!`);
      fetchDashboardData();
    } catch (error) {
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
      await deleteDoc(doc(db, 'reviews', reviewToDelete));
      toast.success("Review deleted");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to delete review");
    } finally {
      setDeleteReviewModalOpen(false);
      setReviewToDelete(null);
    }
  };

  const handleAddCategory = () => {
    setCategoryForm({ name: '', image: '' });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) return;
    try {
      const slug = categoryForm.name.toLowerCase().replace(/ /g, '-');
      await addDoc(collection(db, 'categories'), { 
        ...categoryForm, 
        slug, 
        createdAt: new Date().toISOString() 
      });
      toast.success('Category added');
      setIsCategoryModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      toast.success('Category deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete category');
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
      await addDoc(collection(db, 'colors'), { 
        ...colorForm, 
        createdAt: new Date().toISOString() 
      });
      toast.success('Color added');
      setIsColorModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add color');
    }
  };

  const handleDeleteColor = async (id: string) => {
    if (!window.confirm('Delete this color?')) return;
    try {
      await deleteDoc(doc(db, 'colors', id));
      toast.success('Color deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete color');
    }
  };

  const handleAddSize = () => {
    setSizeForm({ name: '' });
    setIsSizeModalOpen(true);
  };

  const handleSaveSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeForm.name) return;
    try {
      await addDoc(collection(db, 'sizes'), { 
        ...sizeForm, 
        createdAt: new Date().toISOString() 
      });
      toast.success('Size added');
      setIsSizeModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add size');
    }
  };

  const handleDeleteSize = async (id: string) => {
    if (!window.confirm('Delete this size?')) return;
    try {
      await deleteDoc(doc(db, 'sizes', id));
      toast.success('Size deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete size');
    }
  };

  const handleAddCoupon = () => {
    setCouponForm({ code: '', discount: 0, expiryDate: '', type: 'percentage' });
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code || !couponForm.discount) return;
    try {
      await addDoc(collection(db, 'coupons'), { 
        ...couponForm,
        code: couponForm.code.toUpperCase(), 
        active: true,
        createdAt: new Date().toISOString() 
      });
      toast.success('Coupon added');
      setIsCouponModalOpen(false);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add coupon');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', id));
      toast.success('Coupon deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    
    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'users', customerToDelete.id));
      
      // 2. Attempt to delete from Auth via server API
      try {
        await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: customerToDelete.id })
        });
      } catch (authErr) {
        console.error("Failed to delete user from Auth:", authErr);
        // We still proceed because Firestore doc is deleted
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
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const handleBannerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("Image size must be less than 1MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerForm({ ...bannerForm, image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.image) {
      toast.error('Please provide an image');
      return;
    }
    try {
      await addDoc(collection(db, 'banners'), { 
        ...bannerForm,
        createdAt: new Date().toISOString() 
      });
      toast.success('Banner added');
      setIsBannerModalOpen(false);
      setBannerForm({ image: '', link: '', active: true });
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to add banner');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await deleteDoc(doc(db, 'banners', id));
      toast.success('Banner deleted');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to delete banner');
    }
  };

  const handleToggleBanner = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'banners', id), { active: !currentStatus });
      toast.success('Banner status updated');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update banner status');
    }
  };

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'category', label: 'Category', icon: Tags },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'colour', label: 'Colour', icon: Palette },
    { id: 'size', label: 'Size', icon: Maximize2 },
    { id: 'coupon', label: 'Coupon', icon: Ticket },
    { id: 'customer', label: 'Customer', icon: Users },
    { id: 'rocket', label: 'Marketing', icon: TrendingUp },
    { id: 'stats', label: 'Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'chats', label: 'Customer Chat', icon: MessageCircle },
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'abandoned', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'insights', label: 'Product Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const statusColors: Record<string, string> = {
    Delivered: 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20',
    Pending: 'bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20',
    Shipped: 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20',
    Cancelled: 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20',
    Processing: 'bg-[#FACC15]/10 text-[#854D0E] border border-[#FACC15]/20',
  };

  const seedData = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const dummyOrders = [
        { customerName: 'Rajesh Sharma', status: 'Shipped', total: 3200, createdAt: new Date().toISOString() },
        { customerName: 'Anita Verma', status: 'Pending', total: 1850, createdAt: new Date().toISOString() },
        { customerName: 'Vikram Gupta', status: 'Delivered', total: 2500, createdAt: new Date().toISOString() },
        { customerName: 'Sneha Patel', status: 'Cancelled', total: 900, createdAt: new Date().toISOString() },
      ];
      
      for (const order of dummyOrders) {
        await addDoc(ordersRef, order);
      }
      
      // Also add some dummy users if count is 0
      if (usersCount === 0) {
        const usersRef = collection(db, 'users');
        for (let i = 0; i < 5; i++) {
          await addDoc(usersRef, { email: `user${i}@example.com`, createdAt: new Date().toISOString() });
        }
      }

      toast.success("Dashboard data seeded successfully!");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to seed data");
    }
  };

  const totalSalesVal = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalOrdersVal = orders.length;
  const totalCustomersVal = usersCount;
  const lowStockVal = products.filter(p => p.stock < 10).length;

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex font-sans">
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
                <h2 className="text-white font-black text-lg leading-tight truncate">The Ruby</h2>
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
                            { id: 'store', label: 'Store Setting', icon: Settings },
                            { id: 'sheets', label: 'Google Sheet URL', icon: Database },
                            { id: 'email', label: 'Email Settings', icon: Mail },
                            { id: 'sound', label: 'Notification Sound', icon: Volume2 },
                            { id: 'seo', label: 'SEO & Branding', icon: Globe },
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
      <main className={`flex-grow transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
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
            <button 
              onClick={() => setActiveTab('live')}
              className="flex items-center space-x-2 px-2 md:px-3 py-1.5 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-all group"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] md:text-xs font-black uppercase tracking-widest">{liveSessions.length} <span className="hidden xs:inline">Live</span></span>
            </button>
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
                              <p className="text-[10px] text-gray-400">Order #{notif.orderId || notif.id?.slice(-6)} by {notif.address?.name || 'Guest'}</p>
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
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-gray-100 relative">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Admin" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full"></div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
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
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Dashboard Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h2 className="text-3xl font-black text-[#1A2C54] tracking-tight">Command Center</h2>
                      <p className="text-sm text-gray-400 font-medium">Welcome back, Admin. Here's what's happening today.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                        {(['overview', 'live', 'reports'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setDashboardSubTab(tab)}
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
                      {/* Advanced Stats Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                          { label: 'Revenue', value: `₹${totalSalesVal.toLocaleString()}`, trend: '+12.5%', icon: TrendingUp, color: 'text-ruby', bgColor: 'bg-ruby/10', data: [30, 45, 35, 50, 40, 60, 55] },
                          { label: 'Orders', value: totalOrdersVal, trend: '+5.2%', icon: ShoppingCart, color: 'text-blue-500', bgColor: 'bg-blue-50', data: [20, 30, 25, 40, 35, 45, 40] },
                          { label: 'Customers', value: totalCustomersVal, trend: '+8.1%', icon: UserPlus, color: 'text-green-500', bgColor: 'bg-green-50', data: [15, 25, 20, 35, 30, 40, 35] },
                          { label: 'Conversion', value: '3.2%', trend: '-1.4%', icon: Activity, color: 'text-purple-500', bgColor: 'bg-purple-50', data: [2.5, 3.0, 2.8, 3.5, 3.2, 3.8, 3.2] },
                        ].map((stat, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 group hover:shadow-xl hover:shadow-gray-200/50 transition-all"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className={`p-3 rounded-2xl ${stat.bgColor} ${stat.color}`}>
                                <stat.icon size={20} />
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-lg",
                                stat.trend.startsWith('+') ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                              )}>
                                {stat.trend}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-2xl font-black text-[#1A2C54]">{stat.value}</h3>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                            </div>
                            <div className="h-12 w-full mt-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stat.data.map((v, idx) => ({ v, idx }))}>
                                  <Line 
                                    type="monotone" 
                                    dataKey="v" 
                                    stroke={stat.color.includes('ruby') ? '#E11D48' : stat.color.includes('blue') ? '#3B82F6' : stat.color.includes('green') ? '#22C55E' : '#A855F7'} 
                                    strokeWidth={2} 
                                    dot={false} 
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Main Analytics Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Sales Performance */}
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
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.1)', padding: '16px' }}
                                />
                                <Area animationDuration={1500} type="monotone" dataKey="sales" stroke="#E11D48" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Order Status Distribution */}
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                          <h3 className="text-xl font-bold text-[#1A2C54]">Order Status</h3>
                          <div className="h-[250px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
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
                            </ResponsiveContainer>
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

                      {/* Bottom Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Category Performance */}
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

                        {/* Recent Orders */}
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
                                    <p className="text-sm font-black text-[#1A2C54]">₹{order.total?.toLocaleString()}</p>
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

                        {/* Push Notification Center */}
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

                          {/* Recently Sent Notifications */}
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

                  {dashboardSubTab === 'live' && (
                    <div className="space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 min-h-[400px] flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none" />
                        <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-[2rem] flex items-center justify-center animate-pulse relative z-10">
                          <Activity size={48} />
                        </div>
                        <div className="space-y-2 relative z-10">
                          <h3 className="text-2xl font-bold text-[#1A2C54]">Live Traffic Map</h3>
                          <p className="text-sm text-gray-400 max-w-md mx-auto">Real-time visualization of your store's global traffic and user sessions. This feature is being calibrated.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-8 w-full max-w-2xl pt-8 relative z-10">
                          <div className="space-y-1">
                            <p className="text-3xl font-black text-[#1A2C54]">{liveSessions.length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Users</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-3xl font-black text-[#1A2C54]">{liveSessions.filter(s => s.path === '/checkout').length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Checkout</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-3xl font-black text-[#1A2C54]">{liveSessions.filter(s => s.path === '/cart').length}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Cart</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                          <h3 className="text-lg font-bold text-[#1A2C54]">Recent Activity</h3>
                          <div className="space-y-4">
                            {liveSessions.slice(0, 5).map((session, i) => (
                              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                                    <User size={18} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[#1A2C54]">{session.city || 'Unknown City'}, {session.country || 'India'}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">{session.path || '/'}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Active Now</span>
                              </div>
                            ))}
                            {liveSessions.length === 0 && (
                              <div className="text-center py-8 text-gray-400 italic text-sm">No active sessions at the moment</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                          <h3 className="text-lg font-bold text-[#1A2C54]">Top Locations</h3>
                          <div className="space-y-4">
                            {topCountries.slice(0, 5).map((loc, i) => (
                              <div key={i} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                                  <span className="text-gray-400">{loc.name}</span>
                                  <span className="text-[#1A2C54]">{loc.count} users</span>
                                </div>
                                <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(loc.count / liveSessions.length) * 100}%` }}
                                    className="h-full bg-blue-500 rounded-full"
                                  />
                                </div>
                              </div>
                            ))}
                            {topCountries.length === 0 && (
                              <div className="text-center py-8 text-gray-400 italic text-sm">Waiting for traffic data...</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
                          <td className="py-4 px-8 text-gray-500">{p.category}</td>
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
                                  category: p.category,
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
              <div className="md:hidden space-y-4">
                {products.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 space-y-4">
                    <div className="flex items-center space-x-4">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-gray-100" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <div className="flex-grow">
                        <h3 className="font-bold text-gray-800">{p.name}</h3>
                        <p className="text-xs text-gray-400 uppercase tracking-widest">{p.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Price & Stock</p>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-gray-800">₹{p.price.toFixed(2)}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.stock < 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {p.stock} Left
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => {
                            setEditingProduct(p);
                            setFormData({
                              name: p.name,
                              description: p.description,
                              price: p.price,
                              category: p.category,
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
                              variants: p.variants || []
                            });
                            setShowAddProductPage(true);
                          }}
                          className="p-2 bg-gray-50 text-gray-400 hover:text-ruby rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 bg-gray-50 text-gray-400 hover:text-ruby rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'orders' && !viewingCustomer && (
            <div className="space-y-6">
              {/* Orders Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Orders', value: orders.length.toLocaleString(), trend: '+12% Today', icon: ShoppingBag, color: 'text-ruby', bgColor: 'bg-white' },
                  { label: 'Pending', value: orders.filter(o => o.status === 'Pending').length, trend: `+${orders.filter(o => o.status === 'Pending').length}`, icon: AlertTriangle, color: 'text-[#FACC15]', bgColor: 'bg-white' },
                  { label: 'Delivered', value: orders.filter(o => o.status === 'Delivered').length.toLocaleString(), trend: '+20 Today', icon: TrendingUp, color: 'text-[#22C55E]', bgColor: 'bg-white' },
                  { label: 'Cancelled', value: orders.filter(o => o.status === 'Cancelled').length, trend: "Restock Needed", icon: AlertTriangle, color: 'text-[#EF4444]', bgColor: 'bg-white' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${stat.label === 'Cancelled' ? 'bg-red-50 text-red-500' : stat.label === 'Pending' ? 'bg-yellow-50 text-yellow-500' : stat.label === 'Total Orders' ? 'bg-ruby/10 text-ruby' : 'bg-green-50 text-green-500'}`}>
                        <stat.icon size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                        <h3 className="text-xl font-black text-[#1A2C54]">{stat.value}</h3>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 pt-2 border-t border-gray-50">
                      {stat.label === 'Cancelled' ? (
                        <div className="flex items-center space-x-1 px-2 py-0.5 bg-red-50 rounded-md">
                          <AlertTriangle size={10} className="text-red-500" />
                          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Restock Needed</span>
                        </div>
                      ) : stat.label === 'Pending' ? (
                        <div className="flex items-center space-x-1 px-2 py-0.5 bg-yellow-50 rounded-md">
                          <span className="text-[10px] font-bold text-[#FACC15] uppercase tracking-wider">{stat.trend}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-50 rounded-md">
                          <TrendingUp size={10} className="text-[#22C55E]" />
                          <span className="text-[10px] font-bold text-[#22C55E] uppercase tracking-wider">{stat.trend}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filters Bar */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search customer or ID..." 
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ruby/20 font-medium"
                    />
                  </div>
                  <select 
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold text-gray-600 focus:outline-none"
                  >
                    <option>All Status</option>
                    <option>Pending</option>
                    <option>Processing</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                    <option>Cancelled</option>
                  </select>
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">From</label>
                    <input 
                      type="date" 
                      value={orderStartDate}
                      onChange={(e) => setOrderStartDate(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">To</label>
                    <input 
                      type="date" 
                      value={orderEndDate}
                      onChange={(e) => setOrderEndDate(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-50">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setOrderSearchTerm('');
                        setOrderStatusFilter('All Status');
                        setOrderStartDate('');
                        setOrderEndDate('');
                      }}
                      className="text-xs font-bold text-ruby hover:underline"
                    >
                      Reset Filters
                    </button>
                  </div>
                  <button 
                    onClick={handleAddOrder}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-2.5 bg-ruby text-white rounded-xl text-sm font-bold hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                  >
                    <Plus size={18} />
                    <span>Add Order</span>
                  </button>
                </div>
              </div>

              {/* Orders Table/Cards */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                        <th className="py-4 px-6 w-10">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-ruby focus:ring-ruby"
                            onChange={(e) => {
                              if (e.target.checked) setSelectedOrders(orders.map(o => o.id));
                              else setSelectedOrders([]);
                            }}
                          />
                        </th>
                        <th className="py-4 px-6">#Order ID</th>
                        <th className="py-4 px-6">Customer</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6">Shipping</th>
                        <th className="py-4 px-6">Total</th>
                        <th className="py-4 px-6">Date</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredOrders.map((order, i) => (
                        <tr key={order.id || i} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                          <td className="py-4 px-6">
                            <input 
                              type="checkbox" 
                              checked={selectedOrders.includes(order.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                                else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                              }}
                              className="rounded border-gray-300 text-ruby focus:ring-ruby" 
                            />
                          </td>
                          <td className="py-4 px-6 font-bold text-[#1A2C54]">
                            {order.orderId || `#${order.id?.slice(-6) || 'N/A'}`}
                          </td>
                          <td className="py-4 px-6">
                            <button 
                              onClick={() => setViewingCustomer(order)}
                              className="flex flex-col text-left hover:text-[#3B82F6] transition-colors"
                            >
                              <span className="font-bold text-[#1A2C54] group-hover:text-[#3B82F6]">{order.address?.name || order.customerName || order.customer || 'Guest User'}</span>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-medium lowercase">{order.address?.email || order.email || 'No Email'}</span>
                                <span className="text-[10px] text-ruby font-bold">{order.address?.number || order.address?.phoneNumber || 'No Phone'}</span>
                              </div>
                            </button>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-md text-[11px] font-bold ${statusColors[order.status || 'Pending']}`}>
                              {order.status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              {order.shippingMethod || 'Standard'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-black text-[#1A2C54]">
                            {typeof order.amount === 'string' ? order.amount : `₹${(order.total || 0).toLocaleString()}`}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#1A2C54]">{new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(order.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right relative">
                            <div className="flex items-center justify-end">
                              <div className="relative">
                                <button 
                                  onClick={() => setActiveOrderMenu(activeOrderMenu === order.id ? null : order.id)}
                                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                                >
                                  <MoreVertical size={18} />
                                </button>
                                <AnimatePresence>
                                  {activeOrderMenu === order.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setActiveOrderMenu(null)} />
                                      <motion.div 
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 z-20 py-2 overflow-hidden"
                                      >
                                        {[
                                          { label: 'View', icon: Maximize2, onClick: () => setViewingCustomer(order) },
                                          { label: 'Invoice', icon: ShoppingBag, onClick: () => generateInvoice(order, settings) },
                                          { 
                                            label: 'Update Status', 
                                            icon: Edit2, 
                                            onClick: () => {
                                              const nextStatus: Record<string, string> = {
                                                'Pending': 'Processing',
                                                'Processing': 'Shipped',
                                                'Shipped': 'Delivered',
                                                'Delivered': 'Pending'
                                              };
                                              handleUpdateOrderStatus(order.id, nextStatus[order.status || 'Pending'] || 'Pending');
                                            }
                                          },
                                          { label: 'Delete', icon: Trash2, danger: true, onClick: () => handleDeleteOrder(order.id) },
                                        ].map((action, idx) => (
                                          <button 
                                            key={idx}
                                            onClick={() => {
                                              if (action.onClick) action.onClick();
                                              setActiveOrderMenu(null);
                                            }}
                                            className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-bold transition-colors ${action.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}
                                          >
                                            <action.icon size={14} />
                                            <span>{action.label}</span>
                                          </button>
                                        ))}
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <div className="p-20 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                      No orders found
                    </div>
                  ) : (
                    filteredOrders.map((order, i) => (
                      <div key={order.id || i} className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input 
                              type="checkbox" 
                              checked={selectedOrders.includes(order.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                                else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                              }}
                              className="rounded border-gray-300 text-ruby focus:ring-ruby" 
                            />
                            <span className="font-bold text-[#1A2C54]">
                              {order.orderId || `#${order.id?.slice(-6) || 'N/A'}`}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-md text-[10px] font-bold ${statusColors[order.status || 'Pending']}`}>
                            {order.status || 'Pending'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-[#1A2C54]">{order.address?.name || order.customerName || order.customer || 'Guest User'}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{order.address?.email || order.email || 'No Email'}</p>
                          </div>
                          <p className="font-black text-[#1A2C54]">
                            ₹{(order.total || 0).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {order.createdAt ? (
                              <>
                                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </>
                            ) : 'N/A'}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => setViewingCustomer(order)}
                              className="p-2 bg-gray-50 text-gray-600 rounded-lg"
                            >
                              <Maximize2 size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                const nextStatus: Record<string, string> = {
                                  'Pending': 'Processing',
                                  'Processing': 'Shipped',
                                  'Shipped': 'Delivered',
                                  'Delivered': 'Pending'
                                };
                                handleUpdateOrderStatus(order.id, nextStatus[order.status || 'Pending'] || 'Pending');
                              }}
                              className="p-2 bg-gray-50 text-ruby rounded-lg"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-2 bg-red-50 text-red-500 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

                {/* Pagination */}
                <div className="p-6 border-t border-gray-50 flex flex-col md:flex-row items-center justify-end gap-4 bg-gray-50/30">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                      <button className="px-4 py-2 hover:bg-gray-50 text-gray-600 border-r border-gray-100 transition-colors flex items-center space-x-2 text-xs font-bold">
                        <ChevronRight size={16} className="rotate-180" />
                        <span>Previous</span>
                      </button>
                      <button className="px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors flex items-center space-x-2 text-xs font-bold">
                        <span>Next</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Customer Detail View */}
          {viewingCustomer && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button 
                  onClick={() => setViewingCustomer(null)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-[#1A2C54] transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" />
                  <span className="text-sm font-bold uppercase tracking-widest">Back to Orders</span>
                </button>
                <div className="flex space-x-2 w-full sm:w-auto">
                  <button 
                    onClick={() => generateInvoice(viewingCustomer, settings)}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <ShoppingBag size={14} />
                    Invoice
                  </button>
                  <button 
                    onClick={() => generateShippingLabel(viewingCustomer, settings)}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-[#1A2C54] text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-[#0A1A34] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                  >
                    <Truck size={14} />
                    Shipping Label
                  </button>
                  <button 
                    onClick={() => {
                      const customerId = viewingCustomer.userId || viewingCustomer.customerEmail || viewingCustomer.email;
                      const existingChat = chats.find(c => c.id === customerId || c.userId === customerId);
                      if (existingChat) {
                        setSelectedChat(existingChat);
                        setActiveTab('chats');
                      } else {
                        toast.error("No active chat found for this customer.");
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={14} />
                    Message
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-3xl bg-gray-50 border-4 border-white shadow-xl overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer}`} alt="Avatar" />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-lg flex items-center justify-center">
                        <CheckCheck size={12} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-[#1A2C54]">{viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Verified Customer</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-ruby/5 rounded-2xl border border-ruby/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-ruby/10 flex items-center justify-center">
                          <Database size={12} className="text-ruby" />
                        </div>
                        <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">Order ID</span>
                      </div>
                      <span className="text-xs font-black text-ruby">#{viewingCustomer.orderId || viewingCustomer.id.substring(0, 8)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-ruby/10 flex items-center justify-center">
                          <Calendar size={12} className="text-ruby" />
                        </div>
                        <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">Date</span>
                      </div>
                      <span className="text-xs font-black text-ruby">{new Date(viewingCustomer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <Mail size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</span>
                      </div>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.address?.email || viewingCustomer.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-green-50 group-hover:text-green-500 transition-colors">
                          <Phone size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</span>
                      </div>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.address?.number || viewingCustomer.shippingAddress?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-purple-50 group-hover:text-purple-500 transition-colors">
                          <Shield size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment</span>
                      </div>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                {/* Address & Order Details */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Shipping Address</h4>
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Truck size={48} className="text-[#1A2C54]" />
                      </div>
                      <p className="text-sm font-bold text-[#1A2C54] leading-relaxed relative z-10">
                        {viewingCustomer.address ? (
                          <>
                            <span className="text-ruby text-[10px] font-black uppercase tracking-widest block mb-1">Recipient Name</span>
                            <span className="text-lg">{viewingCustomer.address.name}</span><br />
                            <span className="text-ruby text-[10px] font-black uppercase tracking-widest block mt-3 mb-1">Full Address</span>
                            {viewingCustomer.address.address},<br />
                            {viewingCustomer.address.city}, {viewingCustomer.address.state} - {viewingCustomer.address.pincode}<br />
                            India
                          </>
                        ) : viewingCustomer.shippingAddress ? (
                          <>
                            <span className="text-ruby text-[10px] font-black uppercase tracking-widest block mb-1">Recipient Name</span>
                            <span className="text-lg">{viewingCustomer.shippingAddress.fullName}</span><br />
                            <span className="text-ruby text-[10px] font-black uppercase tracking-widest block mt-3 mb-1">Full Address</span>
                            {viewingCustomer.shippingAddress.address},<br />
                            {viewingCustomer.shippingAddress.city}, {viewingCustomer.shippingAddress.zipCode}<br />
                            {viewingCustomer.shippingAddress.country}
                          </>
                        ) : (
                          'No address provided'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Order Items</h4>
                      <div className="relative w-full sm:w-48">
                        <select
                          value={viewingCustomer.status}
                          onChange={(e) => handleUpdateOrderStatus(viewingCustomer.id, e.target.value)}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 transition-all appearance-none cursor-pointer"
                        >
                          {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {(viewingCustomer.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100 gap-4 hover:border-ruby/20 transition-all group">
                          <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ShoppingBag size={24} className="text-[#3B82F6]" />
                              )}
                            </div>
                            <div>
                              <p className="text-base font-black text-[#1A2C54]">{item.name}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-white border border-gray-100 rounded-md text-[9px] font-bold text-gray-500 uppercase tracking-widest">Qty: {item.quantity}</span>
                                <span className="px-2 py-0.5 bg-white border border-gray-100 rounded-md text-[9px] font-bold text-gray-500 uppercase tracking-widest">Size: {item.selectedSize || 'N/A'}</span>
                                <span className="px-2 py-0.5 bg-white border border-gray-100 rounded-md text-[9px] font-bold text-gray-500 uppercase tracking-widest">₹{item.price.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Subtotal</p>
                            <p className="text-xl font-black text-[#1A2C54]">
                              ₹{(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-gray-50 flex justify-between items-center">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Order Total</p>
                      <p className="text-2xl font-black text-ruby">₹{(viewingCustomer.total || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'live' && (
            <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] bg-[#050B18] rounded-3xl md:rounded-[3rem] overflow-hidden relative border border-white/5 shadow-2xl flex flex-col">
              {/* Mission Control Header */}
              <div className="absolute top-4 md:top-8 left-4 md:left-8 right-4 md:right-8 z-20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 pointer-events-none">
                <div className="space-y-1 md:space-y-2 pointer-events-auto">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-ruby animate-pulse shadow-[0_0_15px_rgba(225,29,72,0.8)]"></div>
                    <h2 className="text-lg md:text-2xl font-black text-white tracking-tighter uppercase">Mission Control</h2>
                  </div>
                  <p className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Global Real-time Traffic</p>
                </div>

                <div className="flex items-center gap-3 md:gap-4 pointer-events-auto w-full md:w-auto justify-between md:justify-end">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-3 md:p-4 rounded-2xl md:rounded-3xl flex items-center gap-3 md:gap-4 shadow-2xl">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-ruby/20 flex items-center justify-center text-ruby">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-[7px] md:text-[8px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">Live Visitors</p>
                      <p className="text-sm md:text-xl font-black text-white leading-none">{liveSessions.length}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="p-2 md:p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl md:rounded-2xl border border-white/10 transition-all backdrop-blur-md"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Top States Sidebar - Hidden on Mobile */}
              <div className="absolute top-32 left-8 z-20 w-64 hidden lg:block pointer-events-none">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] space-y-6 pointer-events-auto shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Top Traffic States</h3>
                      <p className="text-[8px] font-bold text-ruby uppercase tracking-widest">Live Breakdown</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-ruby/20 flex items-center justify-center">
                      <MapPin size={14} className="text-ruby" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {topStates.slice(0, 5).length > 0 ? (
                      topStates.slice(0, 5).map((state, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-white/80">{state.name}</span>
                            <span className="text-ruby">{state.count}</span>
                          </div>
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(state.count / liveSessions.length) * 100}%` }}
                              className="h-full bg-ruby"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest text-center py-4">No state data yet</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Globe Container */}
              <div ref={globeContainerRef} className="flex-grow w-full relative cursor-move bg-[#050B18]">
                <ReactGlobe
                  width={globeSize.width}
                  height={globeSize.height}
                  globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                  bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                  backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                  pointsData={[
                    ...liveSessions.filter(s => s.lat && s.lng).map(s => ({
                      lat: s.lat,
                      lng: s.lng,
                      size: 0.25,
                      color: '#E11D48',
                      label: `${s.city}, ${s.region}, ${s.country}`
                    })),
                    { lat: 19.0760, lng: 72.8777, size: 0.4, color: '#ffffff', label: 'THE RUBY HQ (Mumbai)' }
                  ]}
                  pointAltitude={0.02}
                  pointColor="color"
                  pointRadius={0.8}
                  pointsMerge={false}
                  pointLabel="label"
                  labelsData={[
                    ...liveSessions.filter(s => s.lat && s.lng).map(s => ({
                      lat: s.lat,
                      lng: s.lng,
                      text: s.city || s.region,
                      color: '#ffffff',
                      size: 0.5
                    })),
                    { lat: 19.0760, lng: 72.8777, text: 'RUBY HQ', color: '#E11D48', size: 1 }
                  ]}
                  labelColor="color"
                  labelSize="size"
                  labelDotRadius={0.4}
                  labelAltitude={0.03}
                  atmosphereColor="#3B82F6"
                  atmosphereAltitude={0.15}
                  arcsData={liveSessions.filter(s => s.lat && s.lng).map(s => ({
                    startLat: s.lat,
                    startLng: s.lng,
                    endLat: 19.0760, // Mumbai
                    endLng: 72.8777,
                    color: ['#E11D48', '#ffffff']
                  }))}
                  arcColor="color"
                  arcDashLength={0.4}
                  arcDashGap={4}
                  arcDashAnimateTime={1500}
                  arcStroke={0.5}
                  ringsData={liveSessions.filter(s => s.lat && s.lng).map(s => ({
                    lat: s.lat,
                    lng: s.lng
                  }))}
                  ringColor={() => '#E11D48'}
                  ringMaxRadius={2.5}
                  ringPropagationSpeed={3}
                  ringRepeatPeriod={800}
                />
              </div>

              {/* Stats Box - Separate from Map */}
              <div className="bg-[#0A1224] border-t border-white/10 p-4 md:p-6 overflow-hidden flex flex-col gap-3 md:gap-4 shrink-0">
                {/* Row 1: Global Traffic */}
                <div className="relative overflow-hidden">
                  <div className="flex items-center gap-8 md:gap-12 animate-marquee whitespace-nowrap">
                    <div className="flex items-center gap-3 shrink-0">
                      <Globe size={14} className="text-white animate-pulse" />
                      <span className="text-[8px] md:text-[11px] font-black text-white uppercase tracking-[0.2em]">Global Traffic:</span>
                    </div>
                    {(topCountries.length > 0 ? topCountries.concat(topCountries) : [{name: 'Global', count: 0}]).map((country, i) => (
                      <div key={`country-${i}`} className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                        <span className="text-[8px] md:text-[10px] font-bold text-white/60 uppercase tracking-widest">{country.name}</span>
                        <span className="text-[8px] md:text-[10px] font-black text-white">{country.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2: Regional Traffic - Hidden or simplified on mobile if requested, but user said "alag line me" */}
                <div className="relative overflow-hidden">
                  <div className="flex items-center gap-8 md:gap-12 animate-marquee-reverse whitespace-nowrap">
                    <div className="flex items-center gap-3 shrink-0">
                      <MapPin size={14} className="text-ruby animate-pulse" />
                      <span className="text-[8px] md:text-[11px] font-black text-ruby uppercase tracking-[0.2em]">Regional Traffic:</span>
                    </div>
                    {(topStates.length > 0 ? topStates.concat(topStates) : [{name: 'Regional', count: 0}]).map((state, i) => (
                      <div key={`state-${i}`} className="flex items-center gap-2 px-3 py-1 bg-ruby/10 rounded-full border border-ruby/10">
                        <span className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest">{state.name}</span>
                        <span className="text-[8px] md:text-[10px] font-black text-ruby">{state.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                @keyframes marquee-reverse {
                  0% { transform: translateX(-50%); }
                  100% { transform: translateX(0); }
                }
                .animate-marquee {
                  display: inline-flex;
                  animation: marquee 40s linear infinite;
                }
                .animate-marquee-reverse {
                  display: inline-flex;
                  animation: marquee-reverse 50s linear infinite;
                }
                .animate-marquee:hover, .animate-marquee-reverse:hover {
                  animation-play-state: paused;
                }
              `}</style>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map(cat => (
                  <div key={cat.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col space-y-4 group hover:border-ruby/30 transition-all">
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
                      <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A2C54]">{cat.name}</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {colors.map(color => (
                  <div key={color.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 group hover:border-ruby/30 transition-all">
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
              <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                {sizes.map(size => (
                  <div key={size.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-2 group hover:border-ruby/30 transition-all">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {coupons.map(coupon => (
                  <div key={coupon.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 group hover:border-ruby/30 transition-all relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div className="px-3 py-1 bg-ruby/10 text-ruby rounded-lg text-xs font-black tracking-widest">
                        {coupon.code}
                      </div>
                      <button onClick={() => handleDeleteCoupon(coupon.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-[#1A2C54]">
                        {coupon.type === 'percentage' ? `${coupon.discount}%` : `₹${coupon.discount}`} OFF
                      </h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                        {coupon.type === 'percentage' ? 'Percentage Discount' : 'Fixed Amount Discount'}
                      </p>
                    </div>
                    <div className="flex flex-col space-y-2 pt-4 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${coupon.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{coupon.active ? 'Active' : 'Inactive'}</span>
                        </div>
                        {coupon.expiryDate && (
                          <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">
                            Exp: {new Date(coupon.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                  className="space-y-8"
                >
                  <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-ruby transition-colors group"
                  >
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-ruby/10 transition-all">
                      <ChevronRight size={18} className="rotate-180" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Back to List</span>
                  </button>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Profile Summary */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="relative">
                          <div className="w-32 h-32 rounded-[2rem] bg-gray-50 border-4 border-white shadow-2xl overflow-hidden">
                            <img 
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedCustomer.displayName || selectedCustomer.email}`} 
                              alt="Avatar" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 border-4 border-white rounded-2xl shadow-lg flex items-center justify-center">
                            <CheckCheck size={16} className="text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-[#1A2C54]">{selectedCustomer.displayName || 'Anonymous'}</h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{selectedCustomer.role || 'User'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-[#1A2C54]">{selectedCustomer.email}</p>
                            {selectedCustomer.isVerified ? (
                              <CheckCheck size={14} className="text-green-500" />
                            ) : (
                              <AlertTriangle size={14} className="text-yellow-500" />
                            )}
                          </div>
                        </div>
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone Number</p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-[#1A2C54]">{selectedCustomer.phoneNumber || 'Not provided'}</p>
                            {selectedCustomer.phoneVerified && <CheckCheck size={14} className="text-green-500" />}
                          </div>
                        </div>
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member Since</p>
                          <p className="text-sm font-bold text-[#1A2C54]">{new Date(selectedCustomer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <button 
                          onClick={() => handleUpdateUserRole(selectedCustomer.id, selectedCustomer.role || 'user')}
                          className="w-full py-4 bg-[#1A2C54] text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-blue-900/20"
                        >
                          Change Role
                        </button>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => updateLoyaltyPoints(selectedCustomer.id, 100)}
                            className="flex-1 py-4 bg-ruby/10 text-ruby rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby hover:text-white transition-all"
                          >
                            Gift Points
                          </button>
                          <button 
                            onClick={() => {
                              setCustomerToDelete(selectedCustomer);
                              setIsCustomerDeleteModalOpen(true);
                            }}
                            className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                          >
                            Delete User
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Analytics */}
                    <div className="lg:col-span-2 space-y-8">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                            label: 'Most Ordered', 
                            value: getMostOrderedProduct(selectedCustomer.id, selectedCustomer.email)?.name || 'None', 
                            icon: Package, 
                            color: 'text-purple-600', 
                            bgColor: 'bg-purple-50' 
                          },
                          { 
                            label: 'Loyalty Points', 
                            value: selectedCustomer.loyaltyPoints || 0, 
                            icon: Star, 
                            color: 'text-yellow-600', 
                            bgColor: 'bg-yellow-50' 
                          },
                        ].map((stat, i) => (
                          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-3">
                            <div className={`w-10 h-10 rounded-2xl ${stat.bgColor} ${stat.color} flex items-center justify-center`}>
                              <stat.icon size={20} />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                              <p className="text-xs font-black text-[#1A2C54] truncate">{stat.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Saved Addresses */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest mb-6 flex items-center gap-2">
                            <MapPin size={18} className="text-ruby" />
                            Saved Addresses
                          </h4>
                          <div className="space-y-4">
                            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                              selectedCustomer.addresses.map((addr: any, i: number) => (
                                <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">{addr.type || 'Address'}</span>
                                    {addr.isDefault && <CheckCheck size={12} className="text-green-500" />}
                                  </div>
                                  <p className="text-xs font-bold text-[#1A2C54]">{addr.fullName}</p>
                                  <p className="text-[10px] text-gray-400 leading-relaxed">
                                    {addr.addressLine1}, {addr.city}, {addr.state} - {addr.pincode}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center space-y-2">
                                <MapPin size={24} className="text-gray-200 mx-auto" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No addresses saved</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Order History */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                          <h4 className="text-sm font-black text-[#1A2C54] uppercase tracking-widest mb-6 flex items-center gap-2">
                            <History size={18} className="text-ruby" />
                            Order History
                          </h4>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).length > 0 ? (
                              orders.filter(o => o.userId === selectedCustomer.id || o.email === selectedCustomer.email).map((order, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-ruby/20 transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-ruby font-black text-[10px]">
                                      #{order.orderId?.slice(-4) || 'ORD'}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-[#1A2C54]">₹{order.total?.toLocaleString()}</p>
                                      <p className="text-[9px] font-medium text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${statusColors[order.status || 'Pending']}`}>
                                    {order.status || 'Pending'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center space-y-2">
                                <ShoppingBag size={24} className="text-gray-200 mx-auto" />
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No orders found</p>
                              </div>
                            )}
                          </div>
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
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${customer.displayName || customer.email}`} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
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
                <button onClick={() => setIsBannerModalOpen(true)} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
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
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="p-2 bg-red-500/80 text-white rounded-xl backdrop-blur-md border border-white/20 hover:bg-red-600 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {banner.link && (
                        <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-gray-600 truncate max-w-[200px]">
                          Link: {banner.link}
                        </div>
                      )}
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
                  <h2 className="text-3xl font-black text-[#1A2C54] tracking-tight">Business Analytics</h2>
                  <p className="text-sm text-gray-400 font-medium">Deep dive into your store's performance metrics</p>
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
                    <ResponsiveContainer width="100%" height="100%">
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
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <h3 className="text-lg font-black text-[#1A2C54] uppercase tracking-widest">Order Status</h3>
                  <div className="h-[250px] relative">
                    <ResponsiveContainer width="100%" height="100%">
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
                    </ResponsiveContainer>
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
                        className="p-4 md:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start space-x-3 md:space-x-4 w-full">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-ruby/10 text-ruby rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0">
                            <ShoppingBag size={20} className="md:w-6 md:h-6" />
                          </div>
                          <div className="space-y-1 min-w-0 flex-grow">
                            <h4 className="text-xs md:text-sm font-bold text-[#1A2C54] truncate">New Order Received!</h4>
                            <p className="text-[10px] md:text-xs text-gray-500 leading-relaxed">
                              Order <span className="font-bold text-ruby">#{notif.orderId || notif.id?.slice(-6)}</span> was placed by <span className="font-bold text-[#1A2C54]">{notif.address?.name || 'Guest'}</span>.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[9px] md:text-[10px] font-bold text-ruby uppercase tracking-widest">₹{(notif.total || 0).toLocaleString()}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date(notif.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setActiveTab('orders');
                            setViewingCustomer(notif);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 bg-gray-50 border border-gray-100 text-ruby rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby hover:text-white transition-all sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          View Order
                        </button>
                      </div>
                    ))}
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
                              {chat.lastMessageAt ? new Date(chat.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
                                {msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
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
                          {cart.updatedAt ? new Date(cart.updatedAt.toDate()).toLocaleDateString() : 'N/A'}
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
                                {cart.updatedAt ? new Date(cart.updatedAt.toDate()).toLocaleString() : 'N/A'}
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Engagement Heatmap */}
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
                    <ResponsiveContainer width="100%" height="100%">
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
                    </ResponsiveContainer>
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
                <button 
                  onClick={handleSaveSettings}
                  className="w-full md:w-auto bg-ruby text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all shadow-lg shadow-ruby/20 active:scale-95"
                >
                  Save Changes
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {/* Settings Content */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[400px]">
                  <AnimatePresence mode="wait">
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
                            <h4 className="text-xs font-bold text-[#1A2C54] uppercase tracking-widest mb-4">OneSignal Push Settings</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">OneSignal App ID</label>
                                <input 
                                  type="text" 
                                  placeholder="Enter OneSignal App ID"
                                  value={settings.oneSignalAppId || ''}
                                  onChange={(e) => setSettings({...settings, oneSignalAppId: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">OneSignal REST API Key</label>
                                <input 
                                  type="password" 
                                  placeholder="Enter REST API Key"
                                  value={settings.oneSignalRestApiKey || ''}
                                  onChange={(e) => setSettings({...settings, oneSignalRestApiKey: e.target.value})}
                                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed italic">
                              Get these from OneSignal Dashboard &gt; Settings &gt; Keys & IDs.
                            </p>
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
                          <Mail size={20} className="mr-2 text-ruby" /> Email Service (Resend)
                        </h3>
                        <div className="space-y-4">
                          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                            <h4 className="text-[11px] font-bold text-blue-700 uppercase tracking-widest flex items-center">
                              <Info size={14} className="mr-2" /> Important Instructions
                            </h4>
                            <ul className="text-[10px] text-blue-600 space-y-1 font-medium leading-relaxed">
                              <li>• By default, emails are sent using <b>onboarding@resend.dev</b>.</li>
                              <li>• <b>Note:</b> Resend only allows sending to your own account email when using the default sender.</li>
                              <li>• To send emails to customers, you <b>must</b> verify your domain on <a href="https://resend.com/domains" target="_blank" className="underline font-bold">Resend.com</a>.</li>
                              <li>• <a href="https://resend.com/docs/dashboard/domains/introduction" target="_blank" className="text-blue-800 underline font-bold">Click here for Step-by-Step Domain Setup Guide</a></li>
                              <li>• Once verified, update the "From Email" below with your verified address.</li>
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
                                placeholder="The Ruby <onboarding@resend.dev>"
                                value={settings.fromEmail || ''}
                                onChange={(e) => setSettings({...settings, fromEmail: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                              />
                            </div>
                          </div>
                          <div className="pt-4">
                            <button 
                              onClick={handleTestEmail}
                              disabled={isTestingEmail}
                              className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                            >
                              <Mail size={14} />
                              <span>{isTestingEmail ? 'Sending...' : 'Send Test Email'}</span>
                            </button>
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

                          <div className="mt-8 p-6 bg-amber-50 border border-amber-100 rounded-2xl space-y-4">
                            <h4 className="text-sm font-bold text-amber-800 flex items-center">
                              <AlertTriangle size={18} className="mr-2" /> Custom Domain Login Issue?
                            </h4>
                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                              If you are using a custom domain (like <b>rubyfashion.shop</b>) and login is failing, you must add your domain to the <b>Authorized Domains</b> list in your Firebase Console.
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
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'products' && activeTab !== 'orders' && activeTab !== 'category' && activeTab !== 'colour' && activeTab !== 'size' && activeTab !== 'coupon' && activeTab !== 'customer' && activeTab !== 'rocket' && activeTab !== 'stats' && activeTab !== 'settings' && activeTab !== 'live' && activeTab !== 'notifications' && activeTab !== 'chats' && activeTab !== 'reviews' && activeTab !== 'abandoned' && activeTab !== 'insights' && !viewingCustomer && (
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
                <h2 className="text-xl font-bold text-gray-800">Add Category</h2>
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
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Click to upload image</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCategoryForm({...categoryForm, image: reader.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95">
                  Save Category
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
              className="relative bg-white w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Add Coupon</h2>
                <button onClick={() => setIsCouponModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveCoupon} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Coupon Code</label>
                  <input 
                    type="text" 
                    required
                    value={couponForm.code || ''}
                    onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-black tracking-widest"
                    placeholder="e.g. SUMMER50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discount Type</label>
                    <select 
                      value={couponForm.type || 'percentage'}
                      onChange={e => setCouponForm({...couponForm, type: e.target.value as 'percentage' | 'fixed'})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Price (₹)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Value</label>
                    <input 
                      type="number" 
                      required
                      value={couponForm.discount || ''}
                      onChange={e => setCouponForm({...couponForm, discount: parseInt(e.target.value) || 0})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                      placeholder={couponForm.type === 'percentage' ? '50' : '500'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Expiry Date</label>
                  <input 
                    type="date" 
                    required
                    value={couponForm.expiryDate || ''}
                    onChange={e => setCouponForm({...couponForm, expiryDate: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all active:scale-95">
                  Save Coupon
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
                <h2 className="text-xl font-bold text-gray-800">Add New Banner</h2>
                <button onClick={() => setIsBannerModalOpen(false)} className="p-2 hover:text-ruby transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddBanner} className="space-y-6">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Target Link (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. /shop?category=Men"
                    value={bannerForm.link || ''}
                    onChange={e => setBannerForm({...bannerForm, link: e.target.value})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-ruby text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-ruby/20 hover:bg-ruby-dark transition-all">
                  Add Banner
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
    </div>
  );
}
