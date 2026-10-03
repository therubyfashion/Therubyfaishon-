import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

interface Address {
  id: string;
  name: string;
  number: string;
  address: string;
  landmark?: string;
  state: string;
  city: string;
  pincode: string;
  label?: 'Home' | 'Office' | 'Other';
  isDefault: boolean;
}

export default function Addresses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    number: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  const deserializeAddress = (row: any): Address => {
    let addressText = row.address_line || '';
    let landmarkText = row.landmark || '';
    let labelVal: 'Home' | 'Office' | 'Other' = (row.label as any) || 'Home';

    if (addressText.startsWith('{') && addressText.endsWith('}')) {
      try {
        const parsed = JSON.parse(addressText);
        if (parsed && typeof parsed === 'object') {
          addressText = parsed.address || '';
          landmarkText = parsed.landmark || landmarkText;
          labelVal = parsed.label || labelVal;
        }
      } catch (e) {}
    }

    return {
      id: row.id,
      name: row.full_name || '',
      number: row.phone || '',
      address: addressText,
      landmark: landmarkText,
      state: row.state || '',
      city: row.city || '',
      pincode: row.zip || '',
      label: labelVal,
      isDefault: row.is_default || false,
    };
  };

  useEffect(() => {
    if (user) {
      fetchAddresses();
    } else {
      setLoading(false);
      setShowForm(true);
    }
  }, [user]);

  const fetchAddresses = async () => {
    const userId = user?.id || user?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching addresses:", error);
        return;
      }

      const fetched = (data || [])
        .map(deserializeAddress)
        .filter(a => a && a.id && !String(a.id).startsWith('addr_default_') && a.id !== '1' && a.id !== '2' && a.name !== 'Priya Sharma' && a.name !== 'Rajesh Sharma');
      
      setAddresses(fetched);
      if (fetched.length === 0) {
        setShowForm(true);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.number.trim() || !formData.address.trim() || !formData.city.trim() || !formData.state.trim() || !formData.pincode.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    const userId = user?.id || user?.uid;

    try {
      if (editingAddress) {
        if (userId) {
          const { error } = await supabase
            .from('addresses')
            .update({
              full_name: formData.name.trim(),
              phone: formData.number.trim(),
              address_line: formData.address.trim(),
              city: formData.city.trim(),
              state: formData.state.trim(),
              zip: formData.pincode.trim(),
            })
            .eq('id', editingAddress.id);

          if (error) throw error;
        }

        toast.success("Address updated successfully!");
      } else {
        if (userId) {
          const { error } = await supabase
            .from('addresses')
            .insert({
              user_id: userId,
              full_name: formData.name.trim(),
              phone: formData.number.trim(),
              address_line: formData.address.trim(),
              city: formData.city.trim(),
              state: formData.state.trim(),
              zip: formData.pincode.trim(),
              country: 'India',
              is_default: addresses.length === 0,
              created_at: new Date().toISOString()
            });

          if (error) throw error;
        }

        toast.success("Address added successfully!");
      }

      setShowForm(false);
      setEditingAddress(null);
      setFormData({
        name: '',
        number: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
      });
      fetchAddresses();
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const userId = user?.id || user?.uid;
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Address deleted.");
      fetchAddresses();
    } catch (error) {
      console.error("Error deleting address:", error);
      toast.error("Failed to delete address.");
    }
  };

  const handleSetDefault = async (id: string) => {
    const userId = user?.id || user?.uid;
    if (!userId) return;
    try {
      const { error: resetErr } = await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      if (resetErr) throw resetErr;

      const { error: setErr } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id);

      if (setErr) throw setErr;

      toast.success("Default address updated!");
      fetchAddresses();
    } catch (error) {
      console.error("Error setting default address:", error);
      toast.error("Failed to set default address.");
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      number: address.number,
      address: address.address,
      city: address.city,
      state: address.state,
      pincode: address.pincode
    });
    setShowForm(true);
  };

  const handleBack = () => {
    if (showForm && addresses.length > 0) {
      setShowForm(false);
      setEditingAddress(null);
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ruby border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-[#171717] flex justify-center py-10 px-3 sm:px-5">
      <div className="w-full max-w-[520px]">
        <AnimatePresence mode="wait">
          {showForm ? (
            /* EXACT Address Form Template Provided by User */
            <motion.div
              key="address-form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full max-w-[520px] bg-white rounded-[14px] sm:rounded-[6px] p-[23px_18px] sm:p-[30px]"
            >
              {/* HEADER */}
              <div className="flex items-center gap-[13px] mb-[26px]">
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Go back"
                  className="w-[36px] h-[36px] min-w-[36px] p-0 border-none rounded-full bg-[#f1f1f1] text-[#171717] grid place-items-center font-sans text-[19px] font-normal leading-none cursor-pointer hover:bg-[#e8e8e8] active:scale-[0.94] transition-all"
                >
                  &#8592;
                </button>

                <div>
                  <h2 className="text-[21px] sm:text-[23px] font-[650] tracking-[-0.4px] text-[#171717]">
                    {editingAddress ? 'Edit Address' : 'Add Address'}
                  </h2>
                  <p className="mt-[6px] text-[#777] text-[14px]">
                    Enter your delivery details below.
                  </p>
                </div>
              </div>

              {/* ADDRESS FORM */}
              <form onSubmit={handleSubmit}>
                {/* Full Name */}
                <div className="mb-[17px]">
                  <label htmlFor="name" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all placeholder:text-[#a3a3a3] focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                  />
                </div>

                {/* Phone */}
                <div className="mb-[17px]">
                  <label htmlFor="phone" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    value={formData.number}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, number: val });
                    }}
                    className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all placeholder:text-[#a3a3a3] focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                  />
                </div>

                {/* Address */}
                <div className="mb-[17px]">
                  <label htmlFor="address" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                    Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    placeholder="House no., street, area"
                    autoComplete="street-address"
                    required
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all placeholder:text-[#a3a3a3] focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                  />
                </div>

                {/* City + State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-[14px]">
                  {/* City */}
                  <div className="mb-[17px]">
                    <label htmlFor="city" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      placeholder="Enter city"
                      autoComplete="address-level2"
                      required
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all placeholder:text-[#a3a3a3] focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                    />
                  </div>

                  {/* State */}
                  <div className="mb-[17px]">
                    <label htmlFor="state" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                      State
                    </label>
                    <select
                      id="state"
                      required
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                    >
                      <option value="">Choose state</option>
                      {INDIAN_STATES.map(st => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PIN Code */}
                <div className="mb-[17px]">
                  <label htmlFor="pincode" className="block mb-[7px] text-[13px] font-[600] text-[#404040]">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    placeholder="6-digit PIN code"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required
                    value={formData.pincode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormData({ ...formData, pincode: val });
                    }}
                    className="w-full h-[46px] px-[13px] border border-[#dddddd] rounded-[9px] bg-white text-[#171717] text-[14px] outline-none transition-all placeholder:text-[#a3a3a3] focus:border-[#9b111e] focus:ring-2 focus:ring-[#9b111e]/10"
                  />
                </div>

                {/* Save (Brand Red Background as explicitly requested) */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[47px] mt-[6px] border-none rounded-[9px] bg-ruby text-white text-[14px] font-[600] cursor-pointer hover:bg-ruby-dark active:scale-[0.99] transition-all flex items-center justify-center disabled:opacity-75 shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Address'}
                </button>
              </form>
            </motion.div>
          ) : (
            /* Saved Addresses View */
            <motion.div
              key="address-list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full max-w-[520px] bg-white rounded-[14px] sm:rounded-[6px] p-[23px_18px] sm:p-[30px]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-[24px]">
                <div className="flex items-center gap-[13px]">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                    className="w-[36px] h-[36px] min-w-[36px] p-0 border-none rounded-full bg-[#f1f1f1] text-[#171717] grid place-items-center font-sans text-[19px] font-normal leading-none cursor-pointer hover:bg-[#e8e8e8] active:scale-[0.94] transition-all"
                  >
                    &#8592;
                  </button>
                  <div>
                    <h2 className="text-[21px] sm:text-[23px] font-[650] tracking-[-0.4px] text-[#171717]">
                      Saved Addresses
                    </h2>
                    <p className="mt-[4px] text-[#777] text-[13px]">
                      Manage your delivery locations
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditingAddress(null);
                    setFormData({ name: '', number: '', address: '', city: '', state: '', pincode: '' });
                    setShowForm(true);
                  }}
                  className="px-3.5 py-2 rounded-[9px] bg-ruby text-white text-xs font-semibold hover:bg-ruby-dark transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={15} />
                  <span>Add New</span>
                </button>
              </div>

              {/* Address Cards */}
              <div className="space-y-3.5">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-4 rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] flex items-start justify-between gap-3 hover:border-ruby/30 transition-all"
                  >
                    <div className="space-y-1 text-left flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-[650] text-[#171717] truncate">{addr.name}</span>
                        {addr.isDefault && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={11} /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-[#555] font-medium">{addr.number}</p>
                      <p className="text-[13px] text-[#666] leading-relaxed break-words">
                        {addr.address}, {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-md hover:bg-white transition-all"
                        >
                          Make Default
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(addr)}
                        className="w-8 h-8 rounded-lg bg-white border border-[#e0e0e0] text-[#444] hover:text-ruby hover:border-ruby flex items-center justify-center transition-all"
                        title="Edit Address"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id)}
                        className="w-8 h-8 rounded-lg bg-white border border-[#e0e0e0] text-[#444] hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition-all"
                        title="Delete Address"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
