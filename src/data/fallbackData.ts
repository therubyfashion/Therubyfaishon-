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

export const fallbackProducts: Product[] = [];
