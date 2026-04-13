import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  X, 
  ChevronLeft,
  Smartphone,
  Mail,
  User
} from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface Address {
  id: string;
  name: string;
  email: string;
  number: string;
  address: string;
  landmark?: string;
  state: string;
  city: string;
  pincode: string;
  label: 'Home' | 'Office' | 'Other';
  isDefault: boolean;
}

export default function Addresses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    number: '',
    address: '',
    landmark: '',
    state: '',
    city: '',
    pincode: '',
    label: 'Home' as 'Home' | 'Office' | 'Other'
  });

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  const fetchAddresses = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, `users/${user.uid}/addresses`), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Address[];
      setAddresses(fetched);
    } catch (error) {
      console.error("Error fetching addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingAddress) {
        await updateDoc(doc(db, `users/${user.uid}/addresses`, editingAddress.id), formData);
        toast.success("Address updated successfully!");
      } else {
        await addDoc(collection(db, `users/${user.uid}/addresses`), {
          ...formData,
          isDefault: addresses.length === 0,
          createdAt: new Date().toISOString()
        });
        toast.success("Address added successfully!");
      }
      setShowForm(false);
      setEditingAddress(null);
      setFormData({
        name: '', email: '', number: '', address: '', landmark: '', state: '', city: '', pincode: '', label: 'Home'
      });
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/addresses`, id));
      toast.success("Address deleted.");
      fetchAddresses();
    } catch (error) {
      console.error("Error deleting address:", error);
      toast.error("Failed to delete address.");
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      email: address.email,
      number: address.number,
      address: address.address,
      landmark: address.landmark || '',
      state: address.state,
      city: address.city,
      pincode: address.pincode,
      label: address.label
    });
    setShowForm(true);
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pt-24 pb-32 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#1A2C54] shadow-sm hover:text-ruby transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-serif font-bold text-[#1A2C54]">My <span className="text-ruby italic">Addresses</span></h1>
          </div>
          <div className="h-1 w-12 bg-ruby rounded-full" />
        </div>

        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] border border-gray-50 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-serif font-bold text-[#1A2C54]">
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                <button 
                  onClick={() => { setShowForm(false); setEditingAddress(null); }}
                  className="p-2 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" required value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                      placeholder="Receiver's Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="email" required value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                        placeholder="Email for updates"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Phone</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="tel" required value={formData.number}
                        onChange={e => setFormData({...formData, number: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                        placeholder="10-digit number"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Full Address</label>
                  <textarea 
                    required value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20 min-h-[100px]"
                    placeholder="House No, Street, Area..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">City</label>
                    <input 
                      type="text" required value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Pincode</label>
                    <input 
                      type="text" required value={formData.pincode}
                      onChange={e => setFormData({...formData, pincode: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2C54] focus:ring-2 focus:ring-ruby/20"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2">Save As</label>
                  <div className="flex gap-3">
                    {(['Home', 'Office', 'Other'] as const).map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setFormData({ ...formData, label })}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                          formData.label === label 
                            ? "bg-ruby text-white border-ruby shadow-lg shadow-ruby/20" 
                            : "bg-white text-gray-400 border-gray-100"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-[#1A2C54] text-white py-5 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] hover:bg-ruby transition-all shadow-xl shadow-[#1A2C54]/10 mt-4"
                >
                  {editingAddress ? 'Update Address' : 'Save Address'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {addresses.length === 0 ? (
                <div className="text-center p-16 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MapPin size={32} className="text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">No saved addresses yet.</p>
                </div>
              ) : (
                addresses.map((addr) => (
                  <motion.div 
                    key={addr.id}
                    layout
                    className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex items-center justify-between group hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-[#1A2C54]">
                        <MapPin size={20} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#1A2C54]">{addr.name}</span>
                          <span className="bg-ruby/10 text-ruby text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {addr.label}
                          </span>
                          {addr.isDefault && (
                            <CheckCircle2 size={12} className="text-green-500" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed max-w-[200px] truncate">
                          {addr.address}, {addr.city}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEdit(addr)}
                        className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-ruby hover:bg-ruby/5 transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(addr.id)}
                        className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-ruby hover:bg-ruby/5 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}

              {/* Add Address Button at bottom */}
              <button 
                onClick={() => setShowForm(true)}
                className="w-full bg-white border-2 border-dashed border-gray-200 p-6 rounded-[2rem] flex items-center justify-center gap-3 text-[#1A2C54] hover:border-ruby/30 hover:bg-ruby/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-ruby group-hover:text-white transition-all">
                  <Plus size={20} />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest">Add New Address</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
