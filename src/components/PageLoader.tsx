import React from 'react';
import { motion } from 'framer-motion';

interface PageLoaderProps {
  message?: string;
  variant?: 'full' | 'minimal';
}

export default function PageLoader({ message = "Loading Dashboard Analytics", variant = 'full' }: PageLoaderProps) {
  if (variant === 'minimal') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 min-h-[300px] w-full text-center space-y-4">
        <div className="relative w-10 h-10">
          {/* Circular Track */}
          <div className="absolute inset-0 border-2 border-ruby/10 rounded-full" />
          {/* Spinning Segment */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-t-ruby border-r-transparent border-b-transparent border-l-transparent rounded-full shadow-[0_0_8px_rgba(225,29,72,0.15)]"
          />
        </div>
        {message && (
          <p className="text-[10px] font-mono tracking-widest text-gray-500 uppercase animate-pulse">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#111] flex flex-col items-center justify-center overflow-hidden">
      {/* Background ambient glowing orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-ruby/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Animated Brand Portal and concentric circles */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Outermost rotating orbit tracker */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-dashed border-ruby/20 rounded-[2.5rem]"
          />

          {/* Middle shimmering glow ring */}
          <motion.div
            animate={{ 
              scale: [1, 1.12, 1],
              opacity: [0.3, 0.7, 0.3]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-2 border border-ruby/40 rounded-[2rem] glow-ruby"
          />

          {/* Innermost pulsing brand symbol container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-16 h-16 bg-ruby rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-ruby/50 relative"
          >
            <span className="text-white text-3xl font-serif font-black">R</span>
            
            {/* Rapid heartbeat ring */}
            <motion.div 
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 border-2 border-ruby rounded-[1.5rem]"
            />
          </motion.div>
        </div>

        {/* Brand Text Header & Message Subtext */}
        <div className="flex flex-col items-center text-center px-4 space-y-2">
          <motion.h2 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-2xl font-serif font-black tracking-tight text-white"
          >
            The <span className="text-ruby">Ruby</span> Fashion
          </motion.h2>
          
          <motion.p 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 0.8 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-[10px] font-mono tracking-widest text-gray-400 capitalize"
          >
            {message}
          </motion.p>
        </div>

        {/* Elegant infinite slider load line */}
        <div className="w-40 h-1 bg-white/5 rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ left: "-40%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 w-2/5 bg-ruby rounded-full"
          />
        </div>
      </div>

      {/* Decorative Brand footer mark */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-8 text-white text-[9px] font-bold uppercase tracking-[0.6em]"
      >
        Premium Indian Wear
      </motion.div>
    </div>
  );
}
