import React from 'react';
import { motion } from 'motion/react';

export default function SplashScreen() {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[9999] bg-[#111] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-ruby/20 blur-[120px] rounded-full" />
      
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo Animation */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ 
            duration: 1, 
            ease: [0.16, 1, 0.3, 1],
            delay: 0.2
          }}
          className="w-24 h-24 bg-ruby rounded-[2rem] flex items-center justify-center shadow-2xl shadow-ruby/40 relative"
        >
          <span className="text-white text-5xl font-serif font-black">R</span>
          
          {/* Pulsing Ring */}
          <motion.div 
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 border-4 border-ruby rounded-[2rem]"
          />
        </motion.div>

        {/* Text Animation */}
        <div className="flex flex-col items-center">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-4xl font-serif font-black tracking-tighter"
          >
            <span className="text-white">The</span> <span className="text-ruby">Ruby</span>
          </motion.h1>
          
          <motion.div 
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="h-1 w-12 bg-ruby mt-2 rounded-full"
          />
        </div>

        {/* Loading Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex space-x-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className="w-1.5 h-1.5 bg-ruby rounded-full"
            />
          ))}
        </motion.div>
      </div>

      {/* Decorative elements */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-10 text-white text-[10px] font-black uppercase tracking-[0.5em]"
      >
        Premium Craftsmanship
      </motion.div>
    </motion.div>
  );
}
