import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { ChevronRight, Check } from 'lucide-react';

interface SwipeButtonProps {
  onConfirm: () => void;
  price: number;
  disabled?: boolean;
  isLoading?: boolean;
}

const SwipeButton: React.FC<SwipeButtonProps> = ({ onConfirm, price, disabled, isLoading }) => {
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  // Width of the handle is roughly 60px
  const containerWidth = containerRef.current?.offsetWidth || 300;
  const padding = 8;
  const handleSize = 56;
  const swipeRange = containerWidth - handleSize - (padding * 2);

  const opacity = useTransform(x, [0, swipeRange * 0.3], [1, 0.1]);
  const bgColor = useTransform(
    x,
    [0, swipeRange],
    ["#ffffff", "#E11D48"]
  );
  const textColor = useTransform(
    x,
    [0, swipeRange],
    ["#1A2C54", "#ffffff"]
  );
  const handleX = x;
  const checkScale = useTransform(x, [swipeRange * 0.8, swipeRange], [0, 1]);

  const handleDragEnd = () => {
    if (x.get() > swipeRange * 0.8) {
      animate(x, swipeRange, { type: 'spring', stiffness: 400, damping: 40 });
      setIsComplete(true);
      // Small delay to let the animation finish before triggering navigation/processing
      setTimeout(() => {
        onConfirm();
      }, 300);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 40 });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-[72px] bg-ruby/5 rounded-[24px] flex items-center justify-center border-2 border-ruby/10 shadow-inner">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-ruby border-t-transparent rounded-full"
        />
        <span className="ml-4 text-xs font-black uppercase tracking-[0.2em] text-ruby">Processing Order</span>
      </div>
    );
  }

  return (
    <motion.div 
      ref={containerRef}
      style={{ backgroundColor: bgColor }}
      className={`relative w-full h-[72px] rounded-[24px] border-2 overflow-hidden select-none transition-all duration-500 shadow-md ${
        isComplete ? 'border-ruby shadow-xl shadow-ruby/20' : 'border-gray-200'
      } ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
    >
      {/* Background Pulse for "Swipe to Pay" */}
      {!isComplete && (
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-ruby/5 to-transparent skew-x-12"
        />
      )}

      {/* Text Layer */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span 
          style={{ color: textColor }}
          className="text-[15px] font-black uppercase tracking-widest"
        >
          {isComplete ? 'ORDER CONFIRMED' : `₹${price.toLocaleString()}`}
        </motion.span>
        {!isComplete && (
          <motion.span 
            style={{ opacity }}
            className="text-[9px] uppercase tracking-[0.25em] font-black text-gray-400 mt-1"
          >
            Swipe to pay
          </motion.span>
        )}
      </div>

      {/* Handle */}
      {!isComplete && !disabled && (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: swipeRange }}
          dragElastic={0.02}
          onDragEnd={handleDragEnd}
          style={{ x: handleX }}
          className="absolute left-2 top-2 w-[56px] h-[56px] bg-ruby rounded-[18px] shadow-lg shadow-ruby/20 flex items-center justify-center z-10 cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-transform"
        >
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronRight className="text-white" size={24} strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}

      {/* Success Indicator */}
      <motion.div 
        style={{ scale: checkScale, opacity: isComplete ? 1 : 0 }}
        className="absolute right-6 top-1/2 -translate-y-1/2 text-white"
      >
        <Check size={28} strokeWidth={4} />
      </motion.div>
    </motion.div>
  );
};

export default SwipeButton;
