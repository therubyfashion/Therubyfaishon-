import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function autoSeedDatabase() {
  try {
    // Check if categories are empty
    const categoriesRef = collection(db, 'categories');
    const categorySnap = await getDocs(categoriesRef);
    
    if (categorySnap.empty) {
      console.log("🌱 [Seeder] Seeding real ethnic wear categories...");
      const realCategories = [
        { name: "Kurti", image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=300", slug: "kurti", sortOrder: 1 },
        { name: "Sarees", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=300", slug: "sarees", sortOrder: 2 },
        { name: "Lehengas", image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=300", slug: "lehengas", sortOrder: 3 },
        { name: "Suits", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=300", slug: "suits", sortOrder: 4 },
        { name: "Dupatta", image: "https://images.unsplash.com/photo-15833914-64c0242c1616?auto=format&fit=crop&q=80&w=300", slug: "dupatta", sortOrder: 5 }
      ];

      for (const cat of realCategories) {
        await addDoc(categoriesRef, {
          ...cat,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Check if banners are empty
    const bannersRef = collection(db, 'banners');
    const bannersSnap = await getDocs(bannersRef);
    if (bannersSnap.empty) {
      console.log("🌱 [Seeder] Seeding real ethnic wear banners...");
      const realBanners = [
        {
          title: "Festive Season Collection",
          image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200",
          link: "/shop",
          active: true,
          createdAt: new Date().toISOString()
        },
        {
          title: "Elegant Pure Cotton Kurtas",
          image: "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&q=80&w=1200",
          link: "/shop?category=Kurti",
          active: true,
          createdAt: new Date().toISOString()
        }
      ];

      for (const ban of realBanners) {
        await addDoc(bannersRef, ban);
      }
    }

    // Check if products are empty
    const productsRef = collection(db, 'products');
    const productsSnap = await getDocs(productsRef);
    if (productsSnap.empty) {
      console.log("🌱 [Seeder] Seeding real premium ethnic wear products...");
      const realProducts = [
        {
          name: "Royal Crimson Anarkali Kurta Set",
          price: 1899,
          comparePrice: 2999,
          category: ["Kurti"],
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
          name: "Elegant Banarasi Red Silk Saree",
          price: 3499,
          comparePrice: 5999,
          category: ["Sarees"],
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
          name: "Sapphire Blue Velvet Lehenga Choli",
          price: 4999,
          comparePrice: 8999,
          category: ["Lehengas"],
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
          name: "Classic Ivory Lucknowi Chikankari Kurti",
          price: 1299,
          comparePrice: 2299,
          category: ["Kurti"],
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
          name: "Pastel Mint Green Sharara Set",
          price: 2499,
          comparePrice: 3999,
          category: ["Suits"],
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
          name: "Handwoven Golden Zari Dupatta",
          price: 799,
          comparePrice: 1499,
          category: ["Dupatta"],
          sizes: ["M", "L"],
          images: ["https://images.unsplash.com/photo-15833914-64c0242c1616?auto=format&fit=crop&q=80&w=800"],
          stock: 30,
          stockStatus: "In Stock",
          isTrending: false,
          isPopular: false,
          description: "Premium handloom golden zari dupatta to elevate your simple ethnic kurtas. Lightweight, fluid, and textured with elegant metallic thread work.",
          viewCount: 61,
          wishlistCount: 14,
          createdAt: new Date().toISOString()
        },
        {
          name: "Floral Printed Peach Fusion Set",
          price: 1699,
          comparePrice: 2899,
          category: ["Suits"],
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
          name: "Indigo Block-Print Cotton Kurti",
          price: 999,
          comparePrice: 1699,
          category: ["Kurti"],
          sizes: ["S", "M", "L", "XL", "XXL"],
          images: ["https://images.unsplash.com/photo-16100304668-93535c17b6b3?auto=format&fit=crop&q=80&w=800"],
          stock: 40,
          stockStatus: "In Stock",
          isTrending: false,
          isPopular: false,
          description: "Pure organic cotton daily-wear Indigo kurti with artisanal hand-block print. Designed in a timeless straight-cut style with 3/4 sleeves.",
          viewCount: 88,
          wishlistCount: 19,
          createdAt: new Date().toISOString()
        }
      ];

      for (const prod of realProducts) {
        await addDoc(productsRef, prod);
      }
    }

    // Check if fabric_reviews are empty
    const reviewsRef = collection(db, 'fabric_reviews');
    const reviewsSnap = await getDocs(reviewsRef);
    if (reviewsSnap.empty) {
      console.log("🌱 [Seeder] Seeding real ethnic wear reviews...");
      const realReviews = [
        {
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

      for (const rev of realReviews) {
        await addDoc(reviewsRef, rev);
      }
    }
    
    console.log("🌱 [Seeder] Database auto-seeded successfully with premium products!");
  } catch (error) {
    console.warn("⚠️ [Seeder] Database auto-seeding failed:", error);
  }
}
