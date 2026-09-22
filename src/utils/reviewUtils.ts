// Review display utilities for social proof and formatting
export const getProductReviewCountString = (productId?: string, currentReviewsCount: number = 0): string => {
  if (!productId) return '2.4k';

  // Base thousands seed for featured catalog products
  let baseThousands = 2.4;
  if (productId === '1f8c4a4d-98a9-44db-bfe6-b17d698259a5') baseThousands = 2.4;
  else if (productId === '09359990-86ca-439a-9e33-72f670f0535f') baseThousands = 3.1;
  else if (productId === '532a124b-8320-4d18-b900-9e886472a685') baseThousands = 2.8;
  else {
    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
      hash = (hash * 31 + productId.charCodeAt(i)) >>> 0;
    }
    const counts = [2.4, 3.1, 2.8, 1.9, 3.4, 2.6, 2.9, 3.2];
    baseThousands = counts[hash % counts.length];
  }

  // If new user reviews are added, track them into the thousands count
  const newReviewsCount = Math.max(0, currentReviewsCount - 49);
  const totalThousands = baseThousands + (newReviewsCount * 0.01);
  return `${totalThousands.toFixed(1)}k`;
};
