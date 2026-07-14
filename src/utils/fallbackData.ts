import { Product, Category } from '../types';

export const fallbackCategories: any[] = [
  {
    id: "fb_cat_1",
    name: "SHORT TOP",
    slug: "short-top",
    sortOrder: 1,
    image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_2",
    name: "Dresses",
    slug: "dresses",
    sortOrder: 2,
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_3",
    name: "NEW ARRIVAL",
    slug: "new-arrival",
    sortOrder: 3,
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_4",
    name: "BEST SELLER",
    slug: "best-seller",
    sortOrder: 4,
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_5",
    name: "Kurti",
    slug: "kurti",
    sortOrder: 5,
    image: "https://images.unsplash.com/photo-1608933221953-c6cd6a7f0525?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_6",
    name: "Sarees",
    slug: "sarees",
    sortOrder: 6,
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_7",
    name: "Lehengas",
    slug: "lehengas",
    sortOrder: 7,
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=300"
  },
  {
    id: "fb_cat_8",
    name: "Suits",
    slug: "suits",
    sortOrder: 8,
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300"
  }
];

export const fallbackBanners: any[] = [
  {
    id: "fb_banner_1",
    title: "Festive Season Collection",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200",
    link: "/shop",
    active: true
  },
  {
    id: "fb_banner_2",
    title: "Elegant Pure Cotton Kurtas",
    image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=1200",
    link: "/shop?category=Kurti",
    active: true
  }
];

export const fallbackProducts: Product[] = [
  {
    id: "fb_prod_1",
    name: "Royal Crimson Anarkali Kurta Set",
    price: 1899,
    comparePrice: 2999,
    category: ["Kurti", "NEW ARRIVAL", "BEST SELLER"],
    sizes: ["M", "L", "XL", "XXL"],
    images: ["https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=800"],
    stock: 25,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: true,
    description: "Grace any occasion with this beautiful heavy georgette crimson red Anarkali kurta set. Richly embroidered with golden zari work and featuring a matching dupatta with intricate borders.",
    viewCount: 145,
    wishlistCount: 38,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_2",
    name: "Elegant Banarasi Red Silk Saree",
    price: 3499,
    comparePrice: 5999,
    category: ["Sarees", "BEST SELLER"],
    sizes: ["M", "L"],
    images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800"],
    stock: 15,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: true,
    description: "Impeccably handwoven silk saree featuring exquisite golden Banarasi borders and elegant paisley motifs. Ideal for weddings, festivals, and royal family events.",
    viewCount: 189,
    wishlistCount: 52,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_3",
    name: "Sapphire Blue Velvet Lehenga Choli",
    price: 4999,
    comparePrice: 8999,
    category: ["Lehengas", "NEW ARRIVAL"],
    sizes: ["S", "M", "L"],
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800"],
    stock: 10,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: false,
    description: "Make heads turn with this stunning sapphire blue velvet lehenga, heavily embellished with sequins, pearl work, and embroidery. Comes with deep-cut choli and sheer baby pink net dupatta.",
    viewCount: 232,
    wishlistCount: 89,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_4",
    name: "Classic Ivory Lucknowi Chikankari Kurti",
    price: 1299,
    comparePrice: 2299,
    category: ["Kurti", "SHORT TOP"],
    sizes: ["S", "M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1608933221953-c6cd6a7f0525?auto=format&fit=crop&q=80&w=800"],
    stock: 45,
    stockStatus: "In Stock",
    isTrending: false,
    isPopular: true,
    description: "Traditional Lucknowi hand-embroidered georgette Chikankari kurti in ivory white. Breathable, comfortable, and semi-sheer with gorgeous handshadow-work embroidery details.",
    viewCount: 94,
    wishlistCount: 22,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_5",
    name: "Pastel Mint Green Sharara Set",
    price: 2499,
    comparePrice: 3999,
    category: ["Suits", "Dresses", "NEW ARRIVAL"],
    sizes: ["S", "M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800"],
    stock: 18,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: true,
    description: "Indulge in absolute style with this beautiful mint green sharara suit set. Styled with intricate lace detailing on the neck, a flared bottom, and a matching organza dupatta.",
    viewCount: 165,
    wishlistCount: 41,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_6",
    name: "Floral Printed Peach Fusion Set",
    price: 1699,
    comparePrice: 2899,
    category: ["Suits", "Dresses"],
    sizes: ["M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1583391733979-514d3ec17e3f?auto=format&fit=crop&q=80&w=800"],
    stock: 22,
    stockStatus: "In Stock",
    isTrending: false,
    isPopular: false,
    description: "Enchanting peach-colored ethnic crop top and matching palazzo pants set, completed with an elegant floral printed long shrug jacket.",
    viewCount: 110,
    wishlistCount: 29,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_7",
    name: "Indigo Block-Print Cotton Kurti",
    price: 999,
    comparePrice: 1699,
    category: ["Kurti", "SHORT TOP", "BEST SELLER"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: ["https://images.unsplash.com/photo-16100304668-93535c17b6b3?auto=format&fit=crop&q=80&w=800"],
    stock: 40,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: true,
    description: "Pure organic cotton daily-wear Indigo kurti with artisanal hand-block print. Designed in a timeless straight-cut style with 3/4 sleeves.",
    viewCount: 88,
    wishlistCount: 19,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_prod_8",
    name: "Designer Floral Printed Short Top",
    price: 699,
    comparePrice: 1199,
    category: ["SHORT TOP", "NEW ARRIVAL"],
    sizes: ["S", "M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=800"],
    stock: 35,
    stockStatus: "In Stock",
    isTrending: true,
    isPopular: true,
    description: "A gorgeous floral printed premium short top, extremely comfortable and breathable. Perfect for daily casual wear or semi-formal occasions.",
    viewCount: 201,
    wishlistCount: 49,
    createdAt: new Date().toISOString()
  }
];

export const fallbackReviews: any[] = [
  {
    id: "fb_rev_1",
    name: "Priya R.",
    initials: "PR",
    color: "#5a4fcf",
    rating: 5,
    text: "The fabric quality is absolutely amazing. The cotton feels so soft and breathable — wore it all day and stayed comfortable throughout!",
    tag: "Fabric quality",
    date: "May 2, 2024",
    likes: 12,
    dislikes: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_rev_2",
    name: "Arjun M.",
    initials: "AM",
    color: "#d85a30",
    rating: 4,
    text: "Doesn't fade after multiple washes. The stitching is solid and the fabric holds shape well. Great durability for the price!",
    tag: "Durability",
    date: "Apr 28, 2024",
    likes: 8,
    dislikes: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: "fb_rev_3",
    name: "Sneha K.",
    initials: "SK",
    color: "#0f6e56",
    rating: 5,
    text: "Loved the premium linen blend. Lightweight yet sturdy — perfect for Indian summers. Will definitely order more from this store!",
    tag: "Summer comfort",
    date: "Apr 25, 2024",
    likes: 15,
    dislikes: 0,
    createdAt: new Date().toISOString()
  }
];

export const fallbackPromoConfig = {
  promoEnabled: true,
  promoType: 'timer',
  promoMessage: '🔥 Special Live Sale Ends Soon:',
  promoEndDate: new Date(Date.now() + 86400000).toISOString(),
  promoScrolling: false,
  promoBgColor: '#A11B35',
  promoTextColor: '#FFFFFF',
};
