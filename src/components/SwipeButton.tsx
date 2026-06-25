import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { formatPrice } from '../utils/currency';

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
  
  // Responsive container width state
  const [containerWidth, setContainerWidth] = useState(300);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    // Handle window resize dynamically to recalculate swipe range
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const padding = 8;
  const handleSize = 56;
  const swipeRange = Math.max(100, containerWidth - handleSize - (padding * 2));

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
  const checkScale = useTransform(x, [swipeRange * 0.8, swipeRange], [0, 1]);

  const handleDragEnd = () => {
    const currentX = x.get();
    if (currentX > swipeRange * 0.7) {
      // Complete swipe
      animate(x, swipeRange, { type: 'spring', stiffness: 450, damping: 24 });
      setIsComplete(true);
      
      // Delay to let the completed animation sit satisfyingly for a moment before calling onConfirm
      setTimeout(() => {
        onConfirm();
      }, 150);
    } else {
      // Snap back
      animate(x, 0, { type: 'spring', stiffness: 350, damping: 22 });
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-[72px] bg-ruby/5 rounded-[24px] flex items-center justify-center border-2 border-ruby/10 shadow-inner">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
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
      className={`relative w-full h-[72px] rounded-[24px] border-2 overflow-hidden select-none shadow-md ${
        isComplete 
          ? 'border-ruby shadow-xl shadow-ruby/20' 
          : 'border-gray-200'
      } ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
    >
      {/* Background Pulse for "Swipe to Pay" */}
      {!isComplete && (
        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.98, 1.02, 0.98] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-ruby/5 to-transparent skew-x-12"
        />
      )}

      {/* Text Layer */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.span 
          style={{ color: textColor }}
          className="text-[15px] font-black uppercase tracking-widest transition-colors duration-150"
        >
          {isComplete ? 'ORDER CONFIRMED' : formatPrice(price)}
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
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="absolute left-2 top-2 w-[56px] h-[56px] bg-ruby rounded-[18px] shadow-lg shadow-ruby/20 flex items-center justify-center z-10 cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-all duration-150"
        >
          <motion.div
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
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
