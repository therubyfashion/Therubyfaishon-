export type Category = string;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  category: Category;
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

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userEmail: string;
  userImage?: string;
  rating: number;
  comment: string;
  createdAt: string;
  likes: number;
}
