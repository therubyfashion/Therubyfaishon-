import { Category, Product } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_BANNERS, DEFAULT_PRODUCTS } from '../data/defaultCatalog';

const MASTER_PRODUCTS_KEY = 'ruby_master_products_v2';
const MASTER_CATEGORIES_KEY = 'ruby_master_categories_v2';
const MASTER_BANNERS_KEY = 'ruby_master_banners_v2';

/**
 * Validates that an item is a valid real product
 */
const isValidProduct = (p: any): boolean => {
  return Boolean(
    p &&
    typeof p === 'object' &&
    p.id &&
    p.name &&
    typeof p.price === 'number' &&
    Array.isArray(p.images) &&
    p.images.length > 0
  );
};

/**
 * Returns the master list of products.
 * Always guaranteed to return a populated array (either from localStorage or bundled real catalog).
 */
export const getMasterProducts = (): Product[] => {
  try {
    const raw = localStorage.getItem(MASTER_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(isValidProduct);
        if (valid.length > 0) {
          return valid;
        }
      }
    }
  } catch (e) {
    console.warn('[ProductStorage] Error reading master products:', e);
  }
  return DEFAULT_PRODUCTS;
};

/**
 * Saves or updates master products in persistent local storage.
 * Automatically merges incoming products with existing catalog.
 */
export const saveMasterProducts = (products: Product[]): void => {
  if (!Array.isArray(products) || products.length === 0) return;

  try {
    const valid = products.filter(isValidProduct);
    if (valid.length === 0) return;

    // Merge incoming products with existing defaults by ID
    const productMap = new Map<string, Product>();
    DEFAULT_PRODUCTS.forEach(p => productMap.set(p.id, p));
    valid.forEach(p => productMap.set(p.id, p));

    const merged = Array.from(productMap.values());
    const dataStr = JSON.stringify(merged);

    try {
      localStorage.setItem(MASTER_PRODUCTS_KEY, dataStr);
    } catch (e) {
      console.warn('[ProductStorage] Storage full, clearing old keys...');
      // Clean old temporary caches to free space
      Object.keys(localStorage)
        .filter(k => k.startsWith('ruby_product_cache_') || k.startsWith('ruby_shop_cache_'))
        .forEach(k => {
          try { localStorage.removeItem(k); } catch {}
        });
      try {
        localStorage.setItem(MASTER_PRODUCTS_KEY, dataStr);
      } catch {}
    }
  } catch (e) {
    console.warn('[ProductStorage] Error saving master products:', e);
  }
};

/**
 * Finds a single product by ID from master cache or default catalog
 */
export const getMasterProductById = (id?: string): Product | undefined => {
  if (!id) return undefined;
  const products = getMasterProducts();
  return products.find(p => p.id === id);
};

/**
 * Returns categories from storage or default catalog
 */
export const getMasterCategories = (): Category[] => {
  try {
    const raw = localStorage.getItem(MASTER_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[ProductStorage] Error reading master categories:', e);
  }
  return DEFAULT_CATEGORIES;
};

/**
 * Saves master categories in persistent local storage
 */
export const saveMasterCategories = (categories: Category[]): void => {
  if (!Array.isArray(categories) || categories.length === 0) return;
  try {
    localStorage.setItem(MASTER_CATEGORIES_KEY, JSON.stringify(categories));
  } catch {}
};

/**
 * Returns banners from storage or default banners
 */
export const getMasterBanners = (): any[] => {
  try {
    const raw = localStorage.getItem(MASTER_BANNERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[ProductStorage] Error reading master banners:', e);
  }
  return DEFAULT_BANNERS;
};

/**
 * Saves banners in persistent local storage
 */
export const saveMasterBanners = (banners: any[]): void => {
  if (!Array.isArray(banners) || banners.length === 0) return;
  try {
    localStorage.setItem(MASTER_BANNERS_KEY, JSON.stringify(banners));
  } catch {}
};

/**
 * Overwrites master products with the latest fresh array from database
 */
export const overwriteMasterProducts = (products: Product[]): void => {
  if (!Array.isArray(products)) return;
  try {
    const valid = products.filter(isValidProduct);
    localStorage.setItem(MASTER_PRODUCTS_KEY, JSON.stringify(valid));
  } catch (e) {
    console.warn('[ProductStorage] Error overwriting master products:', e);
  }
};

/**
 * Deletes a product by ID from persistent storage
 */
export const deleteMasterProduct = (id: string): void => {
  if (!id) return;
  try {
    const current = getMasterProducts();
    const updated = current.filter(p => p.id !== id);
    localStorage.setItem(MASTER_PRODUCTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[ProductStorage] Error deleting master product:', e);
  }
};

