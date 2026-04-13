import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Plus, Home, Briefcase, Trash2, Edit2, CheckCircle2, X, ChevronRight, Smartphone } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
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

export default function AddressManager() {
  const { user } = useAuth();
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
    fetchAddresses();
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

  if (loading) return <div className="p-8 text-center text-gray-400">Loading addresses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end px-2">
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-[10px] font-bold text-ruby uppercase tracking-widest hover:underline"
          >
            <Plus size={14} />
            Add New
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-[#1A2C54]">{editingAddress ? 'Edit Address' : 'New Address'}</h4>
              <button type="button" onClick={() => { setShowForm(false); setEditingAddress(null); }} className="text-gray-400 hover:text-ruby">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Full Name</label>
              <input 
                type="text" required value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Email</label>
                <input 
                  type="email" required value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Phone</label>
                <input 
                  type="tel" required value={formData.number}
                  onChange={e => setFormData({...formData, number: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Address</label>
              <textarea 
                required value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">City</label>
                <input 
                  type="text" required value={formData.city}
                  onChange={e => setFormData({...formData, city: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Pincode</label>
                <input 
                  type="text" required value={formData.pincode}
                  onChange={e => setFormData({...formData, pincode: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ruby/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Label</label>
              <div className="flex gap-2">
                {(['Home', 'Office', 'Other'] as const).map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setFormData({ ...formData, label })}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all",
                      formData.label === label 
                        ? "bg-ruby text-white border-ruby" 
                        : "bg-gray-50 text-gray-400 border-gray-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-[#1A2C54] text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-ruby transition-all">
              {editingAddress ? 'Update Address' : 'Save Address'}
            </button>
          </motion.form>
        ) : (
          <div className="space-y-4">
            {addresses.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-[2rem] border border-dashed border-gray-200">
                <MapPin size={32} className="mx-auto text-gray-200 mb-4" />
                <p className="text-sm text-gray-400 font-medium">No saved addresses yet.</p>
              </div>
            ) : (
              addresses.map((addr) => (
                <motion.div 
                  key={addr.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex items-start justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#1A2C54]">{addr.name}</span>
                      <span className="bg-gray-100 text-gray-500 text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="text-green-500 flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          <span className="text-[8px] font-bold uppercase tracking-widest">Default</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-[200px]">
                      {addr.address}, {addr.landmark && `${addr.landmark}, `}{addr.city}, {addr.state} - {addr.pincode}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[#1A2C54]">
                      <Smartphone size={12} className="text-gray-300" />
                      {addr.number}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(addr)} className="p-2 text-gray-400 hover:text-ruby transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(addr.id)} className="p-2 text-gray-400 hover:text-ruby transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
