import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
// Removed Firestore imports to run purely on Supabase
import { toast } from 'sonner';
import { cn, syncToGoogleSheets } from '../lib/utils';
import { sendNotification } from '../lib/notifications';
import { ChevronLeft, ShoppingBag, MapPin, Home, Briefcase, Plus, CheckCircle2, Lock, Smartphone, Building2, Handshake, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { LoadingSpinner } from '../components/Skeleton';
import SwipeButton from '../components/SwipeButton';
import { trackPixelEvent } from '../lib/pixel';
import { formatPrice } from '../utils/currency';
import { supabase } from '../supabase';

const STEPS = [
  { id: 1, label: 'Address' },
  { id: 2, label: 'Shipping' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Payment' }
];

export default function Checkout() {
  const { items, total, itemCount, appliedPromo, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Track live checkout
  useEffect(() => {
    const socket = io();
    socket.emit('checkpoint_reached', {
      type: 'checkout',
      sessionId: sessionStorage.getItem('visitor_session_id') || 'unknown',
      userId: user?.uid || 'guest',
      timestamp: new Date().toISOString()
    });

    // Meta Pixel Tracking
    trackPixelEvent('InitiateCheckout', {
      content_ids: items.map(i => i.id),
      content_type: 'product',
      num_items: itemCount,
      value: total,
      currency: 'INR'
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('checkout_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(() => {
    return localStorage.getItem('selected_address_id');
  });
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1);

  useEffect(() => {
    if (!isProcessingPayment) {
      setPaymentStep(1);
      return;
    }
    const step1 = setTimeout(() => setPaymentStep(2), 300);
    const step2 = setTimeout(() => setPaymentStep(3), 600);
    const step3 = setTimeout(() => setPaymentStep(4), 900);
    
    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, [isProcessingPayment]);

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const { profile, refreshProfile } = useAuth();
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Phone OTP States
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Disable background scrolling when OTP verification modal is active
  useEffect(() => {
    if (isVerifyingOtp) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVerifyingOtp]);

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        let guestAddresses: any[] = [];
        try {
          const cached = localStorage.getItem('user_addresses');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              guestAddresses = parsed.filter(a => a && a.id && !String(a.id).startsWith('addr_default_') && a.id !== '1' && a.id !== '2' && a.name !== 'Priya Sharma' && a.name !== 'Rajesh Sharma');
            }
          }
        } catch (err) {
          console.error(err);
        }
        setAddresses(guestAddresses);
        if (guestAddresses.length > 0 && !selectedAddress) {
          setSelectedAddress(guestAddresses[0].id);
        }
        setLoadingAddresses(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false });

        if (error) throw error;

        let fetchedAddresses = (data || []).map(row => {
          let addressText = row.address_line || '';
          let landmarkText = row.landmark || '';
          let labelVal: 'Home' | 'Office' | 'Other' = (row.label as any) || 'Home';

          // fallback for old JSON format if any
          if (addressText.startsWith('{') && addressText.endsWith('}')) {
            try {
              const parsed = JSON.parse(addressText);
              if (parsed && typeof parsed === 'object') {
                addressText = parsed.address || '';
                landmarkText = parsed.landmark || landmarkText;
                labelVal = parsed.label || labelVal;
              }
            } catch (e) {
              // ignore
            }
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
        });

        // Filter out any default dummy addresses if present
        fetchedAddresses = fetchedAddresses.filter(a => a && a.id && !String(a.id).startsWith('addr_default_') && a.id !== '1' && a.id !== '2' && a.name !== 'Priya Sharma' && a.name !== 'Rajesh Sharma');

        setAddresses(fetchedAddresses);
        if (fetchedAddresses.length > 0 && !selectedAddress) {
          const defaultAddr = fetchedAddresses.find(a => a.isDefault) || fetchedAddresses[0];
          setSelectedAddress(defaultAddr.id);
        }
      } catch (err) {
        console.error("Error fetching addresses in checkout:", err);
      } finally {
        setLoadingAddresses(false);
      }
    };
    fetchAddresses();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const configRes = await fetch('/api/payment-config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setStoreSettings({
            storeName: 'The Ruby Fashion',
            storeLogo: 'https://cdn-icons-png.flaticon.com/512/2909/2909813.png',
            ...configData
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    localStorage.setItem('checkout_step', currentStep.toString());
  }, [currentStep]);

  useEffect(() => {
    const validAddresses = addresses.filter(a => a && a.id && !String(a.id).startsWith('addr_default_') && a.id !== '1' && a.id !== '2' && a.name !== 'Priya Sharma' && a.name !== 'Rajesh Sharma');
    if (validAddresses.length > 0) {
      localStorage.setItem('user_addresses', JSON.stringify(validAddresses));
    } else {
      localStorage.removeItem('user_addresses');
    }
  }, [addresses]);

  useEffect(() => {
    if (selectedAddress) {
      localStorage.setItem('selected_address_id', selectedAddress);
    } else {
      localStorage.removeItem('selected_address_id');
    }
  }, [selectedAddress]);
  const [newAddress, setNewAddress] = useState({
    name: '',
    number: '',
    address: '',
    landmark: '',
    state: '',
    city: '',
    pincode: '',
    label: 'Home' as 'Home' | 'Office' | 'Other'
  });

  const shippingOptions = [
    { id: 'standard', label: 'Free Delivery', time: 'Guaranteed in 25 days', price: 'FREE', icon: '🚚', cost: 0 },
    { id: 'economy', label: '18 Day Delivery', time: 'Guaranteed in 18 days', price: '₹50', icon: '📦', cost: 50 },
    { id: 'express', label: '10 Day Delivery', time: 'Guaranteed in 10 days', price: '₹120', icon: '⚡', cost: 120 },
  ];

  const selectedAddrObj = addresses.find(a => a.id === selectedAddress);
  const selectedShippingObj = shippingOptions.find(o => o.id === selectedShipping);

  const subtotal = Number(total) || 0;
  const discount = Number(appliedPromo ? appliedPromo.discount : 0);
  const shippingCost = Number(selectedShippingObj?.cost || 0);
  const codFee = Number(selectedPayment === 'cod' ? 80 : 0);

  // Loyalty Points calculation: 100 points = ₹10 discount (min 100 points required)
  const userPoints = Number(profile?.loyaltyPoints || 0);
  const canRedeemPoints = userPoints >= 100;
  const maxDiscountFromPoints = Math.max(0, subtotal - discount + shippingCost + codFee);
  const pointsNeededForFullDiscount = Math.floor(maxDiscountFromPoints * 10);
  const pointsToRedeem = (useLoyaltyPoints && canRedeemPoints) 
    ? Math.min(userPoints, pointsNeededForFullDiscount) 
    : 0;
  const pointsDiscount = Math.floor(pointsToRedeem / 10);

  const finalTotal = Math.max(0, subtotal - discount - pointsDiscount + shippingCost + codFee);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!/^[a-zA-Z\s]{3,50}$/.test(newAddress.name)) {
      newErrors.name = 'Please enter a valid name (3-50 characters, letters only)';
    }

    // Phone validation (Indian 10-digit)
    if (!/^[6-9]\d{9}$/.test(newAddress.number)) {
      newErrors.number = 'Please enter a valid 10-digit mobile number';
    }

    // Address validation
    if (newAddress.address.length < 10) {
      newErrors.address = 'Address is too short. Please provide more details.';
    }

    // Pincode validation (Indian 6-digit)
    if (!/^\d{6}$/.test(newAddress.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode';
    }

    // City & State validation
    if (newAddress.city.length < 2) newErrors.city = 'Invalid city name';
    if (newAddress.state.length < 2) newErrors.state = 'Invalid state name';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtpCode = async (phone: string) => {
    setIsOtpSending(true);
    setOtpError('');
    try {
      const response = await fetch('/api/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Verification OTP sent successfully to ${phone}!`);
        setOtpCountdown(60); // 1 minute countdown for resend
      } else {
        setOtpError(data.message || data.error || 'Failed to dispatch verification OTP');
        toast.error(data.message || data.error || 'Failed to send OTP code.');
      }
    } catch (err: any) {
      console.error("Error dispatching OTP:", err);
      setOtpError("Network error. Failed to connect to SMS gateway.");
      toast.error("Failed to connect to SMS gateway.");
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyOtpAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setOtpError('Please enter a valid OTP code.');
      return;
    }

    setIsOtpSubmitting(true);
    setOtpError('');

    try {
      const response = await fetch('/api/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: otpSentTo,
          otp: otpCode.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || 'Invalid OTP code.');
        toast.error(data.error || 'Failed to verify OTP.');
        setIsOtpSubmitting(false);
        return;
      }

      // Success! Proceed to save the pendingAddress
      if (!pendingAddress) {
        toast.error('An error occurred. Pending address data is missing.');
        setIsVerifyingOtp(false);
        setIsOtpSubmitting(false);
        return;
      }

      let id = 'addr_' + Math.random().toString(36).substr(2, 9);
      if (user) {
        const { data, error } = await supabase
          .from('addresses')
          .insert({
            user_id: user.uid,
            full_name: pendingAddress.name,
            phone: pendingAddress.number,
            address_line: pendingAddress.address,
            landmark: pendingAddress.landmark,
            label: pendingAddress.label,
            city: pendingAddress.city,
            state: pendingAddress.state,
            zip: pendingAddress.pincode,
            country: 'India',
            is_default: addresses.length === 0,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data?.id) id = data.id;
      }
      const savedAddress = { id, ...pendingAddress };
      const updatedAddresses = [...addresses, savedAddress];
      setAddresses(updatedAddresses);
      setSelectedAddress(id);
      try {
        localStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
      } catch (e) {
        console.error("Error caching addresses:", e);
      }
      setIsVerifyingOtp(false);
      setPendingAddress(null);
      setShowAddressForm(false);
      setNewAddress({
        name: '',
        email: '',
        number: '',
        address: '',
        landmark: '',
        state: '',
        city: '',
        pincode: '',
        label: 'Home'
      });
      setErrors({});
      toast.success('Phone verified & Address added successfully!');
      
      // Auto-advance to next step once phone verified
      setCurrentStep(2);
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      setOtpError(err.message || 'Verification error. Please try again.');
      toast.error('An error occurred during verification.');
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent, autoAdvance = false) => {
    if (e) e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    const addressData = {
      ...newAddress,
      isDefault: addresses.length === 0,
      createdAt: new Date().toISOString()
    };

    // Direct saving
    try {
      let id = 'addr_' + Math.random().toString(36).substr(2, 9);
      if (user) {
        const { data, error } = await supabase
          .from('addresses')
          .insert({
            user_id: user.uid,
            full_name: newAddress.name,
            phone: newAddress.number,
            address_line: newAddress.address,
            landmark: newAddress.landmark,
            label: newAddress.label,
            city: newAddress.city,
            state: newAddress.state,
            zip: newAddress.pincode,
            country: 'India',
            is_default: addresses.length === 0,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) throw error;
        if (data?.id) id = data.id;
      }
      const savedAddress = { id, ...addressData };
      const updatedAddresses = [...addresses, savedAddress];
      setAddresses(updatedAddresses);
      setSelectedAddress(id);
      try {
        localStorage.setItem('user_addresses', JSON.stringify(updatedAddresses));
      } catch (e) {
        console.error("Error caching addresses:", e);
      }
      
      setShowAddressForm(false);
      setNewAddress({
        name: '',
        number: '',
        address: '',
        landmark: '',
        state: '',
        city: '',
        pincode: '',
        label: 'Home'
      });
      setErrors({});
      toast.success('Address added successfully!');
      
      if (autoAdvance) {
        setCurrentStep(2);
      }
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address. Please try again.");
    }
  };

  const handleContinueToShipping = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (showAddressForm) {
      const isFormDirty = !!(
        newAddress.name.trim() ||
        newAddress.email.trim() ||
        newAddress.number.trim() ||
        newAddress.address.trim() ||
        newAddress.landmark.trim() ||
        newAddress.state.trim() ||
        newAddress.city.trim() ||
        newAddress.pincode.trim()
      );

      if (isFormDirty) {
        // Form is partially or fully filled out, validate and save it, then advance to step 2
        await handleAddAddress(e as any, true);
      } else {
        // Form is completely empty, user likely opened it by accident or changed their mind
        setShowAddressForm(false);
        if (selectedAddress) {
          setCurrentStep(2);
        } else {
          toast.error('Please select or add a delivery address');
        }
      }
    } else {
      if (!selectedAddress) {
        toast.error('Please select a delivery address');
        return;
      }
      setCurrentStep(2);
    }
  };

  const handlePlaceOrder = async (isVerifiedOverride = false) => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setCurrentStep(1);
      return;
    }

    // Removed verification check for placing order - proceed directly to processing
    setIsProcessingPayment(true);
    setIsOrderConfirmed(false);
    
    try {
      // Get next order number using Supabase function RPC call
      let formattedOrderId;
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
      
      const orderData = {
        orderId: formattedOrderId,
        userId: user?.uid || 'guest',
        items: items.map(item => ({
          id: item.id ?? null,
          name: item.name ?? 'Unknown Item',
          price: item.price ?? 0,
          quantity: item.quantity ?? 1,
          selectedSize: item.selectedSize ?? null,
          selectedColor: item.selectedColor ?? null,
          image: (item.images && item.images[0]) ?? null
        })),
        subtotal: subtotal ?? 0,
        discount: discount ?? 0,
        shippingCost: shippingCost ?? 0,
        codFee: codFee ?? 0,
        total: finalTotal ?? 0,
        status: 'Confirmed',
        paymentMethod: selectedPayment.toUpperCase(),
        shippingMethod: selectedShippingObj?.label || 'Standard Delivery',
        email: (selectedAddrObj?.email || user?.email || '').toLowerCase(),
        customerName: selectedAddrObj?.name || user?.displayName || 'Customer',
        address: selectedAddrObj ?? null,
        createdAt: new Date().toISOString(),
        estimatedDelivery: selectedShippingObj?.time?.replace('Guaranteed in ', '') || '25 days'
      };

      const completeOrder = async (paymentId?: string) => {
        try {
          const finalOrderData = {
            ...orderData,
            paymentId: paymentId || 'COD',
            paymentStatus: paymentId ? 'Paid' : 'Pending'
          };

          // Save ONLY to Supabase
          try {
            const supabaseOrderPayload = {
              order_number: finalOrderData.orderId,
              items: finalOrderData.items,
              total: finalOrderData.total,
              status: 'pending',
              payment_method: finalOrderData.paymentMethod,
              payment_status: finalOrderData.paymentStatus,
              user_id: user?.uid || null,
              shipping_full_name: finalOrderData.customerName || finalOrderData.address?.name || 'Customer',
              shipping_phone: finalOrderData.address?.number || '',
              customer_email: finalOrderData.email || '',
              shipping_address: finalOrderData.address?.address || '',
              shipping_city: finalOrderData.address?.city || '',
              shipping_zip: finalOrderData.address?.pincode || '',
              created_at: finalOrderData.createdAt,
              subtotal: finalOrderData.subtotal,
              discount: finalOrderData.discount,
              shipping_cost: finalOrderData.shippingCost,
              cod_fee: finalOrderData.codFee,
              shipping_method: finalOrderData.shippingMethod,
              estimated_delivery: finalOrderData.estimatedDelivery,
              payment_id: finalOrderData.paymentId,
              points_redeemed: pointsToRedeem,
              points_earned: 0,
              tracking_history: []
            };

            const { error: supErr } = await supabase
              .from('orders')
              .insert(supabaseOrderPayload);

            if (supErr) {
              console.error("Supabase order insert failed:", supErr);
              toast.error("Database order placement failed. Please try again.");
              setIsOrderConfirmed(false);
              setIsProcessingPayment(false);
              throw supErr;
            } else {
              console.log("Supabase order insert success!");
              setIsOrderConfirmed(true);

              // Deduct redeemed loyalty points immediately on successful order placement
              if (pointsToRedeem > 0 && user?.uid) {
                try {
                  const newBalance = Math.max(0, userPoints - pointsToRedeem);
                  await supabase
                    .from('profiles')
                    .update({ loyalty_points: newBalance })
                    .eq('id', user.uid);

                  const cleanOrderNum = String(finalOrderData.orderId).replace(/^#/, '');
                  await supabase
                    .from('loyalty_points_log')
                    .insert({
                      user_id: user.uid,
                      points: pointsToRedeem,
                      type: 'redeemed',
                      description: `Redeemed on order #${cleanOrderNum}`,
                      created_at: new Date().toISOString()
                    });

                  if (refreshProfile) {
                    refreshProfile().catch(e => console.error("Profile refresh error:", e));
                  }
                } catch (ptsErr) {
                  console.error("Failed to process loyalty points redemption:", ptsErr);
                }
              }
              
              // Increment coupon used_count in Supabase if a promo was applied
              if (appliedPromo && appliedPromo.code) {
                try {
                  const { data: matchedCoupon } = await supabase
                    .from('coupons')
                    .select('id, used_count')
                    .ilike('code', appliedPromo.code)
                    .maybeSingle();

                  if (matchedCoupon) {
                    await supabase
                      .from('coupons')
                      .update({ used_count: (matchedCoupon.used_count || 0) + 1 })
                      .eq('id', matchedCoupon.id);
                  }
                } catch (cErr) {
                  console.error("Error updating coupon used_count:", cErr);
                }
              }
            }
          } catch (supException) {
            console.error("Exception saving order to Supabase:", supException);
            throw supException;
          }

          // Wait for a minimum of 1.2 seconds for visual satisfaction of secure processing steps
          await new Promise(resolve => setTimeout(resolve, 1200));

          const storeName = storeSettings?.storeName || 'The Ruby Fashion';

          // Build high-compatibility 100%-bulletproof HTML Table email summary (Outlook / Gmail safe)
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1C1917; line-height: 1.5;">
              <!-- Header -->
              <div style="display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px;">
                <span style="font-size: 16px; font-weight: 600; color: #1A2C54;">Order ${finalOrderData.orderId}</span>
                <span style="font-size: 16px; font-weight: 600; color: #E11D48; text-transform: lowercase;">confirmed</span>
              </div>

              <!-- Main Message -->
              <div style="margin-bottom: 35px;">
                <h1 style="font-size: 22px; font-weight: 700; color: #1A2C54; margin: 0 0 12px 0;">Thank you for your purchase!</h1>
                <p style="font-size: 15px; color: #4B5563; margin: 0;">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
              </div>

              <!-- Action Buttons -->
              <div style="margin-bottom: 45px; text-align: center;">
                <a href="${window.location.origin}/track/${(finalOrderData.orderId || '').replace('#', '')}?email=${encodeURIComponent(finalOrderData.address?.email || finalOrderData.email || '')}" 
                   style="display: inline-block; background-color: #E11D48; color: #FFFFFF; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; margin-bottom: 12px; transition: background-color 0.2s;">
                  Track Your Order
                </a>
                <p style="font-size: 13px; color: #6B7280; margin: 4px 0 0 0;">or <a href="${window.location.origin}" style="color: #1A2C54; text-decoration: underline; font-weight: 500;">Visit our store</a></p>
              </div>

              <!-- Order Summary Table (Safe across all clients including Gmail & Outlook) -->
              <div style="border-top: 1px solid #E5E7EB; padding-top: 30px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #1A2C54; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 0.5px;">Order summary</h2>
                
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
                  ${finalOrderData.items.map((item: any) => `
                    <tr style="border-bottom: 1px solid #F3F4F6;">
                      <td style="padding: 10px 0; width: 65px; vertical-align: top;">
                        <div style="width: 55px; height: 55px; background-color: #F3F4F6; overflow: hidden; border-radius: 6px; border: 1px solid #E5E7EB;">
                          ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                        </div>
                      </td>
                      <td style="padding: 10px 10px; vertical-align: top; text-align: left;">
                        <p style="font-size: 14px; font-weight: 600; color: #1C1917; margin: 0;">${item.name} &times; ${item.quantity}</p>
                        <p style="font-size: 12px; color: #6B7280; margin: 4px 0 0 0;">Size: ${item.selectedSize || 'Standard'}${item.selectedColor ? ` | Color: ${item.selectedColor}` : ''}</p>
                      </td>
                      <td style="padding: 10px 0; vertical-align: top; text-align: right; width: 85px;">
                        <p style="font-size: 14px; font-weight: 600; color: #1C1917; margin: 0;">₹${Number(item.price * item.quantity).toLocaleString()}</p>
                      </td>
                    </tr>
                  `).join('')}
                </table>

                <!-- Totals -->
                <div style="border-top: 1px solid #E5E7EB; padding-top: 20px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="font-size: 14px; color: #4B5563; padding: 5px 0;">Subtotal</td>
                      <td style="font-size: 14px; font-weight: 600; color: #1C1917; text-align: right; padding: 5px 0;">₹${Number(finalOrderData.subtotal || 0).toLocaleString()}</td>
                    </tr>
                    ${finalOrderData.discount > 0 ? `
                      <tr>
                        <td style="font-size: 14px; color: #4B5563; padding: 5px 0;">Discount</td>
                        <td style="font-size: 14px; font-weight: 600; color: #E11D48; text-align: right; padding: 5px 0;">-₹${Number(finalOrderData.discount || 0).toLocaleString()}</td>
                      </tr>
                    ` : ''}
                    <tr>
                      <td style="font-size: 14px; color: #4B5563; padding: 5px 0;">Shipping</td>
                      <td style="font-size: 14px; font-weight: 600; color: #1C1917; text-align: right; padding: 5px 0;">${finalOrderData.shippingCost === 0 ? 'FREE' : `₹${Number(finalOrderData.shippingCost || 0).toLocaleString()}`}</td>
                    </tr>
                    ${finalOrderData.codFee > 0 ? `
                      <tr>
                        <td style="font-size: 14px; color: #4B5563; padding: 5px 0;">COD Handling Fee</td>
                        <td style="font-size: 14px; font-weight: 600; color: #1C1917; text-align: right; padding: 5px 0;">₹${Number(finalOrderData.codFee || 0).toLocaleString()}</td>
                      </tr>
                    ` : ''}
                    <tr>
                      <td style="font-size: 16px; font-weight: 700; color: #1A2C54; padding: 15px 0 0 0; border-top: 1px solid #E5E7EB; margin-top: 15px;">Total</td>
                      <td style="font-size: 20px; font-weight: 700; color: #E11D48; text-align: right; padding: 15px 0 0 0; border-top: 1px solid #E5E7EB; margin-top: 15px;">₹${Number(finalOrderData.total || 0).toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>`;

          // 2. Define the 4 parallel critical notification/email tasks
          const sendCustomerPush = async () => {
            const targetUserId = user?.id || user?.uid;
            if (targetUserId) {
              try {
                // Single consolidated customer notification (🎉 Order Confirmed!)
                await sendNotification({
                  userId: targetUserId,
                  title: '🎉 Order Confirmed!',
                  body: `Hi ${finalOrderData.customerName}, your order ${finalOrderData.orderId} of ₹${Number(finalOrderData.total).toLocaleString()} has been successfully placed. We are preparing it now.`,
                  type: 'order',
                  iconType: 'package',
                  link: `/track/${finalOrderData.orderId}`
                }, false);

                console.log("Customer in-app notification logging and push notification triggered successfully");
              } catch (notifErr: any) {
                console.error("❌ [DIAGNOSTIC] Customer in-app notification logging failed! Detailed Error:", {
                  message: notifErr.message || notifErr,
                  stack: notifErr.stack
                });
              }
            }
          };

          const sendAdminPush = async () => {
            try {
              // Direct client-side trigger to ensure admin push notification is delivered 100% reliably in real time!
              // Also pass the current logged-in userId to support instant delivery on the tester's device!
              const res = await fetch('/api/send-admin-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                  title: 'New Order Received! 🛍️',
                  body: `Order ${finalOrderData.orderId} of ₹${Number(finalOrderData.total).toLocaleString()} placed by ${finalOrderData.customerName}.`,
                  url: '/admin?tab=orders',
                  userId: user?.uid
                })
              });
              if (res.ok) {
                console.log("Admin push notification sent successfully from client-side fallback");
              } else {
                console.warn("Admin push notification from client-side fallback returned non-ok status:", res.status);
              }
            } catch (pushErr) {
              console.error("Failed to trigger client-side admin push notification fallback:", pushErr);
            }
          };

          const sendCustomerEmail = async () => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds snappy timeout
              const res = await fetch('/api/send-email', {
                signal: controller.signal,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                  to: finalOrderData.email || finalOrderData.address?.email || user?.email || '',
                  from: storeSettings?.fromEmail || storeSettings?.smtpUser || undefined,
                  replyTo: storeSettings?.supportEmail || undefined,
                  subject: `Order Confirmed! ${finalOrderData.orderId?.startsWith('#') ? finalOrderData.orderId : `#${finalOrderData.orderId}`} ✨`,
                  html: emailHtml
                })
              });
              clearTimeout(timeoutId);
              if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`HTTP Error Status: ${res.status} | Response: ${errorBody}`);
              }
              const d = await res.json();
              console.log("Customer order email dispatched successfully:", d);
            } catch (err: any) {
              console.error("❌ [DIAGNOSTIC] Customer email failed! Detailed Error:", {
                message: err.message || err,
                stack: err.stack
              });
            }
          };

          const sendAdminEmail = async () => {
            try {
              // Target developer testing email as well to guarantee they see admin order notifications
              const adminEmailDestination = storeSettings?.supportEmail || "support@therubyfashion.shop";
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds snappy timeout
              const res = await fetch('/api/send-email', {
                signal: controller.signal,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                  to: adminEmailDestination,
                  from: storeSettings?.fromEmail || storeSettings?.smtpUser || undefined,
                  subject: `New Order Received! ${finalOrderData.orderId} 🛍️`,
                  html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                      <h2>New Order Received: ${finalOrderData.orderId}</h2>
                      <p><strong>Customer:</strong> ${finalOrderData.customerName}</p>
                      <p><strong>Email:</strong> ${finalOrderData.address?.email || finalOrderData.email || ''}</p>
                      <p><strong>Amount:</strong> ₹${Number(finalOrderData.total || 0).toLocaleString()}</p>
                      <p><strong>Payment:</strong> ${finalOrderData.paymentMethod}</p>
                      <br/>
                      <a href="${window.location.origin}/admin" style="background: #E11D48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Manage Order</a>
                    </div>
                  `
                })
              });
              clearTimeout(timeoutId);
              if (!res.ok) {
                const errorBody = await res.text();
                throw new Error(`HTTP Error Status: ${res.status} | Response: ${errorBody}`);
              }
              const d = await res.json();
              console.log("Admin order email dispatched successfully:", d);
            } catch (err: any) {
              console.error("❌ [DIAGNOSTIC] Admin order email failed! Detailed Error:", {
                message: err.message || err,
                stack: err.stack
              });
            }
          };

          // AWAIT all 4 parallel notification/email tasks to settle safely (success or failure) before navigating to ensure requests are not aborted by the browser
          try {
            await Promise.allSettled([
              sendCustomerPush(),
              sendAdminPush(),
              sendCustomerEmail(),
              sendAdminEmail()
            ]);
          } catch (settledError) {
            console.error("Promise.allSettled for critical communications encountered an error:", settledError);
          }

          // Clear checkout state & cart
          localStorage.removeItem('checkout_step');
          localStorage.removeItem('selected_address_id');
          clearCart();
          setIsProcessingPayment(false);

          // Navigate to success screen with smooth routing
          navigate('/order-success', {
            state: {
              ...finalOrderData,
              deliveryDate: `${new Date().toLocaleDateString('en-US', { month: 'short' })} ${new Date().getDate() + (selectedShipping === 'standard' ? 25 : selectedShipping === 'express' ? 10 : 18)}, ${new Date().getFullYear()}`
            }
          });
          toast.success('Order placed successfully!');

          // Run analytical/integrative steps in the background as fire-and-forget
          (async () => {
            // Meta Pixel Tracking
            try {
              trackPixelEvent('Purchase', {
                content_ids: items.map(i => i.id),
                content_type: 'product',
                value: finalOrderData.total,
                currency: 'INR',
                order_id: finalOrderData.orderId
              });
            } catch (pixelErr) {
              console.error('Meta Pixel tracking failed:', pixelErr);
            }

            // Sync with Google Sheets
            try {
              await syncToGoogleSheets(finalOrderData);
            } catch (sheetsErr) {
              console.error('Google Sheets sync failed:', sheetsErr);
            }

            // Clear Abandoned Cart skipped as Firestore is disabled
          })();
        } catch (error) {
          console.error("Error completing order:", error);
          toast.error("Failed to place order. Please try again.");
          setIsOrderConfirmed(false);
          setIsProcessingPayment(false);
        }
      };

      if (selectedPayment === 'upi') {
        // Dynamic On-The-Fly Razorpay Script Loader
        await new Promise((resolve) => {
          if ((window as any).Razorpay) {
            resolve(true);
            return;
          }
          console.log("🔗 Dynamically loading Razorpay checkout script...");
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => {
            console.log("✅ Razorpay script loaded successfully");
            resolve(true);
          };
          script.onerror = () => {
            console.error("❌ Failed to load Razorpay script");
            resolve(false);
          };
          document.body.appendChild(script);
        });

        let razorpayKey = (import.meta as any).env.VITE_RAZORPAY_KEY_ID;
        
        // If not in env, try to fetch from server
        if (!razorpayKey) {
          try {
            const configRes = await fetch('/api/payment-config');
            const configData = await configRes.json();
            razorpayKey = configData.razorpayKeyId;
            
            if (!razorpayKey) {
              const { diagnostics } = configData;
              let errorMsg = 'Razorpay Key ID is missing.';
              
              if (!diagnostics?.serverHasViteKey && !diagnostics?.serverHasSecretKey) {
                errorMsg += ' Server sees NO Razorpay keys. Did you click DEPLOY after adding Secrets?';
              } else if (!diagnostics?.serverHasSecretKey) {
                errorMsg += ' Key ID found, but Secret Key is missing on server.';
              }
              
              toast.error(errorMsg, { duration: 6000 });
              setIsProcessingPayment(false);
              return;
            }
          } catch (err) {
            console.error("Failed to fetch payment config:", err);
          }
        }

        try {
          // Create order on server first
          const orderResponse = await fetch('/api/create-razorpay-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: Math.round(finalTotal * 100),
              currency: 'INR',
              receipt: formattedOrderId
            })
          });

          const orderData = await orderResponse.json();

          if (!orderResponse.ok) {
            throw new Error(orderData.error || 'Failed to create order');
          }

          const options = {
            key: razorpayKey,
            amount: orderData.amount,
            currency: orderData.currency,
            name: storeSettings?.storeName || 'The Ruby Fashion',
            description: `Order ${formattedOrderId}`,
            image: storeSettings?.storeLogo || 'https://cdn-icons-png.flaticon.com/512/2909/2909813.png',
            order_id: orderData.id,
            handler: async function (response: any) {
              await completeOrder(response.razorpay_payment_id);
            },
            prefill: {
              name: selectedAddrObj?.name,
              email: selectedAddrObj?.email,
              contact: selectedAddrObj?.number,
            },
            theme: {
              color: '#E11D48',
            },
            modal: {
              ondismiss: function() {
                setIsProcessingPayment(false);
                setIsOrderConfirmed(false);
                toast.info("Payment cancelled. You can try again.");
              }
            }
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (response: any) {
            toast.error(response.error?.description || 'Payment failed. Please try again.');
            setIsProcessingPayment(false);
            setIsOrderConfirmed(false);
          });
          rzp.open();
        } catch (e: any) {
          console.error('Razorpay initialization failed:', e);
          toast.error(e.message || 'Failed to initialize payment gateway. Please try again.');
          setIsProcessingPayment(false);
        }
      } else {
        // Cash on Delivery
        await completeOrder();
      }
    } catch (error) {
      console.error("Error generating order ID:", error);
      toast.error("Failed to generate order ID. Please try again.");
      setIsProcessingPayment(false);
    }
  };

  return (
    <div id="checkout" className="bg-gray-50 min-h-screen pb-24">
      {/* Header - Not Sticky */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-[5%] h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="text-2xl sm:text-3xl font-serif italic text-ruby">The Ruby Fashion</Link>
          <button 
            onClick={() => navigate('/cart')} 
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#1A2C54] hover:text-ruby transition-colors"
          >
            ← Back to Cart
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <div className="checkout-main">
          {/* Stepper */}
          <div className="checkout-steps bg-white rounded-[2rem] p-8 border border-gray-100 mb-10 shadow-sm">
            <div className="steps-bar flex items-center mb-8">
              {STEPS.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="step-item flex flex-col items-center gap-2 flex-1">
                    <div className={cn(
                      "step-circle w-10 h-10 rounded-full border-2 flex items-center justify-center text-[13px] font-bold transition-all duration-300 shadow-sm",
                      currentStep === step.id ? "bg-ruby border-ruby text-white ring-4 ring-ruby/10" : 
                      currentStep > step.id ? "bg-green-500 border-green-500 text-white" : 
                      "bg-white border-gray-100 text-gray-300"
                    )}>
                      {currentStep > step.id ? '✓' : step.id}
                    </div>
                    <span className={cn(
                      "step-label text-[10px] font-bold uppercase tracking-widest transition-colors",
                      currentStep === step.id ? "text-ruby" : 
                      currentStep > step.id ? "text-green-500" : 
                      "text-gray-400"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn(
                      "step-line flex-1 h-[2px] mb-6 transition-all duration-300",
                      currentStep > step.id ? "bg-green-500" : "bg-gray-100"
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {currentStep === 1 ? (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-[#1A2C54]">Delivery Address</h2>
                  
                  <div className="address-options flex flex-col gap-4">
                    {loadingAddresses ? (
                      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-gray-100">
                        <LoadingSpinner />
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-4">Loading Addresses...</p>
                      </div>
                    ) : addresses.length > 0 ? (
                      addresses.map((addr) => (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddress(addr.id)}
                        className={cn(
                          "addr-card p-6 border-[1.5px] rounded-[1.5rem] cursor-pointer transition-all duration-200 relative",
                          selectedAddress === addr.id ? "border-ruby bg-ruby/5 shadow-lg shadow-ruby/5" : "border-gray-100 hover:border-ruby/30"
                        )}
                      >
                        <div className="addr-card-top flex items-center gap-3 mb-2">
                          <span className="addr-name text-[16px] font-bold text-[#1A2C54]">{addr.name}</span>
                          <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {addr.label}
                          </span>
                        </div>
                        <p className="addr-text text-sm text-gray-400 leading-relaxed font-medium">
                          {addr.address}, {addr.landmark && `${addr.landmark}, `}{addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="text-sm text-[#1A2C54] font-bold mt-3 flex items-center gap-2">
                          <span className="text-gray-300">📞</span>
                          {addr.number}
                        </p>
                        <div className={cn(
                          "addr-radio absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedAddress === addr.id ? "border-ruby bg-ruby" : "border-gray-200"
                        )}>
                          {selectedAddress === addr.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    ))
                  ) : null}

                  {!showAddressForm ? (
                      <button 
                        onClick={() => setShowAddressForm(true)}
                        className="add-address flex items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-[1.5rem] text-sm text-gray-400 cursor-pointer transition-all duration-200 hover:border-ruby hover:text-ruby group"
                      >
                        <Plus size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-bold uppercase tracking-widest">Add New Address</span>
                      </button>
                    ) : (
                      <motion.form 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleAddAddress}
                        className="bg-white border border-ruby/20 rounded-[2rem] p-8 space-y-6 shadow-xl shadow-ruby/5"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-[#1A2C54]">Add New Address</h3>
                          <button 
                            type="button"
                            onClick={() => setShowAddressForm(false)}
                            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-ruby"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Full Name</label>
                            <input 
                              type="text" 
                              required
                              value={newAddress.name}
                              onChange={e => {
                                setNewAddress({...newAddress, name: e.target.value});
                                if (errors.name) setErrors({...errors, name: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.name ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="Enter your name"
                            />
                            {errors.name && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.name}</p>}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Phone Number</label>
                            <input 
                              type="tel" 
                              required
                              value={newAddress.number}
                              onChange={e => {
                                setNewAddress({...newAddress, number: e.target.value});
                                if (errors.number) setErrors({...errors, number: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.number ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="10-digit mobile number"
                            />
                            {errors.number && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.number}</p>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Address</label>
                          <textarea 
                            required
                            value={newAddress.address}
                            onChange={e => {
                              setNewAddress({...newAddress, address: e.target.value});
                              if (errors.address) setErrors({...errors, address: ''});
                            }}
                            className={cn(
                              "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all min-h-[100px]",
                              errors.address ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                            )}
                            placeholder="House No, Building, Street"
                          />
                          {errors.address && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.address}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Landmark</label>
                            <input 
                              type="text" 
                              value={newAddress.landmark}
                              onChange={e => setNewAddress({...newAddress, landmark: e.target.value})}
                              className="w-full bg-gray-50 border border-gray-100 px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-ruby/10 transition-all"
                              placeholder="E.g. Near Apollo Hospital"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pincode</label>
                            <input 
                              type="number" 
                              required
                              value={newAddress.pincode}
                              onChange={e => {
                                setNewAddress({...newAddress, pincode: e.target.value});
                                if (errors.pincode) setErrors({...errors, pincode: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.pincode ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="6-digit pincode"
                            />
                            {errors.pincode && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.pincode}</p>}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">City</label>
                            <input 
                              type="text" 
                              required
                              value={newAddress.city}
                              onChange={e => {
                                setNewAddress({...newAddress, city: e.target.value});
                                if (errors.city) setErrors({...errors, city: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.city ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="Enter city"
                            />
                            {errors.city && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.city}</p>}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">State</label>
                            <input 
                              type="text" 
                              required
                              value={newAddress.state}
                              onChange={e => {
                                setNewAddress({...newAddress, state: e.target.value});
                                if (errors.state) setErrors({...errors, state: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.state ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="Enter state"
                            />
                            {errors.state && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.state}</p>}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Address Label</label>
                          <div className="flex gap-3">
                            {(['Home', 'Office', 'Other'] as const).map((label) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setNewAddress({ ...newAddress, label })}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                                  newAddress.label === label 
                                    ? "bg-ruby text-white border-ruby shadow-lg shadow-ruby/20" 
                                    : "bg-gray-50 text-gray-400 border-gray-100 hover:border-ruby/30"
                                )}
                              >
                                {label === 'Home' && <Home size={14} className="inline mr-2 mb-0.5" />}
                                {label === 'Office' && <Briefcase size={14} className="inline mr-2 mb-0.5" />}
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button 
                          type="submit"
                          className="w-full bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95"
                        >
                          Save Address
                        </button>
                      </motion.form>
                    )}

                    {/* Phone OTP Verification Modal */}
                    <AnimatePresence>
                      {isVerifyingOtp && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6"
                          >
                            <div className="text-center space-y-2">
                              <div className="mx-auto w-12 h-12 bg-ruby/5 text-ruby rounded-full flex items-center justify-center">
                                <Smartphone size={24} />
                              </div>
                              <h3 className="text-xl font-bold text-[#1A2C54]">Verify Your Phone Number</h3>
                              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                                Enter the 6-digit verification code sent to your phone to verify and save your address:
                              </p>
                            </div>

                            <form onSubmit={handleVerifyOtpAndSave} className="space-y-4">
                              <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                                  Enter OTP Code
                                </label>
                                <input 
                                  type="text" 
                                  maxLength={6}
                                  pattern="\d{6}"
                                  placeholder="------"
                                  value={otpCode}
                                  onChange={(e) => {
                                    setOtpCode(e.target.value.replace(/\D/g, ''));
                                    setOtpError('');
                                  }}
                                  className="w-full text-center bg-gray-50 border border-gray-100 focus:border-ruby/20 px-4 py-4 rounded-2xl text-2xl font-bold tracking-[0.75em] placeholder-gray-300 focus:ring-4 focus:ring-ruby/5 focus:outline-none transition-all"
                                  required
                                  disabled={isOtpSubmitting}
                                  autoFocus
                                />
                                {otpError && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 bg-red-50 border border-red-200/60 p-4 rounded-2xl text-red-800 text-xs font-semibold text-left shadow-sm"
                                  >
                                    <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">⚠️</span>
                                    <span>{otpError}</span>
                                  </motion.div>
                                )}
                              </div>

                              <button 
                                type="submit"
                                disabled={isOtpSubmitting || otpCode.length < 4}
                                className="w-full bg-ruby text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {isOtpSubmitting ? 'Verifying OTP...' : 'Verify & Save Address'}
                              </button>
                            </form>

                            <div className="flex flex-col items-center gap-3 pt-2 text-center border-t border-gray-50">
                              <button 
                                type="button"
                                onClick={() => handleSendOtpCode(otpSentTo)}
                                disabled={isOtpSending || otpCountdown > 0}
                                className="text-[11px] font-black uppercase tracking-wider text-ruby hover:text-black transition-all disabled:text-gray-400"
                              >
                                {isOtpSending 
                                  ? 'Resending OTP...' 
                                  : otpCountdown > 0 
                                    ? `Resend Code in ${otpCountdown}s` 
                                    : 'Resend Code via SMS'}
                              </button>

                              <button 
                                type="button"
                                onClick={() => {
                                  setIsVerifyingOtp(false);
                                  setPendingAddress(null);
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-ruby transition-all"
                              >
                                Cancel & Edit Address
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="step-nav flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button 
                      onClick={handleContinueToShipping}
                      className="flex-1 bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95"
                    >
                      Continue to Shipping
                    </button>
                  </div>
                </motion.div>
              ) : currentStep === 2 ? (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-[#1A2C54]">Shipping Method</h2>
                  
                  <div className="shipping-options flex flex-col gap-4">
                    {shippingOptions.map((option) => (
                      <div
                        key={option.id}
                        onClick={() => setSelectedShipping(option.id)}
                        className={cn(
                          "shipping-opt p-6 border-[1.5px] rounded-[1.5rem] cursor-pointer flex items-center gap-6 transition-all duration-200",
                          selectedShipping === option.id ? "border-ruby bg-ruby/5 shadow-lg shadow-ruby/5" : "border-gray-100 hover:border-ruby/30"
                        )}
                      >
                        <div className="shipping-icon text-3xl">{option.icon}</div>
                        <div className="flex-grow">
                          <h4 className="shipping-name text-[16px] font-bold text-[#1A2C54]">{option.label}</h4>
                          <p className="shipping-days text-sm text-gray-400 font-medium">{option.time}</p>
                        </div>
                        <div className="shipping-price text-[16px] font-bold text-ruby">
                          {option.price}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="step-nav flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button 
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95"
                    >
                      Review Order
                    </button>
                  </div>
                </motion.div>
              ) : currentStep === 3 ? (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <h2 className="text-xl font-bold text-[#1A2C54]">Review Your Order</h2>
                  
                  <div className="space-y-6">
                    {/* Delivery Address Review */}
                    <div className="bg-gray-50 rounded-[2rem] p-8 space-y-4 border border-gray-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Delivery Address</p>
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-2xl text-ruby shadow-sm">
                          <MapPin size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-[#1A2C54] text-[16px]">{selectedAddrObj?.name}</p>
                          <p className="text-sm text-gray-400 font-medium leading-relaxed">
                            {selectedAddrObj?.address}, {selectedAddrObj?.landmark && `${selectedAddrObj?.landmark}, `}
                            {selectedAddrObj?.city}, {selectedAddrObj?.state} - {selectedAddrObj?.pincode}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Method Review */}
                    <div className="bg-gray-50 rounded-[2rem] p-8 space-y-4 border border-gray-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shipping Method</p>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{selectedShippingObj?.icon}</div>
                        <p className="text-sm font-bold text-[#1A2C54]">
                          {selectedShippingObj?.label} • {selectedShippingObj?.time}
                        </p>
                      </div>
                    </div>

                    {/* Order Items Review - MOVED FROM SIDEBAR */}
                    <div className="bg-gray-50 rounded-[2rem] p-8 space-y-6 border border-gray-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Items</p>
                      <div className="space-y-6">
                        {items.map((item) => (
                          <div key={`${item.id}-${item.selectedSize}-${item.selectedColor || ''}`} className="flex items-center gap-4">
                            <div className="w-16 h-20 bg-white rounded-2xl overflow-hidden flex-shrink-0 shadow-sm">
                              {item.images[0] ? (
                                <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200">
                                  <ShoppingBag size={20} />
                                </div>
                              )}
                            </div>
                            <div className="flex-grow space-y-1">
                              <h4 className="text-sm font-bold text-[#1A2C54]">{item.name}</h4>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Size {item.selectedSize} • {item.selectedColor || 'Default'} • Qty {item.quantity}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-ruby">{formatPrice(Number(item.price * item.quantity))}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Loyalty Points Redemption Toggle Card */}
                    {user && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 rounded-[2rem] p-6 border border-amber-200/60 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                              <Sparkles size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#1A2C54]">Use Loyalty Points</h4>
                              <p className="text-xs text-amber-800 font-medium">Available: <strong className="text-amber-900 font-black">{userPoints} pts</strong></p>
                            </div>
                          </div>
                          
                          {canRedeemPoints ? (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={useLoyaltyPoints} 
                                onChange={(e) => setUseLoyaltyPoints(e.target.checked)} 
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                            </label>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                              Min 100 pts
                            </span>
                          )}
                        </div>

                        {canRedeemPoints && useLoyaltyPoints && (
                          <div className="bg-white/90 rounded-xl p-3 border border-amber-200 flex items-center justify-between text-xs text-amber-900 font-semibold shadow-sm">
                            <span>Redeeming {pointsToRedeem} points for discount</span>
                            <span className="text-emerald-600 font-bold font-syne text-sm">-₹{pointsDiscount} OFF</span>
                          </div>
                        )}

                        {!canRedeemPoints && (
                          <p className="text-[11px] text-amber-700/90 leading-relaxed font-medium">
                            You need at least 100 loyalty points to redeem discounts at checkout (100 pts = ₹10 off). Earn points on every delivered order!
                          </p>
                        )}
                      </div>
                    )}

                    {/* Price Breakdown Review - MOVED FROM SIDEBAR */}
                    <div className="bg-gray-50 rounded-[2rem] p-8 space-y-6 border border-gray-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price Breakdown</p>
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm font-medium text-gray-400">
                          <span>Subtotal</span>
                          <span className="font-bold text-[#1A2C54]">{formatPrice(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm font-bold text-ruby">
                            <span>Promo Discount</span>
                            <span>-{formatPrice(discount)}</span>
                          </div>
                        )}
                        {pointsDiscount > 0 && (
                          <div className="flex justify-between text-sm font-bold text-emerald-600">
                            <span className="flex items-center gap-1.5">
                              <Sparkles size={14} /> Loyalty Discount ({pointsToRedeem} pts)
                            </span>
                            <span>-{formatPrice(pointsDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-medium text-gray-400">
                          <span>Shipping</span>
                          <span className={cn("font-bold", shippingCost === 0 ? "text-green-500" : "text-[#1A2C54]")}>
                            {shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                          </span>
                        </div>
                        <div className="pt-6 border-t border-gray-200 flex justify-between items-end">
                          <p className="text-lg font-bold text-[#1A2C54]">Order Total</p>
                          <p className="text-2xl font-bold text-ruby">{formatPrice(finalTotal)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="step-nav flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button 
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => setCurrentStep(4)}
                      className="flex-1 bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95"
                    >
                      Continue to Payment
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <button 
                      onClick={() => setCurrentStep(3)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-ruby transition-colors mb-4 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100"
                    >
                      <ChevronLeft size={12} strokeWidth={3} /> Change Review
                    </button>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-[#1A2C54]">Payment Method</h2>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select how you'd like to pay</p>
                    </div>
                  </div>
                  
                  <div className="payment-options flex flex-col gap-4">
                    <div
                      onClick={() => setSelectedPayment('upi')}
                      className={cn(
                        "payment-opt p-6 border-[1.5px] rounded-[1.5rem] cursor-pointer flex items-center gap-4 transition-all duration-200",
                        selectedPayment === 'upi' ? "border-ruby bg-ruby/5 shadow-lg shadow-ruby/5" : "border-gray-100 hover:border-ruby/30"
                      )}
                    >
                      <div className="payment-icon p-3 bg-white rounded-2xl text-ruby shadow-sm"><Smartphone size={24} /></div>
                      <div className="flex-grow">
                        <span className="payment-name block text-[16px] font-bold text-[#1A2C54]">UPI / Wallets</span>
                      </div>
                      <div className={cn(
                        "pay-radio w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedPayment === 'upi' ? "border-ruby bg-ruby" : "border-gray-200"
                      )}>
                        {selectedPayment === 'upi' && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedPayment('cod')}
                      className={cn(
                        "payment-opt p-6 border-[1.5px] rounded-[1.5rem] cursor-pointer flex items-center gap-4 transition-all duration-200",
                        selectedPayment === 'cod' ? "border-ruby bg-ruby/5 shadow-lg shadow-ruby/5" : "border-gray-100 hover:border-ruby/30"
                      )}
                    >
                      <div className="payment-icon p-3 bg-white rounded-2xl text-ruby shadow-sm"><Handshake size={24} /></div>
                      <div className="flex-grow">
                        <span className="payment-name block text-[16px] font-bold text-[#1A2C54]">Cash on Delivery</span>
                      </div>
                      <div className={cn(
                        "pay-radio w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedPayment === 'cod' ? "border-ruby bg-ruby" : "border-gray-200"
                      )}>
                        {selectedPayment === 'cod' && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </div>

                  {/* COD Notice */}
                  <AnimatePresence mode="wait">
                    {selectedPayment === 'cod' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-ruby/5 border border-ruby/10 rounded-2xl p-4 flex items-start gap-3"
                      >
                        <div className="p-2 bg-white rounded-xl text-ruby shadow-sm">
                          <Check size={16} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-ruby">COD Handling Fee Notice</p>
                          <p className="text-[11px] text-[#1A2C54] leading-relaxed">
                            ₹80 will be added for Cash on Delivery. To avoid this charge, please pay online using UPI or Cards.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Secure Badge */}
                  <div className="bg-white rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-300 border border-gray-50">
                    <Lock size={14} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">100% Secure Checkout • Powered by Razorpay</span>
                  </div>

                  <div className="step-nav mt-8">
                    <SwipeButton 
                      price={finalTotal}
                      onConfirm={handlePlaceOrder}
                      isLoading={isProcessingPayment}
                      disabled={isProcessingPayment || isOrderConfirmed}
                      isConfirmed={isOrderConfirmed}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
