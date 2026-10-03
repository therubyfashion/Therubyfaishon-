// Geographic coordinate datasets, city lookups, and continent definitions for 2D Map & 3D Globe

export interface CityLocation {
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  lat: number;
  lng: number;
  region?: string;
}

// Major cities dictionary for accurate visitor pin-pointing
export const CITY_COORDINATES: Record<string, CityLocation> = {
  // India (Primary Store Market)
  'mumbai': { city: 'Mumbai', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 19.0760, lng: 72.8777, region: 'Maharashtra' },
  'delhi': { city: 'New Delhi', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 28.6139, lng: 77.2090, region: 'Delhi' },
  'new delhi': { city: 'New Delhi', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 28.6139, lng: 77.2090, region: 'Delhi' },
  'bengaluru': { city: 'Bengaluru', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 12.9716, lng: 77.5946, region: 'Karnataka' },
  'bangalore': { city: 'Bengaluru', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 12.9716, lng: 77.5946, region: 'Karnataka' },
  'hyderabad': { city: 'Hyderabad', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 17.3850, lng: 78.4867, region: 'Telangana' },
  'chennai': { city: 'Chennai', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 13.0827, lng: 80.2707, region: 'Tamil Nadu' },
  'kolkata': { city: 'Kolkata', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 22.5726, lng: 88.3639, region: 'West Bengal' },
  'pune': { city: 'Pune', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 18.5204, lng: 73.8567, region: 'Maharashtra' },
  'ahmedabad': { city: 'Ahmedabad', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 23.0225, lng: 72.5714, region: 'Gujarat' },
  'jaipur': { city: 'Jaipur', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 26.9124, lng: 75.7873, region: 'Rajasthan' },
  'surat': { city: 'Surat', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 21.1702, lng: 72.8311, region: 'Gujarat' },
  'lucknow': { city: 'Lucknow', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 26.8467, lng: 80.9462, region: 'Uttar Pradesh' },
  'chandigarh': { city: 'Chandigarh', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 30.7333, lng: 76.7794, region: 'Punjab' },
  'kochi': { city: 'Kochi', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 9.9312, lng: 76.2673, region: 'Kerala' },
  'indore': { city: 'Indore', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 22.7196, lng: 75.8577, region: 'Madhya Pradesh' },
  'nagpur': { city: 'Nagpur', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 21.1458, lng: 79.0882, region: 'Maharashtra' },
  'patna': { city: 'Patna', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 25.5941, lng: 85.1376, region: 'Bihar' },
  'bhopal': { city: 'Bhopal', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 23.2599, lng: 77.4126, region: 'Madhya Pradesh' },
  'vadodara': { city: 'Vadodara', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 22.3072, lng: 73.1812, region: 'Gujarat' },
  'coimbatore': { city: 'Coimbatore', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 11.0168, lng: 76.9558, region: 'Tamil Nadu' },
  'guwahati': { city: 'Guwahati', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 26.1445, lng: 91.7362, region: 'Assam' },
  'noida': { city: 'Noida', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 28.5355, lng: 77.3910, region: 'Uttar Pradesh' },
  'gurgaon': { city: 'Gurugram', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 28.4595, lng: 77.0266, region: 'Haryana' },
  'gurugram': { city: 'Gurugram', country: 'India', countryCode: 'IN', flag: '🇮🇳', lat: 28.4595, lng: 77.0266, region: 'Haryana' },

  // International Markets
  'new york': { city: 'New York', country: 'United States', countryCode: 'US', flag: '🇺🇸', lat: 40.7128, lng: -74.0060 },
  'los angeles': { city: 'Los Angeles', country: 'United States', countryCode: 'US', flag: '🇺🇸', lat: 34.0522, lng: -118.2437 },
  'chicago': { city: 'Chicago', country: 'United States', countryCode: 'US', flag: '🇺🇸', lat: 41.8781, lng: -87.6298 },
  'san francisco': { city: 'San Francisco', country: 'United States', countryCode: 'US', flag: '🇺🇸', lat: 37.7749, lng: -122.4194 },
  'london': { city: 'London', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧', lat: 51.5074, lng: -0.1278 },
  'manchester': { city: 'Manchester', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧', lat: 53.4808, lng: -2.2426 },
  'birmingham': { city: 'Birmingham', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧', lat: 52.4862, lng: -1.8904 },
  'toronto': { city: 'Toronto', country: 'Canada', countryCode: 'CA', flag: '🇨🇦', lat: 43.6532, lng: -79.3832 },
  'vancouver': { city: 'Vancouver', country: 'Canada', countryCode: 'CA', flag: '🇨🇦', lat: 49.2827, lng: -123.1207 },
  'dubai': { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', flag: '🇦🇪', lat: 25.2048, lng: 55.2708 },
  'abu dhabi': { city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', flag: '🇦🇪', lat: 24.4539, lng: 54.3773 },
  'singapore': { city: 'Singapore', country: 'Singapore', countryCode: 'SG', flag: '🇸🇬', lat: 1.3521, lng: 103.8198 },
  'sydney': { city: 'Sydney', country: 'Australia', countryCode: 'AU', flag: '🇦🇺', lat: -33.8688, lng: 151.2093 },
  'melbourne': { city: 'Melbourne', country: 'Australia', countryCode: 'AU', flag: '🇦🇺', lat: -37.8136, lng: 144.9631 },
  'paris': { city: 'Paris', country: 'France', countryCode: 'FR', flag: '🇫🇷', lat: 48.8566, lng: 2.3522 },
  'berlin': { city: 'Berlin', country: 'Germany', countryCode: 'DE', flag: '🇩🇪', lat: 52.5200, lng: 13.4050 },
  'tokyo': { city: 'Tokyo', country: 'Japan', countryCode: 'JP', flag: '🇯🇵', lat: 35.6762, lng: 139.6503 },
  'auckland': { city: 'Auckland', country: 'New Zealand', countryCode: 'NZ', flag: '🇳🇿', lat: -36.8485, lng: 174.7633 },
  'kuala lumpur': { city: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', flag: '🇲🇾', lat: 3.1390, lng: 101.6869 },
  'bangkok': { city: 'Bangkok', country: 'Thailand', countryCode: 'TH', flag: '🇹🇭', lat: 13.7563, lng: 100.5018 },
  'riyadh': { city: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', flag: '🇸🇦', lat: 24.7136, lng: 46.6753 },
  'doha': { city: 'Doha', country: 'Qatar', countryCode: 'QA', flag: '🇶🇦', lat: 25.2854, lng: 51.5310 }
};

export const COUNTRY_FLAGS: Record<string, string> = {
  'india': '🇮🇳',
  'in': '🇮🇳',
  'united states': '🇺🇸',
  'usa': '🇺🇸',
  'us': '🇺🇸',
  'united kingdom': '🇬🇧',
  'uk': '🇬🇧',
  'gb': '🇬🇧',
  'canada': '🇨🇦',
  'ca': '🇨🇦',
  'australia': '🇦🇺',
  'au': '🇦🇺',
  'united arab emirates': '🇦🇪',
  'uae': '🇦🇪',
  'ae': '🇦🇪',
  'singapore': '🇸🇬',
  'sg': '🇸🇬',
  'germany': '🇩🇪',
  'de': '🇩🇪',
  'france': '🇫🇷',
  'fr': '🇫🇷',
  'japan': '🇯🇵',
  'jp': '🇯🇵',
  'saudi arabia': '🇸🇦',
  'sa': '🇸🇦',
  'qatar': '🇶🇦',
  'qa': '🇶🇦',
  'new zealand': '🇳🇿',
  'nz': '🇳🇿',
  'netherlands': '🇳🇱',
  'nl': '🇳🇱',
  'malaysia': '🇲🇾',
  'my': '🇲🇾'
};

export function getCountryFlag(countryNameOrCode?: string): string {
  if (!countryNameOrCode) return '🌐';
  const clean = countryNameOrCode.toLowerCase().trim();
  return COUNTRY_FLAGS[clean] || '🌐';
}

export function resolveCityLocation(city?: string, country?: string, lat?: number, lng?: number): CityLocation {
  const normCity = (city || '').toLowerCase().trim();
  if (normCity && CITY_COORDINATES[normCity]) {
    const found = CITY_COORDINATES[normCity];
    return {
      ...found,
      lat: (lat && lat !== 0) ? lat : found.lat,
      lng: (lng && lng !== 0) ? lng : found.lng,
      country: country || found.country
    };
  }

  // Fallback coords based on country
  const normCountry = (country || '').toLowerCase().trim();
  if (normCountry.includes('india') || normCountry === 'in') {
    return {
      city: city || 'New Delhi',
      country: 'India',
      countryCode: 'IN',
      flag: '🇮🇳',
      lat: (lat && lat !== 0) ? lat : 28.6139,
      lng: (lng && lng !== 0) ? lng : 77.2090
    };
  }
  if (normCountry.includes('united states') || normCountry === 'usa' || normCountry === 'us') {
    return {
      city: city || 'New York',
      country: 'United States',
      countryCode: 'US',
      flag: '🇺🇸',
      lat: (lat && lat !== 0) ? lat : 40.7128,
      lng: (lng && lng !== 0) ? lng : -74.0060
    };
  }
  if (normCountry.includes('kingdom') || normCountry === 'uk' || normCountry === 'gb') {
    return {
      city: city || 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
      flag: '🇬🇧',
      lat: (lat && lat !== 0) ? lat : 51.5074,
      lng: (lng && lng !== 0) ? lng : -0.1278
    };
  }
  if (normCountry.includes('emirates') || normCountry === 'uae' || normCountry === 'ae') {
    return {
      city: city || 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      flag: '🇦🇪',
      lat: (lat && lat !== 0) ? lat : 25.2048,
      lng: (lng && lng !== 0) ? lng : 55.2708
    };
  }

  return {
    city: city || 'Online Visitor',
    country: country || 'Global',
    countryCode: 'GL',
    flag: getCountryFlag(country),
    lat: (lat && lat !== 0) ? lat : 28.6139,
    lng: (lng && lng !== 0) ? lng : 77.2090
  };
}

// Point-in-polygon algorithm
function isPointInPoly(pt: [number, number], poly: [number, number][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Accurate Continental Boundaries for the 3D globe and 2D projections [longitude, latitude]
export const WORLD_CONTINENT_POLYGONS: [number, number][][] = [
  // North America
  [
    [-168, 65], [-160, 71], [-140, 70], [-125, 69], [-105, 68], [-85, 67], [-75, 63],
    [-65, 59], [-60, 50], [-65, 44], [-75, 36], [-81, 25], [-87, 21], [-83, 10],
    [-77, 8], [-83, 8], [-88, 14], [-97, 18], [-105, 23], [-117, 32], [-124, 40],
    [-125, 50], [-135, 58], [-145, 60], [-162, 60], [-168, 65]
  ],
  // Greenland
  [
    [-44, 60], [-25, 70], [-20, 78], [-35, 83], [-55, 82], [-70, 76], [-55, 68], [-44, 60]
  ],
  // South America
  [
    [-77, 8], [-68, 12], [-60, 8], [-50, -1], [-35, -5], [-35, -12], [-40, -22],
    [-50, -30], [-55, -40], [-66, -54], [-74, -52], [-72, -40], [-71, -30], [-76, -18],
    [-81, -5], [-77, 8]
  ],
  // Europe
  [
    [-9, 36], [-9, 43], [-1, 44], [3, 47], [9, 54], [9, 58], [15, 56], [22, 55],
    [28, 60], [30, 70], [20, 71], [10, 64], [5, 62], [2, 51], [-5, 48], [-9, 36]
  ],
  // Scandinavia
  [
    [5, 58], [10, 58], [18, 60], [25, 65], [30, 70], [20, 71], [15, 68], [10, 64], [5, 58]
  ],
  // Great Britain & Ireland
  [
    [-5, 50], [1, 51], [0, 53], [-2, 57], [-5, 58], [-6, 55], [-3, 53], [-5, 50]
  ],
  // Africa
  [
    [-17, 14], [-17, 21], [-13, 28], [-6, 35], [11, 37], [25, 32], [33, 31], [35, 27],
    [43, 12], [51, 10], [42, 2], [40, -10], [35, -20], [32, -28], [28, -34], [18, -34],
    [12, -20], [9, -5], [2, 6], [-10, 5], [-15, 11], [-17, 14]
  ],
  // Madagascar
  [
    [43, -12], [50, -13], [50, -25], [44, -25], [43, -12]
  ],
  // Asia - North & Siberia
  [
    [30, 70], [40, 68], [60, 70], [80, 73], [105, 77], [130, 72], [160, 70], [175, 65],
    [170, 60], [160, 55], [140, 52], [130, 43], [120, 40], [110, 42], [90, 48],
    [65, 50], [50, 50], [40, 55], [30, 60], [30, 70]
  ],
  // Asia - India Subcontinent (Detailed & Prominent)
  [
    [68, 24], [72, 31], [77, 35], [80, 31], [88, 27], [92, 26], [90, 22], [85, 20],
    [80, 16], [80, 10], [77, 8], [76, 10], [73, 15], [72, 19], [68, 24]
  ],
  // Sri Lanka
  [
    [79.8, 6.0], [81.8, 6.5], [81.8, 8.8], [80.2, 9.8], [79.8, 6.0]
  ],
  // Asia - East & Southeast Asia
  [
    [105, 22], [110, 20], [117, 24], [122, 30], [120, 38], [118, 40], [110, 42],
    [100, 36], [95, 25], [100, 15], [105, 10], [103, 1], [108, 10], [105, 22]
  ],
  // Middle East & Arabia
  [
    [35, 30], [42, 30], [48, 30], [50, 25], [59, 23], [56, 17], [45, 13], [43, 13],
    [38, 22], [35, 30]
  ],
  // Japan
  [
    [130, 31], [135, 34], [141, 38], [142, 44], [145, 43], [140, 36], [132, 33], [130, 31]
  ],
  // Indonesia & Philippines
  [
    [95, 5], [106, -6], [115, -8], [120, -9], [124, -8], [117, -2], [110, -1], [98, 3], [95, 5]
  ],
  [
    [120, 14], [125, 10], [126, 6], [122, 7], [120, 14]
  ],
  // Australia
  [
    [114, -22], [123, -15], [136, -12], [142, -11], [148, -20], [153, -28], [150, -37],
    [142, -38], [130, -32], [115, -34], [113, -26], [114, -22]
  ],
  // New Zealand
  [
    [167, -46], [174, -41], [178, -38], [174, -36], [172, -42], [167, -46]
  ]
];

// Pre-computed high-resolution land dots for 3D Globe with beautiful organic distribution
export const COMPUTED_LAND_DOTS: [number, number][] = (() => {
  const dots: [number, number][] = [];
  const step = 1.8; // fine grain dot grid

  for (const poly of WORLD_CONTINENT_POLYGONS) {
    const xs = poly.map(p => p[0]);
    const ys = poly.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    for (let lat = minY; lat <= maxY; lat += step) {
      for (let lon = minX; lon <= maxX; lon += step) {
        if (isPointInPoly([lon, lat], poly)) {
          // slight pseudo-random jitter for natural dot distribution
          const jitterX = ((Math.sin(lon * 17.1 + lat * 31.7) + 1) / 2 - 0.5) * 0.35;
          const jitterY = ((Math.cos(lat * 19.3 + lon * 23.9) + 1) / 2 - 0.5) * 0.35;
          dots.push([lon + jitterX, lat + jitterY]);
        }
      }
    }
  }
  return dots;
})();

// Conversion from Longitude & Latitude to 2D SVG canvas (Equirectangular)
export function geoTo2D(lon: number, lat: number, width = 1000, height = 500): { x: number; y: number } {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x: Math.max(0, Math.min(width, x)), y: Math.max(0, Math.min(height, y)) };
}
