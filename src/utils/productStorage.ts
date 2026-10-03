import { Category, Product } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_BANNERS, DEFAULT_PRODUCTS } from '../data/defaultCatalog';

const MASTER_PRODUCTS_KEY = 'ruby_master_products_v2';
const MASTER_CATEGORIES_KEY = 'ruby_master_categories_v2';
const MASTER_BANNERS_KEY = 'ruby_master_banners_v2';

// Set of default product IDs to prevent storing redundant base64 data in localStorage
const defaultProductIds = new Set(DEFAULT_PRODUCTS.map(p => p.id));

// Auto-cleanup any bloated legacy keys exceeding 300KB on startup to free localStorage
try {
  const legacyProd = localStorage.getItem(MASTER_PRODUCTS_KEY);
  if (legacyProd && legacyProd.length > 300000) {
    localStorage.removeItem(MASTER_PRODUCTS_KEY);
  }
  const legacyCat = localStorage.getItem(MASTER_CATEGORIES_KEY);
  if (legacyCat && legacyCat.length > 300000) {
    localStorage.removeItem(MASTER_CATEGORIES_KEY);
  }
  // Clear any giant stale page caches
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('ruby_product_cache_') || k.startsWith('ruby_shop_cache_') || k === 'ruby_home_cache_v2') {
      try {
        const val = localStorage.getItem(k);
        if (val && val.length > 300000) {
          localStorage.removeItem(k);
        }
      } catch {}
    }
  });
} catch {}

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
  const productMap = new Map<string, Product>();

  try {
    const raw = localStorage.getItem(MASTER_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.filter(isValidProduct).forEach(p => productMap.set(p.id, p));
      }
    }
  } catch (e) {
    // Silent fallback
  }
  return Array.from(productMap.values());
};

/**
 * Saves or updates master products in persistent local storage.
 * Automatically stores only custom/updated products so localStorage never runs out of space.
 */
export const saveMasterProducts = (products: Product[]): void => {
  if (!Array.isArray(products) || products.length === 0) return;

  try {
    const valid = products.filter(isValidProduct);
    if (valid.length === 0) return;

    // Filter out default products that haven't changed so we only persist custom/new products
    const customOnly = valid.filter(p => !defaultProductIds.has(p.id));

    // If there are no custom products to save, keep storage clean
    if (customOnly.length === 0) return;

    const dataStr = JSON.stringify(customOnly);
    // Safety check: ensure payload is small enough (< 500KB)
    if (dataStr.length < 500 * 1024) {
      try {
        localStorage.setItem(MASTER_PRODUCTS_KEY, dataStr);
      } catch (e) {
        // Clean old temporary caches to free space if needed
        Object.keys(localStorage)
          .filter(k => k.startsWith('ruby_product_cache_') || k.startsWith('ruby_shop_cache_'))
          .forEach(k => {
            try { localStorage.removeItem(k); } catch {}
          });
        try {
          localStorage.setItem(MASTER_PRODUCTS_KEY, dataStr);
        } catch {}
      }
    }
  } catch (e) {
    // Silent
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
    // Silent fallback
  }
  return [];
};

/**
 * Saves master categories in persistent local storage
 */
export const saveMasterCategories = (categories: Category[]): void => {
  if (!Array.isArray(categories) || categories.length === 0) return;
  try {
    const str = JSON.stringify(categories);
    if (str.length < 300 * 1024) {
      localStorage.setItem(MASTER_CATEGORIES_KEY, str);
    }
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
    // Silent fallback
  }
  return [];
};

/**
 * Saves banners in persistent local storage
 */
export const saveMasterBanners = (banners: any[]): void => {
  if (!Array.isArray(banners) || banners.length === 0) return;
  try {
    const str = JSON.stringify(banners);
    if (str.length < 300 * 1024) {
      localStorage.setItem(MASTER_BANNERS_KEY, str);
    }
  } catch {}
};

/**
 * Overwrites master products with the latest fresh array from database
 */
export const overwriteMasterProducts = (products: Product[]): void => {
  if (!Array.isArray(products)) return;
  try {
    const customOnly = products.filter(isValidProduct).filter(p => !defaultProductIds.has(p.id));
    localStorage.setItem(MASTER_PRODUCTS_KEY, JSON.stringify(customOnly));
  } catch (e) {
    // Silent
  }
};

/**
 * Deletes a product by ID from persistent storage
 */
export const deleteMasterProduct = (id: string): void => {
  if (!id) return;
  try {
    const current = getMasterProducts();
    const updated = current.filter(p => p.id !== id && !defaultProductIds.has(p.id));
    localStorage.setItem(MASTER_PRODUCTS_KEY, JSON.stringify(updated));
  } catch (e) {
    // Silent
  }
};

