import React from 'react';
import { motion } from 'motion/react';

export default function About() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=2000" 
            alt="About Us" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-white text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-serif font-bold tracking-tighter"
          >
            Our <span className="text-ruby italic">Story</span>
          </motion.h1>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="space-y-8 text-center">
          <h2 className="text-3xl font-serif font-bold tracking-tight">Crafting Elegance Since 2024</h2>
          <p className="text-gray-500 text-lg font-light leading-relaxed tracking-wide">
            The Ruby was born from a simple vision: to create clothing that embodies the strength, brilliance, and timeless beauty of its namesake gemstone. We believe that fashion is more than just what you wear—it's an expression of your inner radiance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h3 className="text-2xl font-serif font-bold">The Ruby Standard</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-light">
              Every garment in our collection undergoes a rigorous selection process. From the initial sketch to the final stitch, we prioritize ethical sourcing, sustainable practices, and unparalleled craftsmanship.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed font-light">
              Our signature ruby-red accents are more than just a design choice; they represent our commitment to passion, energy, and the bold spirit of our customers.
            </p>
          </div>
          <div className="aspect-square bg-gray-100 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=800" 
              alt="Craftsmanship" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="aspect-square bg-gray-100 overflow-hidden md:order-last">
            <img 
              src="https://images.unsplash.com/photo-1534126511673-b6899657816a?auto=format&fit=crop&q=80&w=800" 
              alt="Community" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-6">
            <h3 className="text-2xl font-serif font-bold">Our Community</h3>
            <p className="text-gray-500 text-sm leading-relaxed font-light">
              We are more than a brand; we are a collective of individuals who appreciate the finer things in life. Our community is at the heart of everything we do, inspiring us to push boundaries and redefine modern luxury.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed font-light">
              Join us on our journey as we continue to explore the intersection of tradition and innovation, always with a touch of ruby.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
