import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function VerifyEmail() {
  const navigate = useNavigate();

  useEffect(() => {
    toast.info("Please verify your account using the 6-digit security code sent to your email.");
    navigate('/verify-prompt', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAFA] py-12">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="animate-spin text-ruby" size={36} />
        <p className="text-sm text-gray-500 font-medium">Redirecting to secure verification...</p>
      </div>
    </div>
  );
}
