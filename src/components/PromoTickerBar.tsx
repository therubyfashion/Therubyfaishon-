import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Truck, ShieldCheck, RefreshCw, Zap } from 'lucide-react';

interface PromoTickerBarProps {
  config: {
    promoEnabled: boolean;
    promoType: 'timer' | 'text';
    promoMessage: string;
    promoEndDate: string;
    promoScrolling: boolean;
    promoBgColor: string;
    promoTextColor: string;
  } | null;
}

export default function PromoTickerBar({ config }: PromoTickerBarProps) {
  if (!config || !config.promoEnabled) return null;

  const [timeLeft, setTimeLeft] = useState<{
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    isExpired: boolean;
  }>({ days: '00', hours: '00', minutes: '00', seconds: '00', isExpired: false });

  useEffect(() => {
    if (config.promoType !== 'timer' || !config.promoEndDate) return;

    const calculateTimeLeft = () => {
      const targetDate = new Date(config.promoEndDate);
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft(prev => ({ ...prev, isExpired: true }));
        return;
      }

      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({
        days: String(d).padStart(2, '0'),
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0'),
        isExpired: false
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [config.promoType, config.promoEndDate]);

  const bgStyle = { backgroundColor: config.promoBgColor || '#A11B35' };
  const textStyle = { color: config.promoTextColor || '#FFFFFF' };

  // Render content based on Mode
  const isTimerMode = config.promoType === 'timer' && !timeLeft.isExpired;

  // Automatically scroll in text mode, or if scrolling is enabled in settings
  const shouldScroll = config.promoScrolling || config.promoType === 'text';

  // Mode 2 Fallback Text:
  const fallbackText = "🚚 Free Delivery Above ₹499 | 🔒 Secure Payments | ↩️ Easy Returns";

  return (
    <div 
      style={bgStyle}
      id="promo-ticker-bar-container"
      className="w-auto -mx-5 select-none overflow-hidden h-[48px] relative flex items-center shadow-md border-y border-white/10"
    >
      {/* Absolute decorative pattern background subtle highlights */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

      {shouldScroll ? (
        <div className="w-full flex items-center whitespace-nowrap overflow-hidden">
          <motion.div
            animate={{ x: ['100%', '-100%'] }}
            transition={{
              repeat: Infinity,
              duration: isTimerMode ? 24 : 30,
              ease: 'linear',
            }}
            className="flex items-center gap-8 pl-[100%] shrink-0 text-xs font-bold leading-none tracking-wide"
            style={textStyle}
          >
            {isTimerMode ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-sans">
                  <Zap size={14} className="animate-pulse" />
                  {config.promoMessage}
                </span>
                <span className="font-mono bg-black/20 px-2.5 py-1 rounded-lg border border-white/5 flex items-center gap-1">
                  <span>{timeLeft.days}d</span>
                  <span className="opacity-40 animate-ping">:</span>
                  <span>{timeLeft.hours}h</span>
                  <span className="opacity-40 animate-ping">:</span>
                  <span>{timeLeft.minutes}m</span>
                  <span className="opacity-40 animate-ping">:</span>
                  <span>{timeLeft.seconds}s</span>
                </span>
              </div>
            ) : (
              <span className="flex items-center gap-3 py-1 font-sans">
                {config.promoMessage || fallbackText}
              </span>
            )}
            
            {/* Duplicated segment for continuous rolling effect */}
            <span className="opacity-20">|</span>
            
            {isTimerMode ? (
              <div className="flex items-center gap-3">
                <span className="font-sans">{config.promoMessage}</span>
                <span className="font-mono bg-black/20 px-2.5 py-1 rounded-lg border border-white/5">
                  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                </span>
              </div>
            ) : (
              <span className="font-sans">
                {config.promoMessage || fallbackText}
              </span>
            )}
          </motion.div>
        </div>
      ) : (
        // Static Center Mode with gentle fading scale
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full flex justify-center items-center px-4 relative z-10 text-[11px] md:text-xs font-bold font-sans text-center"
          style={textStyle}
        >
          {isTimerMode ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="tracking-wide">
                {config.promoMessage}
              </span>
              <div className="font-mono bg-black/25 px-2.5 py-0.5 rounded-lg border border-white/10 flex items-center gap-1 text-[11px] md:text-xs font-extrabold shadow-inner">
                <Clock size={12} className="inline animate-spin-slow mr-0.5 opacity-80" />
                <span>{timeLeft.days}d</span>
                <span className="opacity-40 animate-pulse">:</span>
                <span>{timeLeft.hours}h</span>
                <span className="opacity-40 animate-pulse">:</span>
                <span>{timeLeft.minutes}m</span>
                <span className="opacity-40 animate-pulse">:</span>
                <span>{timeLeft.seconds}s</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="tracking-wide uppercase text-[10px] md:text-[11px] flex items-center gap-1.5 opacity-95">
                {config.promoMessage || (
                  <>
                    <Truck size={14} className="text-white/80" /> Free Delivery Above ₹499
                    <span className="opacity-30 mx-1">|</span>
                    <ShieldCheck size={14} className="text-white/80" /> Secure Payments
                    <span className="opacity-30 mx-1">|</span>
                    <RefreshCw size={13} className="text-white/80 animate-spin-slow" /> Easy Returns
                  </>
                )}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
