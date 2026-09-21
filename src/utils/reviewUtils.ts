// Review display utilities for social proof and formatting
export const getProductReviewCountString = (productId?: string): string => {
  if (!productId) return '2.4k';

  // Fixed signature counts for featured catalog products
  if (productId === '1f8c4a4d-98a9-44db-bfe6-b17d698259a5') return '2.4k'; // Women’s Printed Cotton Blend Kurta with Lace Detail
  if (productId === '09359990-86ca-439a-9e33-72f670f0535f') return '3.1k'; // Women's Black Floral Printed Kurti
  if (productId === '532a124b-8320-4d18-b900-9e886472a685') return '2.8k'; // Printed Pure Cotton V-Neck Short Kurti

  // Deterministic calculation for other products
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) >>> 0;
  }
  const counts = ['2.4k', '3.1k', '2.8k', '1.9k', '3.4k', '2.6k', '2.9k', '3.2k'];
  return counts[hash % counts.length];
};
