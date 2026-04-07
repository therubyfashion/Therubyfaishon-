import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Product, Category } from '../types';
import { toast } from 'sonner';
import { 
  LayoutDashboard, Package, Tags, ShoppingBag, Palette, Maximize2, 
  Ticket, Users, Settings, LogOut, Search, Bell, Menu, X, 
  TrendingUp, ShoppingCart, UserPlus, AlertTriangle, ChevronRight, ChevronLeft,
  MoreVertical, Edit2, Trash2, Plus, Image as ImageIcon, Database, BarChart3,
  Home, ArrowLeft, Camera, ChevronDown, ChevronUp, Bold, Heading, Globe, Truck,
  TrendingDown, Shield, Volume2, Mail, Smartphone, Calendar, MessageCircle, Phone, Video, CheckCheck, Star
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
import { GoogleGenAI } from "@google/genai";

import { generateInvoice } from '../utils/invoiceGenerator';

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

type Tab = 'home' | 'dashboard' | 'products' | 'category' | 'orders' | 'colour' | 'size' | 'coupon' | 'customer' | 'settings' | 'rocket' | 'stats' | 'notifications' | 'chats' | 'reviews' | 'abandoned' | 'insights';

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
    <div className="space-y-8 pb-20">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            type="button"
            onClick={onCancel}
            className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-ruby hover:shadow-md transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[#1A2C54]">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Store Inventory / {isEditing ? 'Edit' : 'New'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-bold text-[#1A2C54]">Admin User</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Store Manager</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-ruby/10 flex items-center justify-center text-ruby font-bold shadow-sm">
            A
          </div>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-8">
        {/* Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Media */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Product Media</h3>
                  <p className="text-[10px] font-bold text-gray-400 mt-1">Select images from your gallery</p>
                </div>
                <span className="text-[10px] font-bold text-gray-400">{formData.images.filter((img: string) => img).length}/9 Images</span>
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
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Premium Cotton T-Shirt"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border-b border-gray-100 py-3 text-lg font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent placeholder:text-gray-200"
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
                    value={formData.category}
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
                      value={formData.stockStatus}
                      onChange={e => setFormData({...formData, stockStatus: e.target.value})}
                      className="w-full border-b border-gray-100 py-3 text-sm font-bold text-[#1A2C54] focus:outline-none focus:border-ruby transition-colors bg-transparent appearance-none"
                    >
                      <option value="In Stock">In Stock</option>
                      <option value="Out of Stock">Out of Stock</option>
                      <option value="On Backorder">On Backorder</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A2C54] uppercase tracking-widest">Product Description</h3>
            <div className="flex bg-gray-50 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setActiveDescriptionTab('edit')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeDescriptionTab === 'edit' ? 'bg-white text-ruby shadow-sm' : 'text-gray-400'}`}
              >
                Edit
              </button>
              <button 
                type="button"
                onClick={() => setActiveDescriptionTab('preview')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeDescriptionTab === 'preview' ? 'bg-white text-ruby shadow-sm' : 'text-gray-400'}`}
              >
                Preview
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-50">
              <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"><Bold size={16} /></button>
              <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"><Heading size={16} /></button>
              <div className="w-px h-4 bg-gray-100 mx-2"></div>
              <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-ruby transition-colors"><Maximize2 size={16} /></button>
            </div>
            
            {activeDescriptionTab === 'edit' ? (
              <textarea 
                required
                placeholder="Write a detailed description of your product..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full min-h-[200px] py-4 text-sm font-medium text-gray-600 focus:outline-none bg-transparent resize-none leading-relaxed"
              />
            ) : (
              <div className="min-h-[200px] py-4 text-sm font-medium text-gray-600 leading-relaxed">
                {formData.description || 'No description provided.'}
              </div>
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
                    value={newVariant.size}
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
                    value={newVariant.color}
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
                  value={formData.seoTitle}
                  onChange={e => setFormData({...formData, seoTitle: e.target.value})}
                  placeholder="Product SEO Title" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meta Description</label>
                <textarea 
                  value={formData.seoDescription}
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
                  value={formData.weight}
                  onChange={e => setFormData({...formData, weight: e.target.value})}
                  placeholder="0.5" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Dimensions (L x W x H)</label>
                <input 
                  type="text" 
                  value={formData.dimensions}
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
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

  const [categoryForm, setCategoryForm] = useState({ name: '', image: '' });
  const [colorForm, setColorForm] = useState({ name: '', hex: '#000000' });
  const [sizeForm, setSizeForm] = useState({ name: '' });
  const [couponForm, setCouponForm] = useState({ code: '', discount: 0, expiryDate: '', type: 'percentage' as 'percentage' | 'fixed' });

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const totalRevenue = orders.reduce((acc, order) => acc + (order.total || 0), 0);
  
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
    supportEmail: 'support@theruby.com',
    currency: 'INR (₹)',
    googleSheetUrl: '',
    googleSheetApiKey: '',
    notificationSound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    favicon: '',
    siteTitle: 'The Ruby | Premium Clothing',
    metaDescription: 'Discover the latest trends in fashion at The Ruby.',
    resendApiKey: '',
    footerSocials: {
      instagram: '',
      x: '',
      facebook: '',
      youtube: ''
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
    });

    // Real-time chats listener
    const chatsQuery = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'));
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeChats();
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

  const handleSaveSettings = async () => {
    try {
      // Save to Firestore
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (settingsSnap.empty) {
        await addDoc(collection(db, 'settings'), settings);
      } else {
        await updateDoc(doc(db, 'settings', settingsSnap.docs[0].id), settings);
      }
      
      // Sync Resend API Key with server
      if (settings.resendApiKey) {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resendApiKey: settings.resendApiKey })
        });
      }
      
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
          subject: 'Test Email from The Ruby',
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #E11D48;">The Ruby Test</h2>
              <p>This is a test email to verify your Resend API configuration.</p>
              <p>If you received this, your email integration is working perfectly!</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #666;">The Ruby Admin Panel</p>
            </div>
          `
        })
      });
      
      if (response.ok) {
        toast.success(`Test email sent to ${settings.supportEmail}`);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send test email');
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
      const [productsSnap, ordersSnap, usersSnap, categoriesSnap, colorsSnap, sizesSnap, couponsSnap, bannersSnap, settingsSnap, reviewsSnap, cartsSnap] = await Promise.all([
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
        getDocs(query(collection(db, 'carts'), orderBy('updatedAt', 'desc'))).catch(e => handleFirestoreError(e, OperationType.GET, 'carts'))
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
    await auth.signOut();
    navigate('/login');
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
        setShowAddProductPage(false);
        setEditingProduct(null);
      } else {
        await addDoc(collection(db, 'products'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        toast.success("Product added successfully");
        setShowAddProductPage(false);
        setEditingProduct(null);
        setFormData({ 
          name: '', 
          description: '', 
          price: 0, 
          category: 'Women', 
          sizes: ['S', 'M', 'L', 'XL'], 
          images: [''], 
          stock: 10,
          comparePrice: 0,
          stockStatus: 'In Stock',
          seoTitle: '',
          seoDescription: '',
          weight: '',
          dimensions: '',
          variants: []
        });
      }
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

  const generateAIDescription = async (productName: string) => {
    if (!productName) {
      toast.error("Please enter a product name first");
      return;
    }
    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a professional, catchy, and SEO-friendly product description for a product named "${productName}". Keep it under 150 words.`,
      });
      if (response.text) {
        setFormData(prev => ({ ...prev, description: response.text || '' }));
        toast.success("Description generated!");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate description");
    } finally {
      setIsGeneratingAI(false);
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

  const handleAddBanner = async () => {
    const title = window.prompt('Enter banner title:');
    const subtitle = window.prompt('Enter banner subtitle:');
    const image = window.prompt('Enter banner image URL:');
    if (!title || !image) return;
    try {
      await addDoc(collection(db, 'banners'), { 
        title, 
        subtitle: subtitle || '', 
        image, 
        active: true,
        createdAt: new Date().toISOString() 
      });
      toast.success('Banner added');
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
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-50 rounded-lg md:hidden">
              <Menu size={20} />
            </button>
            <h1 className="text-2xl font-black text-[#1A2C54] capitalize">
              {viewingCustomer ? 'Customer Details' : activeTab}
            </h1>
            {activeTab === 'dashboard' && !viewingCustomer && (
              <button 
                onClick={seedData}
                className="hidden md:flex items-center space-x-2 px-3 py-1 bg-ruby/10 text-ruby rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-ruby/20 transition-all ml-4"
              >
                <Database size={12} />
                <span>Seed Data</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 md:space-x-6">
            <div className="hidden sm:flex items-center bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 w-72">
              <Search size={18} className="text-gray-400 mr-2" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none focus:outline-none text-sm w-full font-medium" />
            </div>
            
            <div className="relative flex items-center space-x-3">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 bg-gray-50 text-gray-400 hover:text-ruby rounded-xl border border-gray-100 transition-all relative group"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white group-hover:scale-125 transition-transform">
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
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-[#1A2C54] tracking-tight">Store Overview</h2>
                      <p className="text-sm text-gray-400 font-medium">Real-time performance metrics</p>
                    </div>
                    <button 
                      onClick={generateSalesReport}
                      disabled={isGeneratingReport}
                      className="w-full sm:w-auto px-6 py-3 bg-[#1A2C54] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby transition-all shadow-lg shadow-[#1A2C54]/10 flex items-center justify-center gap-2"
                    >
                      <BarChart3 size={16} />
                      {isGeneratingReport ? 'Generating...' : 'Download Sales Report'}
                    </button>
                  </div>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: 'Total Sales', value: `₹${totalSalesVal.toLocaleString()}`, trend: '+12% Today', icon: TrendingUp, color: 'text-ruby', bgColor: 'bg-ruby/10' },
                      { label: 'Total Orders', value: totalOrdersVal, trend: '+5% This Week', icon: ShoppingCart, color: 'text-ruby', bgColor: 'bg-ruby/10' },
                      { label: 'Total Customers', value: totalCustomersVal, trend: '+8 New Users', icon: UserPlus, color: 'text-[#22C55E]', bgColor: 'bg-[#22C55E]/10' },
                      { label: 'Low Stock Alert', value: `${lowStockVal} Products`, trend: 'Restock Needed', icon: AlertTriangle, color: 'text-[#EF4444]', bgColor: 'bg-[#EF4444]/10' },
                    ].map((stat, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ y: -5 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 transition-all relative overflow-hidden group"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-4 rounded-2xl ${stat.bgColor} ${stat.color} flex items-center justify-center shadow-sm`}>
                            <stat.icon size={24} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                            <h3 className="text-xl font-black text-[#1A2C54]">{stat.value}</h3>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-2 border-t border-gray-50">
                          {stat.label === 'Low Stock Alert' ? (
                            <span className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-bold rounded-full uppercase tracking-wider">Restock Needed</span>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <TrendingUp size={12} className={stat.color} />
                              <span className={`text-[10px] font-bold ${stat.color}`}>{stat.trend}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sales Chart */}
                    <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[#1A2C54]">Sales Overview</h3>
                        <div className="flex items-center space-x-2">
                          <select 
                            className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] font-bold text-gray-500 focus:outline-none cursor-pointer uppercase tracking-widest"
                            value={chartTimeframe}
                            onChange={(e) => setChartTimeframe(e.target.value as any)}
                          >
                            <option value="day">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                          </select>
                        </div>
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#9b111e" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#9b111e" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 600}} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                            />
                            <Area animationDuration={1500} type="monotone" dataKey="sales" stroke="#9b111e" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                            <Area animationDuration={1500} type="monotone" dataKey="orders" stroke="#22C55E" strokeWidth={4} fillOpacity={1} fill="url(#colorOrders)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center space-x-8 pt-4 border-t border-gray-50">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-ruby rounded-full shadow-sm shadow-ruby/20"></div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sales (₹)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-[#22C55E] rounded-full shadow-sm shadow-green-200"></div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Orders (count)</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Orders Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[#1A2C54]">Recent Orders</h3>
                        <button 
                          onClick={() => setActiveTab('orders')}
                          className="text-ruby text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center"
                        >
                          View All <ChevronRight size={14} className="ml-1" />
                        </button>
                      </div>
                      <div className="flex-grow overflow-y-auto scrollbar-hide">
                        <div className="divide-y divide-gray-50">
                          {orders.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                              No orders yet
                            </div>
                          ) : (
                            orders.slice(0, 5).map((order, i) => (
                              <div key={order.id || i} className="p-4 hover:bg-gray-50/50 transition-colors group flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${statusColors[order.status || 'Pending']?.split(' ')[0] || 'bg-gray-100'} ${statusColors[order.status || 'Pending']?.split(' ')[1] || 'text-gray-600'}`}>
                                    {(order.address?.name || order.customerName || order.customer || 'G').charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-[#1A2C54]">{order.address?.name || order.customerName || order.customer || 'Guest User'}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                      {order.orderId || `#${order.id?.slice(-6) || 'N/A'}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-[#1A2C54]">
                                    ₹{(order.total || 0).toLocaleString()}
                                  </p>
                                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[order.status || 'Pending'] || 'bg-gray-100 text-gray-600'}`}>
                                    {order.status || 'Pending'}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Selling Products */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[#1A2C54]">Top Selling Products</h3>
                        <button className="text-gray-400 hover:text-black transition-colors">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                      <div className="space-y-4">
                        {topProducts.length === 0 ? (
                          <div className="p-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                            No sales data yet
                          </div>
                        ) : (
                          topProducts.map((product, i) => (
                            <motion.div 
                              key={i} 
                              whileHover={{ x: 5 }}
                              className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center space-x-4">
                                <img src={product.image} alt={product.name} className="w-12 h-12 rounded-xl object-cover shadow-sm group-hover:scale-110 transition-transform" />
                                <div>
                                  <p className="text-sm font-bold text-[#1A2C54]">{product.name}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Product</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-black text-[#1A2C54]">{product.sales}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Units Sold</p>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Low Stock Alerts */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[#1A2C54]">Low Stock Alerts</h3>
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full uppercase tracking-widest">
                            {products.filter(p => (p.stock || 0) < 10).length} Critical
                          </span>
                        </div>
                        <button 
                          onClick={() => setActiveTab('products')}
                          className="text-ruby text-[10px] font-bold uppercase tracking-widest hover:underline"
                        >
                          Manage Stock
                        </button>
                      </div>
                      <div className="space-y-4">
                        {products.filter(p => (p.stock || 0) < 10).length === 0 ? (
                          <div className="p-10 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                            All products are well stocked
                          </div>
                        ) : (
                          products.filter(p => (p.stock || 0) < 10).slice(0, 5).map((product, i) => (
                            <motion.div 
                              key={i} 
                              whileHover={{ x: 5 }}
                              className="flex items-center justify-between p-4 bg-red-50/30 rounded-2xl border border-red-100 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-red-100 shadow-inner">
                                  <img src={product.images?.[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-[#1A2C54]">{product.name}</p>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                                      <div 
                                        className="bg-red-500 h-1.5 rounded-full" 
                                        style={{ width: `${Math.min(100, (product.stock || 0) * 10)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{product.stock || 0} Left</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingProduct(product);
                                  setFormData({ ...product });
                                  setShowAddProductPage(true);
                                }}
                                className="p-2 text-gray-400 hover:text-ruby transition-colors"
                              >
                                <Edit2 size={16} />
                              </button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Best Offers */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-[#1A2C54]">Best Offers</h3>
                        <button className="text-gray-400 hover:text-black transition-colors">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] p-6 rounded-2xl relative overflow-hidden group cursor-pointer shadow-lg shadow-blue-200">
                          <div className="relative z-10 space-y-1">
                            <h4 className="text-2xl font-black text-white">50% OFF</h4>
                            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Summer Collection</p>
                            <button className="mt-4 px-4 py-2 bg-white text-[#3B82F6] text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-sm">Claim Now</button>
                          </div>
                          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-150 transition-all duration-700"></div>
                        </div>
                        <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] p-6 rounded-2xl relative overflow-hidden group cursor-pointer shadow-lg shadow-green-200">
                          <div className="relative z-10 space-y-1">
                            <h4 className="text-xl font-black text-white">B1G1 FREE</h4>
                            <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest">Limited Time Offer</p>
                            <button className="mt-4 px-4 py-2 bg-white text-[#22C55E] text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-sm">Shop Now</button>
                          </div>
                          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-150 transition-all duration-700"></div>
                        </div>
                      </div>
                      <div className="bg-[#FACC15]/10 p-6 rounded-2xl border border-[#FACC15]/20 flex items-center justify-between group cursor-pointer">
                        <div className="space-y-1">
                          <h4 className="text-lg font-black text-[#854D0E]">Flat ₹500 Off</h4>
                          <p className="text-[10px] font-bold text-[#854D0E]/60 uppercase tracking-widest">On orders above ₹2999</p>
                        </div>
                        <div className="w-12 h-12 bg-[#FACC15] rounded-xl flex items-center justify-center text-white shadow-lg shadow-yellow-200 group-hover:rotate-12 transition-transform">
                          <Ticket size={24} />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
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
                            sizes: ['S', 'M', 'L', 'XL'], 
                            images: [''], 
                            stock: 10,
                            comparePrice: 0,
                            stockStatus: 'In Stock',
                            seoTitle: '',
                            seoDescription: '',
                            weight: '',
                            dimensions: '',
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
                                setFormData({ ...p } as any);
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
                            setFormData({ ...p } as any);
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
              <div className="grid grid-cols-2 gap-4">
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
                  <button className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all">
                    Edit
                  </button>
                  <button className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-[#3B82F6] text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-200">
                    Message
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-24 h-24 rounded-3xl bg-gray-50 border-4 border-white shadow-xl overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer}`} alt="Avatar" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-[#1A2C54]">{viewingCustomer.address?.name || viewingCustomer.customerName || viewingCustomer.customer}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Details</p>
                    </div>
                  </div>
                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</span>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.address?.email || viewingCustomer.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</span>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.address?.number || viewingCustomer.shippingAddress?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment</span>
                      <span className="text-sm font-bold text-[#1A2C54]">{viewingCustomer.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                {/* Address & Order Details */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Shipping Address</h4>
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-sm font-bold text-[#1A2C54] leading-relaxed">
                        {viewingCustomer.address ? (
                          <>
                            {viewingCustomer.address.name}<br />
                            {viewingCustomer.address.address},<br />
                            {viewingCustomer.address.city}, {viewingCustomer.address.state} - {viewingCustomer.address.pincode}<br />
                            India
                          </>
                        ) : viewingCustomer.shippingAddress ? (
                          <>
                            {viewingCustomer.shippingAddress.fullName}<br />
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
                        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 bg-gray-50 rounded-2xl border border-gray-100 gap-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <ShoppingBag size={20} className="text-[#3B82F6]" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#1A2C54]">{item.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Qty: {item.quantity} • Size: {item.selectedSize || 'N/A'} • Price: ₹{item.price.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right w-full sm:w-auto">
                            <p className="text-lg font-black text-[#1A2C54]">
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
                  <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
                  <p className="text-sm text-gray-400">Manage user roles and permissions</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                      <th className="py-4 px-8">Customer</th>
                      <th className="py-4 px-8">Email</th>
                      <th className="py-4 px-8">Loyalty Points</th>
                      <th className="py-4 px-8">Role</th>
                      <th className="py-4 px-8">Joined</th>
                      <th className="py-4 px-8 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {customers.map(customer => (
                      <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                        <td className="py-4 px-8 flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${customer.displayName || customer.email}`} alt="Avatar" />
                          </div>
                          <span className="font-bold text-[#1A2C54]">{customer.displayName || 'Anonymous'}</span>
                        </td>
                        <td className="py-4 px-8 text-gray-500">{customer.email}</td>
                        <td className="py-4 px-8">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600 shadow-sm border border-yellow-100">
                                  <Star size={14} className="fill-yellow-500" />
                                </div>
                                <span className="text-lg font-black text-[#1A2C54]">{customer.loyaltyPoints || 0}</span>
                              </div>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Points</p>
                            </div>
                            <button 
                              onClick={() => updateLoyaltyPoints(customer.id, 50)}
                              className="p-2 bg-gray-50 hover:bg-ruby hover:text-white rounded-xl text-gray-400 transition-all shadow-sm active:scale-90"
                              title="Add 50 Points"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-8">
                          <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${customer.role === 'admin' ? 'bg-ruby/10 text-ruby' : 'bg-blue-50 text-blue-600'}`}>
                            {customer.role || 'user'}
                          </span>
                        </td>
                        <td className="py-4 px-8 text-gray-400 font-medium">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-8 text-right">
                          <button 
                            onClick={() => handleUpdateUserRole(customer.id, customer.role || 'user')}
                            className="text-xs font-bold text-ruby hover:underline uppercase tracking-widest"
                          >
                            Make {customer.role === 'admin' ? 'User' : 'Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'rocket' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Marketing & Promotions</h2>
                  <p className="text-sm text-gray-400">Manage homepage banners and promotional content</p>
                </div>
                <button onClick={handleAddBanner} className="bg-ruby text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby-dark transition-all flex items-center shadow-lg shadow-ruby/20">
                  <Plus size={16} className="mr-2" /> Add Banner
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {banners.map(banner => (
                  <div key={banner.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:border-ruby/30 transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      <img src={banner.image} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-8">
                        <h3 className="text-2xl font-black text-white">{banner.title}</h3>
                        <p className="text-white/80 text-sm font-medium">{banner.subtitle}</p>
                      </div>
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button 
                          onClick={() => handleToggleBanner(banner.id, banner.active)}
                          className={`p-2 rounded-xl backdrop-blur-md border border-white/20 transition-all ${banner.active ? 'bg-green-500/80 text-white' : 'bg-gray-500/80 text-white'}`}
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Business Analytics</h2>
                  <p className="text-sm text-gray-400">Track your store performance and sales trends</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">Revenue Overview</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#E0115F" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#E0115F" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#E0115F" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">Order Volume</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                          cursor={{fill: '#F9FAFB'}}
                        />
                        <Bar dataKey="orders" fill="#1F2937" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-sm font-medium text-gray-400 mb-2">Average Order Value</p>
                  <p className="text-3xl font-black text-gray-800">₹{(totalRevenue / (orders.length || 1)).toFixed(2)}</p>
                  <div className="mt-4 flex items-center text-green-500 text-sm font-bold">
                    <TrendingUp size={16} className="mr-1" /> +5.2% from last month
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-sm font-medium text-gray-400 mb-2">Conversion Rate</p>
                  <p className="text-3xl font-black text-gray-800">3.2%</p>
                  <div className="mt-4 flex items-center text-ruby text-sm font-bold">
                    <TrendingDown size={16} className="mr-1" /> -0.8% from last month
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-sm font-medium text-gray-400 mb-2">Customer Retention</p>
                  <p className="text-3xl font-black text-gray-800">24%</p>
                  <div className="mt-4 flex items-center text-green-500 text-sm font-bold">
                    <TrendingUp size={16} className="mr-1" /> +12% from last month
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Notifications</h2>
                  <p className="text-sm text-gray-400">Stay updated with your store activities</p>
                </div>
                <button 
                  onClick={() => setNotifications([])}
                  className="bg-ruby/10 text-ruby px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ruby/20 transition-all"
                >
                  Clear All
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {notifications.length === 0 ? (
                  <div className="p-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                      <Bell size={40} />
                    </div>
                    <p className="text-gray-400 font-medium">No new notifications at the moment.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        className="p-6 hover:bg-gray-50 transition-colors flex items-start justify-between group"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-ruby/10 text-ruby rounded-2xl flex items-center justify-center flex-shrink-0">
                            <ShoppingBag size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-[#1A2C54]">New Order Received!</h4>
                            <p className="text-xs text-gray-500">
                              Order <span className="font-bold text-ruby">#{notif.orderId || notif.id?.slice(-6)}</span> was placed by <span className="font-bold text-[#1A2C54]">{notif.address?.name || 'Guest'}</span>.
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Total: ₹{(notif.total || 0).toLocaleString()} • {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setActiveTab('orders');
                            setViewingCustomer(notif);
                          }}
                          className="px-4 py-2 bg-white border border-gray-100 text-ruby rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby hover:text-white transition-all opacity-0 group-hover:opacity-100"
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
                              {msg.type === 'image' ? (
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
                            <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                                    <img src={item.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-[#1A2C54]">Product Performance Heatmap 🔥</h2>
                  <p className="text-sm text-gray-400 font-medium">Visualize product engagement and conversion gaps</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-1 bg-ruby/5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-ruby animate-pulse"></div>
                    <span className="text-[10px] font-bold text-ruby uppercase tracking-widest">Live Data</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Viewed vs Wishlisted */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#1A2C54] flex items-center gap-2">
                      <BarChart3 size={20} className="text-ruby" />
                      Engagement Metrics
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
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={products.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} />
                        <Tooltip 
                          cursor={{ fill: '#F9FAFB' }}
                          contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="viewCount" name="Views" fill="#1A2C54" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="wishlistCount" name="Wishlists" fill="#E11D48" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Conversion Gap Heatmap */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                  <h3 className="text-lg font-bold text-[#1A2C54] flex items-center gap-2">
                    <TrendingDown size={20} className="text-yellow-500" />
                    Conversion Gap (High Interest, Low Sales)
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
                      .slice(0, 5)
                      .map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-ruby/5 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100">
                              <img src={p.images[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#1A2C54]">{p.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.category}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-xs font-bold text-ruby">{Math.round(p.gap * 100)}% Gap</span>
                              <AlertTriangle size={14} className="text-ruby" />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{p.interest} Interest vs {p.sales} Sales</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Visual Heatmap Grid */}
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-[#1A2C54]">Product Popularity Grid</h3>
                    <p className="text-xs text-gray-400">Darker red indicates higher customer engagement</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Low</span>
                    <div className="w-32 h-2 bg-gradient-to-r from-ruby/5 to-ruby rounded-full"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">High</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {products.map((p, idx) => {
                    const popularity = (p.viewCount || 0) + (p.wishlistCount || 0) * 2;
                    const maxPopularity = Math.max(...products.map(pr => (pr.viewCount || 0) + (pr.wishlistCount || 0) * 2), 1);
                    const intensity = popularity / maxPopularity;
                    
                    return (
                      <div 
                        key={idx} 
                        className="aspect-square rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-2 relative group overflow-hidden transition-all hover:scale-105"
                        style={{ 
                          backgroundColor: `rgba(225, 29, 72, ${Math.max(0.05, intensity)})`,
                          border: intensity > 0.7 ? '2px solid #E11D48' : '1px solid rgba(225, 29, 72, 0.1)'
                        }}
                      >
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-white">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1">{p.name}</p>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Views: {p.viewCount || 0}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Wish: {p.wishlistCount || 0}</span>
                          </div>
                        </div>
                        <p className={`text-2xl font-black ${intensity > 0.5 ? 'text-white' : 'text-ruby'}`}>
                          {popularity}
                        </p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest ${intensity > 0.5 ? 'text-white/80' : 'text-gray-400'}`}>
                          Score
                        </p>
                      </div>
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
                              value={settings.storeName}
                              onChange={(e) => setSettings({...settings, storeName: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Support Email</label>
                            <input 
                              type="email" 
                              value={settings.supportEmail}
                              onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Currency Symbol</label>
                            <input 
                              type="text" 
                              value={settings.currency}
                              onChange={(e) => setSettings({...settings, currency: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
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
                              value={settings.googleSheetUrl}
                              onChange={(e) => setSettings({...settings, googleSheetUrl: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sheet API Key</label>
                            <input 
                              type="password" 
                              placeholder="Enter your Sheet API Key"
                              value={settings.googleSheetApiKey}
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
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Resend API Key</label>
                            <input 
                              type="password" 
                              placeholder="re_..."
                              value={settings.resendApiKey}
                              onChange={(e) => setSettings({...settings, resendApiKey: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                            />
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
                                value={settings.notificationSound}
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Store Favicon URL</label>
                            <div className="flex items-center space-x-4">
                              <input 
                                type="url" 
                                placeholder="https://example.com/favicon.ico"
                                value={settings.favicon}
                                onChange={(e) => setSettings({...settings, favicon: e.target.value})}
                                className="flex-grow bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium" 
                              />
                              {settings.favicon && (
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 overflow-hidden">
                                  <img src={settings.favicon} alt="Favicon Preview" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                                </div>
                              )}
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
                              value={settings.siteTitle}
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
                              value={settings.metaDescription}
                              onChange={(e) => setSettings({...settings, metaDescription: e.target.value})}
                              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-ruby/20 transition-all font-medium resize-none" 
                            />
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                              A brief summary of your store. Google often shows this in search results.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'dashboard' && activeTab !== 'products' && activeTab !== 'orders' && activeTab !== 'category' && activeTab !== 'colour' && activeTab !== 'size' && activeTab !== 'coupon' && activeTab !== 'customer' && activeTab !== 'rocket' && activeTab !== 'stats' && activeTab !== 'settings' && !viewingCustomer && (
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
                    value={categoryForm.name}
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
                    value={colorForm.name}
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
                      value={colorForm.hex}
                      onChange={e => setColorForm({...colorForm, hex: e.target.value})}
                      className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                    />
                    <input 
                      type="text" 
                      required
                      value={colorForm.hex}
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
                    value={sizeForm.name}
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
                    value={couponForm.code}
                    onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                    className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent font-black tracking-widest"
                    placeholder="e.g. SUMMER50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Discount Type</label>
                    <select 
                      value={couponForm.type}
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
                    value={couponForm.expiryDate}
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

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl p-6 md:p-10 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto space-y-8"
            >
              <div className="flex justify-between items-center border-b border-gray-50 pb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-sm text-gray-400">Enter product details below</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:text-ruby transition-colors bg-gray-50 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Description</label>
                      <button 
                        type="button"
                        onClick={() => generateAIDescription(formData.name)}
                        disabled={isGeneratingAI}
                        className="text-[10px] font-bold text-ruby hover:text-ruby-dark uppercase tracking-widest flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingAI ? 'Generating...' : (
                          <>
                            <BarChart3 size={12} />
                            AI Generate
                          </>
                        )}
                      </button>
                    </div>
                    <textarea 
                      required
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full border border-gray-100 rounded-xl p-4 text-sm focus:outline-none focus:border-ruby transition-colors h-32 bg-gray-50/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price (₹)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={formData.price || ''}
                        onChange={e => setFormData({...formData, price: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                        className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stock</label>
                      <input 
                        type="number" 
                        required
                        value={formData.stock || ''}
                        onChange={e => setFormData({...formData, stock: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                        className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</label>
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Image URL</label>
                    <div className="flex space-x-2">
                      <input 
                        type="url" 
                        required
                        value={formData.images[0]}
                        onChange={e => setFormData({...formData, images: [e.target.value]})}
                        className="flex-grow border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                        placeholder="https://..."
                      />
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300">
                        <ImageIcon size={18} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sizes</label>
                    <input 
                      type="text" 
                      value={formData.sizes.join(', ')}
                      onChange={e => setFormData({...formData, sizes: e.target.value.split(',').map(s => s.trim())})}
                      className="w-full border-b border-gray-100 py-2 text-sm focus:outline-none focus:border-ruby transition-colors bg-transparent"
                      placeholder="S, M, L, XL"
                    />
                  </div>

                  <Accordion title="SEO Settings" icon={Globe}>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">SEO Title</label>
                        <input 
                          type="text" 
                          value={formData.seoTitle}
                          onChange={e => setFormData({...formData, seoTitle: e.target.value})}
                          placeholder="Product SEO Title" 
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ruby/10" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meta Description</label>
                        <textarea 
                          value={formData.seoDescription}
                          onChange={e => setFormData({...formData, seoDescription: e.target.value})}
                          placeholder="Brief description for search engines..." 
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ruby/10 h-24" 
                        />
                      </div>
                    </div>
                  </Accordion>
                  
                  <button 
                    type="submit"
                    className="w-full bg-black text-white py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-ruby transition-all mt-8 shadow-xl shadow-black/10"
                  >
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </button>
                </div>
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
