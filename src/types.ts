export interface Category {
  id: string;
  name: string;
  image?: string;
  slug?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  category: string[];
  sizes: string[];
  images: string[];
  stock: number;
  stockStatus?: string;
  createdAt: string;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  weight?: string;
  dimensions?: string;
  sku?: string;
  barcode?: string;
  isTrending?: boolean;
  variants?: { size: string; color: string; stock: number }[];
  viewCount?: number;
  wishlistCount?: number;
}

export interface CartItem extends Product {
  selectedSize: string;
  selectedColor?: string;
  quantity: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  addressConfirmedAt?: string;
  role: 'admin' | 'user';
  isVerified: boolean;
  verificationToken?: string | null;
  loyaltyPoints?: number;
  createdAt: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  shippingMethod: string;
  shippingAddress: {
    fullName: string;
    phoneNumber: string;
    address: string;
    city: string;
    zipCode: string;
    country: string;
  };
  createdAt: string;
}

export interface Banner {
  id: string;
  image: string;
  link: string;
  active: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userEmail: string;
  userImage?: string;
  rating: number;
  comment: string;
  image?: string | null;
  createdAt: string;
  likes: number;
}

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  body: string;
  type: 'order' | 'coupon' | 'alert' | 'promotion';
  iconType: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface Promotion {
  id: string;
  name: string;
  description: string;
  priority: number;
  status: 'active' | 'draft' | 'expired';
  type: 'bxgy' | 'percentage' | 'flat' | 'shipping' | 'bundle';
  conditions: {
    minCartValue?: number;
    minQuantity?: number;
    productIds?: string[];
    categoryIds?: string[];
    userType?: 'all' | 'new' | 'loyal';
    startDate?: string;
    endDate?: string;
  };
  bxgyConfig?: {
    buyQty: number;
    getQty: number;
    applyOn: 'same' | 'cheapest' | 'specific';
    maxFree?: number;
    repeat: boolean;
  };
  reward: {
    method: 'auto' | 'discount';
    value?: number;
  };
  limits: {
    perUser?: number;
    totalUsage?: number;
    maxDiscount?: number;
  };
  stackable: boolean;
  createdAt: string;
  updatedAt: string;
}
