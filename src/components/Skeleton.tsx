import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);

export const ProductCardSkeleton = () => (
  <div className="bg-white rounded-2xl p-0 space-y-4 border border-gray-100 shadow-sm overflow-hidden">
    <Skeleton className="aspect-[3/4] w-full rounded-none" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  </div>
);

export const OrderItemSkeleton = () => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
    <div className="flex gap-3">
      <Skeleton className="h-16 w-16 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  </div>
);

export const ProductDetailSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
    <Skeleton className="aspect-square w-full rounded-3xl" />
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex gap-4 pt-4">
        <Skeleton className="h-14 flex-1 rounded-2xl" />
        <Skeleton className="h-14 w-14 rounded-2xl" />
      </div>
    </div>
  </div>
);

export const LoadingSpinner = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div 
      className="border-2 border-current border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  </div>
);
