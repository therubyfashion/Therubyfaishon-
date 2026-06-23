import { Product, Category } from '../types';

export const fallbackCategories: Category[] = [
  { id: "kurti", name: "Kurti", image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=300", slug: "kurti" },
  { id: "sarees", name: "Sarees", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300", slug: "sarees" },
  { id: "lehengas", name: "Lehengas", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=300", slug: "lehengas" },
  { id: "suits", name: "Suits", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300", slug: "suits" }
];

export const fallbackBanners = [
  {
    id: "b1",
    title: "Festive Season Collection",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200",
    link: "/shop",
    active: true
  },
  {
    id: "b2",
    title: "Elegant Pure Cotton Kurtas",
    image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=1200",
    link: "/shop?category=kurti",
    active: true
  }
];

export const fallbackReviews = [
  {
    id: "f1",
    name: "Priya R.",
    initials: "PR",
    color: "#5a4fcf",
    rating: 5,
    text: "The fabric quality is absolutely amazing. The cotton feels so soft and breathable — wore it all day and stayed comfortable throughout!",
    tag: "Fabric quality",
    date: "May 2, 2024",
    likes: 12,
    dislikes: 0
  },
  {
    id: "f2",
    name: "Arjun M.",
    initials: "AM",
    color: "#d85a30",
    rating: 4,
    text: "Doesn't fade after multiple washes. The stitching is solid and the fabric holds shape well. Great durability for the price!",
    tag: "Durability",
    date: "Apr 28, 2024",
    likes: 8,
    dislikes: 1
  },
  {
    id: "f3",
    name: "Sneha K.",
    initials: "SK",
    color: "#0f6e56",
    rating: 5,
    text: "Loved the premium linen blend. Lightweight yet sturdy — perfect for Indian summers. Will definitely order more from this store!",
    tag: "Summer comfort",
    date: "Apr 25, 2024",
    likes: 15,
    dislikes: 0
  }
];

export const fallbackProducts: Product[] = [
  {
    id: "fp1",
    name: "Royal Crimson Anarkali Kurta Set",
    price: 1899,
    comparePrice: 2999,
    category: ["Kurti"],
    sizes: ["M", "L", "XL", "XXL"],
    images: ["https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=800"],
    stock: 25,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Grace any occasion with this beautiful heavy georgette crimson red Anarkali kurta set. Richly embroidered with golden zari work.",
    viewCount: 145,
    wishlistCount: 38,
    createdAt: new Date().toISOString()
  },
  {
    id: "fp2",
    name: "Elegant Banarasi Red Silk Saree",
    price: 3499,
    comparePrice: 5999,
    category: ["Sarees"],
    sizes: ["M", "L"],
    images: ["https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800"],
    stock: 15,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Impeccably handwoven silk saree featuring exquisite golden Banarasi borders.",
    viewCount: 189,
    wishlistCount: 52,
    createdAt: new Date().toISOString()
  },
  {
    id: "fp3",
    name: "Sapphire Blue Velvet Lehenga Choli",
    price: 4999,
    comparePrice: 8999,
    category: ["Lehengas"],
    sizes: ["S", "M", "L"],
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800"],
    stock: 10,
    stockStatus: "In Stock",
    isTrending: true,
    description: "Stunning sapphire blue velvet lehenga, heavily embellished with sequins and pearl work.",
    viewCount: 232,
    wishlistCount: 89,
    createdAt: new Date().toISOString()
  },
  {
    id: "fp4",
    name: "Classic Ivory Lucknowi Chikankari Kurti",
    price: 1299,
    comparePrice: 2299,
    category: ["Kurti"],
    sizes: ["S", "M", "L", "XL"],
    images: ["https://images.unsplash.com/photo-1608933221953-c6cd6a7f0525?auto=format&fit=crop&q=80&w=800"],
    stock: 45,
    stockStatus: "In Stock",
    isTrending: false,
    description: "Traditional Lucknowi hand-embroidered georgette Chikankari kurti in ivory white.",
    viewCount: 94,
    wishlistCount: 22,
    createdAt: new Date().toISOString()
  }
];
