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
    name: "Emerald Green Floral Anarkali Kurta",
    description: "<p>Elevate your ethnic wardrobe with this gorgeous Emerald Green Floral Anarkali Kurta. Crafted from premium breathable cotton, this kurta features intricate floral prints and a flattering flared silhouette. Designed for both casual elegance and festive occasions.</p><ul><li>Premium Cotton Fabric</li><li>Flared Anarkali Silhouette</li><li>Breathable & Lightweight</li><li>Includes side pocket</li></ul>",
    price: 1499,
    comparePrice: 2499,
    category: ["kurti"],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600"
    ],
    stock: 25,
    stockStatus: "In Stock",
    createdAt: "2026-01-01T00:00:00Z",
    isTrending: true,
    isPopular: true,
    variants: [
      { size: "M", color: "Green", stock: 10 },
      { size: "L", color: "Green", stock: 15 }
    ]
  },
  {
    id: "fp2",
    name: "Premium Silk Handwoven Banarasi Saree",
    description: "<p>A timeless masterpiece. This exquisite Royal Blue Banarasi Saree is handwoven from premium pure silk and features classical golden zari bootis with an ornate border. Perfect for weddings, prestigious events, and festive celebrations.</p><ul><li>Pure Handwoven Silk</li><li>Classical Zari Borders</li><li>Includes Unstitched Blouse Piece</li><li>Dry clean only</li></ul>",
    price: 4999,
    comparePrice: 8999,
    category: ["sarees"],
    sizes: ["FS"],
    images: [
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600"
    ],
    stock: 12,
    stockStatus: "In Stock",
    createdAt: "2026-01-02T00:00:00Z",
    isTrending: true,
    isPopular: false,
    variants: [
      { size: "FS", color: "Blue", stock: 12 }
    ]
  },
  {
    id: "fp3",
    name: "Royal Maroon Bridal Georgette Lehenga",
    description: "<p>Make a dramatic entrance with this breathtaking Royal Maroon Georgette Lehenga. Heavily embroidered with delicate threadwork, sequins, and classical mirror decorations, this piece delivers ultimate luxury and regal sophistication for your special day.</p><ul><li>Heavily Embroidered Georgette</li><li>Premium Inner Satin Lining</li><li>Includes Matching Dupatta and Blouse Piece</li><li>Intricate Handcrafted Detail</li></ul>",
    price: 8999,
    comparePrice: 15999,
    category: ["lehengas"],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600"
    ],
    stock: 8,
    stockStatus: "In Stock",
    createdAt: "2026-01-03T00:00:00Z",
    isTrending: false,
    isPopular: true,
    variants: [
      { size: "M", color: "Maroon", stock: 5 },
      { size: "L", color: "Maroon", stock: 3 }
    ]
  },
  {
    id: "fp4",
    name: "Pastel Pink Embroidered Chanderi Salwar Suit",
    description: "<p>Embrace effortless elegance with this beautiful Pastel Pink Salwar Suit set. Cut from premium Chanderi fabric with intricate neckline embroidery and paired with a soft floral-print organza dupatta. Elegant, light, and comfortable.</p><ul><li>Premium Chanderi Fabric</li><li>Elegant Hand Embroidery</li><li>Includes Floral Organza Dupatta</li><li>Comfort Fit Pant</li></ul>",
    price: 2299,
    comparePrice: 3999,
    category: ["suits"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=600"
    ],
    stock: 18,
    stockStatus: "In Stock",
    createdAt: "2026-01-04T00:00:00Z",
    isTrending: true,
    isPopular: true,
    variants: [
      { size: "S", color: "Pink", stock: 5 },
      { size: "M", color: "Pink", stock: 8 },
      { size: "L", color: "Pink", stock: 5 }
    ]
  }
];
