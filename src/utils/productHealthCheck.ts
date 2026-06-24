import { Product } from '../types';

export interface HealthCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: {
    id: string;
    name: string;
    checks: string[];
  };
}

export function checkProductHealth(product: any): HealthCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: string[] = [];

  const id = product?.id || 'unknown';
  const name = product?.name || 'Unnamed Product';

  // 1. Check ID and Name
  if (!product?.id) {
    errors.push("Missing document ID.");
  } else {
    checks.push("Document ID exists.");
  }

  if (!product?.name || typeof product.name !== 'string' || product.name.trim() === '') {
    errors.push("Product name is missing or empty.");
  } else {
    checks.push(`Name is valid: "${product.name}"`);
  }

  // 2. Check Price and Stock
  if (product?.price === undefined || product?.price === null) {
    errors.push("Product price is missing.");
  } else if (typeof product.price !== 'number' || product.price < 0) {
    errors.push(`Invalid price value: ${product.price}`);
  } else {
    checks.push(`Price is valid: ₹${product.price}`);
  }

  if (product?.stock === undefined || product?.stock === null) {
    warnings.push("Stock level is missing.");
  } else if (typeof product.stock !== 'number' || product.stock < 0) {
    errors.push(`Invalid stock value: ${product.stock}`);
  } else {
    checks.push(`Stock is valid: ${product.stock} units`);
  }

  // 3. Check Category Mapping (CRITICAL FIX FOR BULK UPLOAD STRINGS vs ARRAYS)
  if (!product?.category) {
    errors.push("Category field is completely missing.");
  } else if (Array.isArray(product.category)) {
    if (product.category.length === 0) {
      errors.push("Category array is empty. Product has no categories.");
    } else {
      checks.push(`Categories are valid array: [${product.category.join(', ')}]`);
    }
  } else if (typeof product.category === 'string') {
    warnings.push(`Category is stored as a string "${product.category}" instead of an array. Automatically normalising client-side.`);
  } else {
    errors.push(`Category field has an invalid type: ${typeof product.category}`);
  }

  // 4. Check Images and Broken URLs
  if (!product?.images || !Array.isArray(product.images) || product.images.length === 0) {
    errors.push("Product has no images. Product requires at least one valid image URL.");
  } else {
    product.images.forEach((img: any, idx: number) => {
      if (!img || typeof img !== 'string' || img.trim() === '') {
        errors.push(`Image at index ${idx} is empty or invalid.`);
      } else if (!img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('data:image')) {
        warnings.push(`Image at index ${idx} might have a broken or non-standard URL: "${img.substring(0, 30)}..."`);
      } else {
        checks.push(`Image ${idx + 1} URL is structurally valid.`);
      }
    });
  }

  // 5. Check Status and Visibility
  if (product?.status && product.status !== 'active') {
    warnings.push(`Product status is set to "${product.status}" (expected "active").`);
  } else {
    checks.push("Product status is active.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    diagnostics: {
      id,
      name,
      checks
    }
  };
}

export function logProductDiagnostics(
  event: 'Saved' | 'Fetched' | 'Rendered' | 'Hidden', 
  product: any, 
  reason?: string
) {
  const pName = product?.name || 'Unnamed Product';
  const pId = product?.id || 'unknown';
  if (event === 'Hidden') {
    console.warn(`[Product Diagnostic - ${event}] ❌ Product "${pName}" (${pId}) is HIDDEN. Reason: ${reason || 'Unknown reason'}`);
  } else {
    console.log(`[Product Diagnostic - ${event}] App event executed. Product: "${pName}" (${pId})`);
  }
}

export function runCollectionHealthCheck(products: any[]): { 
  totalCount: number; 
  healthyCount: number; 
  unhealthyCount: number; 
  reports: { id: string; name: string; errors: string[]; warnings: string[] }[] 
} {
  let healthyCount = 0;
  let unhealthyCount = 0;
  const reports: any[] = [];

  products.forEach((p) => {
    const report = checkProductHealth(p);
    if (report.isValid) {
      healthyCount++;
    } else {
      unhealthyCount++;
    }
    if (report.errors.length > 0 || report.warnings.length > 0) {
      reports.push({
        id: report.diagnostics.id,
        name: report.diagnostics.name,
        errors: report.errors,
        warnings: report.warnings
      });
    }
  });

  return {
    totalCount: products.length,
    healthyCount,
    unhealthyCount,
    reports
  };
}
