export function getCurrencyConfig() {
  const selected = localStorage.getItem('ruby_currency') || 'INR (₹)';
  if (selected.includes('USD')) {
    return { symbol: '$', rate: 0.012 };
  } else if (selected.includes('EUR')) {
    return { symbol: '€', rate: 0.011 };
  } else if (selected.includes('GBP')) {
    return { symbol: '£', rate: 0.0095 };
  }
  return { symbol: '₹', rate: 1.0 };
}

export function formatPrice(priceInINR: number): string {
  const { symbol, rate } = getCurrencyConfig();
  const converted = priceInINR * rate;
  if (symbol === '₹') {
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  }
  // For international currencies, format with two decimal places
  return `${symbol}${converted.toFixed(2)}`;
}
