import React, { useState } from 'react';
import { MapPin, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { detectCurrentLocation, DetectedLocationResult } from '../utils/locationUtils';

interface LocationAutofillButtonProps {
  onLocationDetected: (data: DetectedLocationResult) => void;
  className?: string;
  variant?: 'compact' | 'full';
}

export const LocationAutofillButton: React.FC<LocationAutofillButtonProps> = ({
  onLocationDetected,
  className = '',
  variant = 'full'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;
    setIsLoading(true);
    setIsSuccess(false);

    try {
      const detected = await detectCurrentLocation();
      setIsSuccess(true);
      onLocationDetected(detected);

      const locationLabel = [detected.city, detected.pincode].filter(Boolean).join(' ');
      toast.success(
        locationLabel ? `Location detected: ${locationLabel} ✨` : "Location detected successfully! ✨",
        { duration: 4000 }
      );

      setTimeout(() => {
        setIsSuccess(false);
      }, 3500);
    } catch (err: any) {
      console.warn("Location autofill warning:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ruby bg-ruby/5 hover:bg-ruby/10 active:scale-95 transition-all border border-ruby/20 disabled:opacity-50 cursor-pointer ${className}`}
        title="Auto-fill City, State & PIN code from current location"
      >
        {isLoading ? (
          <Loader2 size={13} className="animate-spin text-ruby" />
        ) : isSuccess ? (
          <CheckCircle2 size={13} className="text-emerald-600" />
        ) : (
          <MapPin size={13} className="text-ruby" />
        )}
        <span>{isLoading ? 'Detecting...' : isSuccess ? 'Detected!' : 'Use Location'}</span>
      </button>
    );
  }

  return (
    <div className={`w-full mb-4 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`w-full group relative overflow-hidden flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-ruby/20 bg-gradient-to-r from-ruby/5 via-white to-ruby/5 hover:from-ruby/10 hover:to-ruby/10 active:scale-[0.99] transition-all cursor-pointer shadow-xs disabled:opacity-60 text-left`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
            isSuccess 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
              : 'bg-ruby text-white shadow-md shadow-ruby/20 group-hover:scale-105'
          }`}>
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 size={18} />
            ) : (
              <MapPin size={18} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-[13px] font-bold text-[#1A2C54] group-hover:text-ruby transition-colors">
                {isLoading ? 'Detecting Your Location...' : isSuccess ? 'Location Detected & Filled!' : 'Use My Current Location'}
              </span>
              <Sparkles size={12} className="text-amber-500 animate-pulse" />
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">
              {isLoading 
                ? 'Fetching GPS & reverse geocoding...' 
                : isSuccess 
                  ? 'PIN code, City and State updated below' 
                  : '1-Click auto-fill for PIN code, City & State'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white border border-ruby/20 text-ruby shadow-xs group-hover:bg-ruby group-hover:text-white transition-all">
            {isLoading ? 'Wait' : isSuccess ? 'Done' : 'Auto Fill'}
          </span>
        </div>
      </button>
    </div>
  );
};
export default LocationAutofillButton;
