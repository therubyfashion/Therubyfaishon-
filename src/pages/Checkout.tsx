import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { cn, syncToGoogleSheets } from '../lib/utils';
import { ChevronLeft, ShoppingBag, MapPin, Home, Briefcase, Plus, CheckCircle2, Lock, Smartphone, Building2, Handshake } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PhoneVerification from '../components/PhoneVerification';
import { LoadingSpinner } from '../components/Skeleton';

const STEPS = [
  { id: 1, label: 'Address' },
  { id: 2, label: 'Shipping' },
  { id: 3, label: 'Review' },
  { id: 4, label: 'Payment' }
];

const MOCK_ADDRESSES = [
  {
    id: '1',
    type: 'Home',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    isDefault: true,
    address: 'Flat 402, Sunshine Apartments, Bandra West, Mumbai — 400050',
    number: '+91 98765 43210'
  },
  {
    id: '2',
    type: 'Office',
    name: 'Office',
    email: 'office@company.com',
    isDefault: false,
    address: 'Level 8, One BKC Tower, Bandra Kurla Complex, Mumbai — 400051',
    number: '+91 98765 43210'
  }
];

export default function Checkout() {
  const { items, total, itemCount, appliedPromo, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showPhoneVerify, setShowPhoneVerify] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const { profile } = useAuth();

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        setLoadingAddresses(false);
        return;
      }
      try {
        const querySnapshot = await getDocs(collection(db, `users/${user.uid}/addresses`));
        const fetchedAddresses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
        setAddresses(fetchedAddresses);
        if (fetchedAddresses.length > 0 && !selectedAddress) {
          const defaultAddr = fetchedAddresses.find(a => a.isDefault) || fetchedAddresses[0];
          setSelectedAddress(defaultAddr.id);
        }
      } catch (error) {
        console.error("Error fetching addresses:", error);
      } finally {
        setLoadingAddresses(false);
      }
    };
    fetchAddresses();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'settings'));
        if (!querySnapshot.empty) {
          setStoreSettings(querySnapshot.docs[0].data());
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
    localStorage.setItem('user_addresses', JSON.stringify(addresses));
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
    email: '',
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
    { id: 'express', label: '7 Day Delivery', time: 'Guaranteed in 7 days', price: '₹120', icon: '⚡', cost: 120 },
    { id: 'economy', label: '15 Day Delivery', time: 'Guaranteed in 15 days', price: '₹50', icon: '📦', cost: 50 },
  ];

  const selectedAddrObj = addresses.find(a => a.id === selectedAddress);
  const selectedShippingObj = shippingOptions.find(o => o.id === selectedShipping);

  const subtotal = total;
  const discount = appliedPromo ? appliedPromo.discount : 0;
  const shippingCost = selectedShippingObj?.cost || 0;
  const finalTotal = subtotal - discount + shippingCost;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!/^[a-zA-Z\s]{3,50}$/.test(newAddress.name)) {
      newErrors.name = 'Please enter a valid name (3-50 characters, letters only)';
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAddress.email)) {
      newErrors.email = 'Please enter a valid email address';
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

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    const addressData = {
      ...newAddress,
      isDefault: addresses.length === 0,
      createdAt: new Date().toISOString()
    };

    // If phone is not verified, trigger verification first
    if (!profile?.phoneVerified) {
      setPendingAddress(addressData);
      setShowPhoneVerify(true);
      
      // Also trigger email verification if not verified
      if (user && !user.emailVerified) {
        try {
          const { sendEmailVerification } = await import('firebase/auth');
          await sendEmailVerification(user);
          toast.info('A verification email has been sent to your Gmail. Please verify it for secure checkout.');
        } catch (err) {
          console.error("Email verify error:", err);
        }
      }
      return;
    }

    try {
      if (user) {
        const docRef = await addDoc(collection(db, `users/${user.uid}/addresses`), addressData);
        const savedAddress = { id: docRef.id, ...addressData };
        setAddresses([...addresses, savedAddress]);
        setSelectedAddress(docRef.id);
      } else {
        // Guest mode fallback
        const guestId = Math.random().toString(36).substr(2, 9);
        const savedAddress = { id: guestId, ...addressData };
        setAddresses([...addresses, savedAddress]);
        setSelectedAddress(guestId);
      }
      
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
      toast.success('Address added successfully!');
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address. Please try again.");
    }
  };

  const handlePlaceOrder = async (isVerifiedOverride = false) => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      setCurrentStep(1);
      return;
    }

    // Check if phone is verified
    if (!profile?.phoneVerified && !isVerifiedOverride) {
      setShowPhoneVerify(true);
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      // Get next order number using transaction
      const counterRef = doc(db, 'counters', 'orders');
      const orderNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNum = 1;
        if (counterDoc.exists()) {
          nextNum = counterDoc.data().count + 1;
          transaction.update(counterRef, { count: nextNum });
        } else {
          transaction.set(counterRef, { count: 1 });
        }
        return nextNum;
      });

      const formattedOrderId = `#${orderNumber.toString().padStart(4, '0')}`;
      
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
        total: finalTotal ?? 0,
        status: 'Confirmed',
        paymentMethod: selectedPayment.toUpperCase(),
        shippingMethod: selectedShippingObj?.label || 'Standard Delivery',
        email: selectedAddrObj?.email || user?.email || '',
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

          await addDoc(collection(db, 'orders'), finalOrderData);
          
          // Trigger Admin Push Notification via OneSignal
          try {
            await fetch('/api/send-admin-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: 'New Order Received! 🛍️',
                body: `You received order ${finalOrderData.orderId} from ${finalOrderData.address.name}`,
                url: '/admin'
              })
            });
          } catch (e) {
            console.error("Failed to send admin push notification:", e);
          }

          await syncToGoogleSheets(finalOrderData);

          // Clear checkout state
          localStorage.removeItem('checkout_step');
          localStorage.removeItem('selected_address_id');

          // Send Email Notification
          try {
            const settingsSnap = await getDocs(collection(db, 'settings'));
            if (!settingsSnap.empty) {
              const settingsData = settingsSnap.docs[0].data();
              if ((settingsData.resendApiKey || (settingsData.smtpUser && settingsData.smtpPass)) && finalOrderData.address?.email) {
                const emailHtml = `
                  <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAFAFA; padding: 40px 20px; color: #1A2C54;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 40px; padding: 60px; box-shadow: 0 20px 50px -20px rgba(0,0,0,0.08); border: 1px solid #F0F0F0;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px;">
                        <div>
                          ${settingsData.storeLogo ? `<img src="${settingsData.storeLogo}" alt="${settingsData.storeName}" style="max-height: 50px; margin-bottom: 10px;">` : `<h1 style="font-size: 24px; font-weight: bold; letter-spacing: -1px; margin: 0; color: #E11D48;">${settingsData.storeName?.toUpperCase() || 'THE RUBY'}</h1>`}
                        </div>
                        <div style="text-align: right;">
                          <h1 style="font-size: 14px; font-weight: bold; color: #9CA3AF; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Tax Invoice</h1>
                          <p style="font-size: 12px; color: #1A2C54; font-weight: bold; margin: 4px 0 0 0;">${finalOrderData.orderId?.startsWith('#') ? finalOrderData.orderId : `#${finalOrderData.orderId}`}</p>
                        </div>
                      </div>
                      
                      <div style="text-align: center; margin-bottom: 40px;">
                        <div style="display: inline-block; background-color: #FDF2F8; color: #E11D48; padding: 12px 24px; border-radius: 100px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px;">Order Confirmed</div>
                        <h2 style="font-size: 28px; font-weight: bold; margin: 0 0 16px 0; color: #1A2C54;">Thank you for your order, ${finalOrderData.address.name}!</h2>
                        <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0;">We've received your order and our team is already working on getting it to you. Here's your official tax invoice.</p>
                      </div>

                      <div style="background-color: #F9FAFB; border-radius: 24px; padding: 32px; margin-bottom: 40px; border: 1px solid #F3F4F6;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #E5E7EB; padding-bottom: 16px;">
                          <div style="flex: 1;">
                            <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin: 0 0 8px 0;">Date</p>
                            <p style="font-size: 14px; font-weight: bold; color: #1A2C54; margin: 0;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          </div>
                          <div style="flex: 1; text-align: right;">
                            <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin: 0 0 8px 0;">Payment Method</p>
                            <p style="font-size: 14px; font-weight: bold; color: #1A2C54; margin: 0;">${finalOrderData.paymentId === 'COD' ? 'Cash on Delivery' : 'Prepaid (Razorpay)'}</p>
                          </div>
                        </div>

                        <div style="margin-bottom: 24px;">
                          <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin: 0 0 12px 0;">Items Summary</p>
                          ${finalOrderData.items.map((item: any) => `
                            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                              <div style="width: 50px; height: 60px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; margin-right: 16px; border: 1px solid #E5E7EB;">
                                ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                              </div>
                              <div style="flex: 1;">
                                <p style="font-size: 14px; font-weight: bold; color: #1A2C54; margin: 0;">${item.name}</p>
                                <p style="font-size: 11px; color: #9CA3AF; margin: 2px 0 0 0;">SKU: ${item.sku || '-'} • Barcode: ${item.barcode || '-'}</p>
                                <p style="font-size: 12px; color: #666666; margin: 4px 0 0 0;">Size: ${item.selectedSize} • Qty: ${item.quantity}</p>
                              </div>
                              <div style="text-align: right;">
                                <p style="font-size: 14px; font-weight: bold; color: #E11D48; margin: 0;">₹${(item.price * item.quantity).toLocaleString()}</p>
                              </div>
                            </div>
                          `).join('')}
                        </div>

                        <div style="border-top: 1px solid #E5E7EB; padding-top: 24px;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <p style="font-size: 14px; color: #666666; margin: 0;">Subtotal</p>
                            <p style="font-size: 14px; font-weight: bold; color: #1A2C54; margin: 0;">₹${finalOrderData.subtotal.toLocaleString()}</p>
                          </div>
                          ${finalOrderData.discount > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                              <p style="font-size: 14px; color: #E11D48; margin: 0;">Discount</p>
                              <p style="font-size: 14px; font-weight: bold; color: #E11D48; margin: 0;">-₹${finalOrderData.discount.toLocaleString()}</p>
                            </div>
                          ` : ''}
                          <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                            <p style="font-size: 14px; color: #666666; margin: 0;">Shipping</p>
                            <p style="font-size: 14px; font-weight: bold; color: #1A2C54; margin: 0;">${finalOrderData.shippingCost === 0 ? 'FREE' : `₹${finalOrderData.shippingCost.toLocaleString()}`}</p>
                          </div>
                          <div style="display: flex; justify-content: space-between; border-top: 2px solid #1A2C54; padding-top: 16px;">
                            <p style="font-size: 18px; font-weight: bold; color: #1A2C54; margin: 0;">Total Amount</p>
                            <p style="font-size: 24px; font-weight: bold; color: #E11D48; margin: 0;">₹${finalOrderData.total.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      <div style="margin-bottom: 40px;">
                        <p style="font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #9CA3AF; margin: 0 0 12px 0;">Billing & Shipping Address</p>
                        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0;">
                          <strong>${finalOrderData.address.name}</strong><br/>
                          ${finalOrderData.address.address}, ${finalOrderData.address.landmark ? finalOrderData.address.landmark + ', ' : ''}<br/>
                          ${finalOrderData.address.city}, ${finalOrderData.address.state} - ${finalOrderData.address.pincode}<br/>
                          Phone: ${finalOrderData.address.number}
                        </p>
                      </div>

                      <div style="text-align: center; border-top: 1px solid #F0F0F0; padding-top: 40px;">
                        <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 24px;">Need help with your order? Reply to this email or visit our support center.</p>
                        <div style="margin-bottom: 32px;">
                          <a href="${window.location.origin}/profile" style="display: inline-block; background-color: #1A2C54; color: #FFFFFF; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 20px -5px rgba(26,44,84,0.3);">Track Your Order</a>
                        </div>
                        <p style="font-size: 16px; font-weight: bold; color: #1A2C54; margin: 0;">Happy Shopping!</p>
                        <p style="font-size: 14px; color: #E11D48; font-weight: bold; margin: 4px 0 0 0;">Team ${settingsData.storeName || 'The Ruby'}</p>
                      </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 40px;">
                      <p style="font-size: 12px; color: #9CA3AF;">&copy; ${new Date().getFullYear()} ${settingsData.storeName || 'The Ruby'}. All rights reserved.</p>
                    </div>
                  </div>
                `;
                  const emailResponse = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: finalOrderData.address.email,
                      from: settingsData.fromEmail || undefined,
                      replyTo: settingsData.supportEmail || undefined,
                      subject: `Order Confirmed! ${finalOrderData.orderId?.startsWith('#') ? finalOrderData.orderId : `#${finalOrderData.orderId}`} ✨`,
                      html: emailHtml
                    })
                  });

                  if (emailResponse.ok) {
                    console.log('Order confirmation email sent successfully');
                  } else {
                    const errorData = await emailResponse.json();
                    console.error('Failed to send order confirmation email:', errorData);
                  }
                } else {
                  console.warn('Email skipped: Missing configuration or customer email', {
                    hasResend: !!settingsData.resendApiKey,
                    hasSmtp: !!(settingsData.smtpUser && settingsData.smtpPass),
                    hasCustomerEmail: !!finalOrderData.address?.email
                  });
                }
              }
            } catch (emailError) {
              console.error('Error in email notification flow:', emailError);
            }

          setIsProcessingPayment(false);
          navigate('/order-success', {
            state: {
              ...finalOrderData,
              deliveryDate: `Apr ${new Date().getDate() + (selectedShipping === 'standard' ? 25 : selectedShipping === 'express' ? 7 : 15)}, 2025`
            }
          });
          toast.success('Order placed successfully!');
          clearCart();
        } catch (error) {
          console.error("Error completing order:", error);
          toast.error("Failed to place order. Please try again.");
          setIsProcessingPayment(false);
        }
      };

      if (selectedPayment === 'upi') {
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
            name: storeSettings?.storeName || 'The Ruby',
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
              }
            }
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (response: any) {
            toast.error(response.error.description);
            setIsProcessingPayment(false);
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
          <Link to="/" className="text-2xl sm:text-3xl font-serif italic text-ruby">The Ruby</Link>
          <button 
            onClick={() => navigate('/cart')} 
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#1A2C54] hover:text-ruby transition-colors"
          >
            ← Back to Cart
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 sm:pt-12">
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

            {/* Phone Verification Modal */}
            <AnimatePresence>
              {showPhoneVerify && (
                <PhoneVerification 
                  prefillPhone={pendingAddress?.number || newAddress.number}
                  onClose={() => {
                    setShowPhoneVerify(false);
                    setPendingAddress(null);
                  }}
                  onSuccess={async () => {
                    setShowPhoneVerify(false);
                    if (pendingAddress) {
                      try {
                        let savedAddress;
                        if (user) {
                          const docRef = await addDoc(collection(db, `users/${user.uid}/addresses`), pendingAddress);
                          savedAddress = { id: docRef.id, ...pendingAddress };
                          setSelectedAddress(docRef.id);
                        } else {
                          const guestId = Math.random().toString(36).substr(2, 9);
                          savedAddress = { id: guestId, ...pendingAddress };
                          setSelectedAddress(guestId);
                        }
                        
                        setAddresses([...addresses, savedAddress]);
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
                        setPendingAddress(null);
                        toast.success('Phone verified & Address added! 🎉');
                      } catch (error) {
                        console.error("Error saving address after verification:", error);
                        toast.error("Phone verified but failed to save address.");
                      }
                    } else {
                      handlePlaceOrder(true);
                    }
                  }}
                />
              )}
            </AnimatePresence>

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
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email Address</label>
                            <input 
                              type="email" 
                              required
                              value={newAddress.email}
                              onChange={e => {
                                setNewAddress({...newAddress, email: e.target.value});
                                if (errors.email) setErrors({...errors, email: ''});
                              }}
                              className={cn(
                                "w-full bg-gray-50 border px-6 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 transition-all",
                                errors.email ? "border-ruby ring-ruby/10" : "border-gray-100 focus:ring-ruby/10"
                              )}
                              placeholder="Enter your email"
                            />
                            {errors.email && <p className="text-[9px] font-bold text-ruby uppercase tracking-widest">{errors.email}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                  </div>

                  <div className="step-nav flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button 
                      disabled={!selectedAddress}
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <p className="text-sm font-bold text-ruby">₹{(item.price * item.quantity).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price Breakdown Review - MOVED FROM SIDEBAR */}
                    <div className="bg-gray-50 rounded-[2rem] p-8 space-y-6 border border-gray-100/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price Breakdown</p>
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm font-medium text-gray-400">
                          <span>Subtotal</span>
                          <span className="font-bold text-[#1A2C54]">₹{subtotal.toLocaleString()}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm font-bold text-ruby">
                            <span>Discount</span>
                            <span>-₹{discount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-medium text-gray-400">
                          <span>Shipping</span>
                          <span className={cn("font-bold", shippingCost === 0 ? "text-green-500" : "text-[#1A2C54]")}>
                            {shippingCost === 0 ? 'FREE' : `₹${shippingCost.toLocaleString()}`}
                          </span>
                        </div>
                        <div className="pt-6 border-t border-gray-200 flex justify-between items-end">
                          <p className="text-lg font-bold text-[#1A2C54]">Total Amount</p>
                          <p className="text-2xl font-bold text-ruby">₹{finalTotal.toLocaleString()}</p>
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
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-[#1A2C54]">Payment Method</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select how you'd like to pay</p>
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
                      <span className="payment-name text-[16px] font-bold text-[#1A2C54] flex-grow">UPI / Wallets</span>
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
                      <span className="payment-name text-[16px] font-bold text-[#1A2C54] flex-grow">Cash on Delivery</span>
                      <div className={cn(
                        "pay-radio w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedPayment === 'cod' ? "border-ruby bg-ruby" : "border-gray-200"
                      )}>
                        {selectedPayment === 'cod' && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  </div>

                  {/* Secure Badge */}
                  <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-center gap-3 text-gray-400">
                    <Lock size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">100% Secure Checkout • Powered by Razorpay</span>
                  </div>

                  <div className="step-nav flex gap-4 mt-8 pt-8 border-t border-gray-100">
                    <button 
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 bg-white border border-gray-100 text-[#1A2C54] py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => handlePlaceOrder()}
                      disabled={isProcessingPayment}
                      className="flex-1 bg-ruby text-white py-5 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-ruby/20 active:scale-95 flex items-center justify-center"
                    >
                      {isProcessingPayment ? <LoadingSpinner size={20} className="border-white" /> : `Pay ₹${finalTotal.toLocaleString()} Now`}
                    </button>
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
