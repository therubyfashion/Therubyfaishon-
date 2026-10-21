import { toast } from 'sonner';

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export interface DetectedLocationResult {
  pincode: string;
  city: string;
  state: string;
  streetOrArea: string;
  fullDisplayName?: string;
}

/**
 * Normalizes state name to match the standard INDIAN_STATES array.
 */
export const normalizeIndianState = (rawState: string): string => {
  if (!rawState) return '';
  const clean = rawState.trim().toLowerCase();

  // Special match for Delhi / NCT
  if (clean.includes('delhi')) return 'Delhi';
  if (clean.includes('jammu') || clean.includes('kashmir')) return 'Jammu and Kashmir';
  if (clean.includes('odisha') || clean.includes('orissa')) return 'Odisha';
  if (clean.includes('pondicherry') || clean.includes('puducherry')) return 'Puducherry';
  if (clean.includes('dadra') || clean.includes('daman') || clean.includes('diu')) {
    return 'Dadra and Nagar Haveli and Daman and Diu';
  }

  const found = INDIAN_STATES.find(s => s.toLowerCase() === clean || clean.includes(s.toLowerCase()));
  return found || rawState.trim();
};

/**
 * Fast 6-digit Pincode lookup for India
 */
export const lookupPincode = async (pincode: string): Promise<{ city: string; state: string; area: string } | null> => {
  const cleanCode = pincode.replace(/\D/g, '').slice(0, 6);
  if (cleanCode.length !== 6) return null;

  try {
    // Try server endpoint first
    const res = await fetch(`/api/lookup-pincode?pincode=${cleanCode}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          city: data.city || '',
          state: normalizeIndianState(data.state || ''),
          area: data.area || ''
        };
      }
    }

    // Direct fallback to postal pincode API
    const fallbackRes = await fetch(`https://api.postalpincode.in/pincode/${cleanCode}`).catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      const data = await fallbackRes.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success') {
        const po = data[0].PostOffice?.[0];
        return {
          city: po?.District || po?.Division || '',
          state: normalizeIndianState(po?.State || ''),
          area: po?.Name || ''
        };
      }
    }
  } catch (err) {
    console.warn("Pincode lookup error:", err);
  }
  return null;
};

/**
 * Detects user's current GPS location and reverse-geocodes it into an Indian shipping address.
 */
export const detectCurrentLocation = async (): Promise<DetectedLocationResult> => {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return reject(new Error("Geolocation unsupported"));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // 1. Try server reverse-geocoding proxy
          let res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`).catch(() => null);
          let data: any = null;

          if (res && res.ok) {
            data = await res.json();
          } else {
            // Direct client fallback to OpenStreetMap Nominatim
            const osmRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  'User-Agent': 'TheRubyFashion/1.0'
                }
              }
            ).catch(() => null);

            if (osmRes && osmRes.ok) {
              const osmData = await osmRes.json();
              const addr = osmData.address || {};
              data = {
                success: true,
                pincode: addr.postcode ? addr.postcode.replace(/\D/g, '').slice(0, 6) : '',
                city: addr.city || addr.town || addr.city_district || addr.suburb || addr.state_district || '',
                state: addr.state || '',
                suburb: addr.suburb || addr.neighbourhood || addr.residential || '',
                road: addr.road || addr.pedestrian || '',
                displayName: osmData.display_name || ''
              };
            }
          }

          if (!data || !data.success) {
            throw new Error("Could not parse address from coordinates.");
          }

          let finalPincode = (data.pincode || '').replace(/\D/g, '').slice(0, 6);
          let finalCity = data.city || '';
          let finalState = normalizeIndianState(data.state || '');
          let streetOrArea = [data.road, data.suburb].filter(Boolean).join(', ');

          // If pincode is detected but city/state are empty, refine with pincode lookup
          if (finalPincode && finalPincode.length === 6 && (!finalCity || !finalState)) {
            const pinDetails = await lookupPincode(finalPincode);
            if (pinDetails) {
              finalCity = finalCity || pinDetails.city;
              finalState = finalState || pinDetails.state;
              if (!streetOrArea && pinDetails.area) streetOrArea = pinDetails.area;
            }
          }

          resolve({
            pincode: finalPincode,
            city: finalCity,
            state: finalState,
            streetOrArea,
            fullDisplayName: data.displayName
          });
        } catch (err: any) {
          console.error("Reverse geocoding error:", err);
          reject(err);
        }
      },
      (geoError) => {
        let msg = "Could not access location.";
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = "Location permission denied. Please enter your address manually.";
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          msg = "GPS signal unavailable. Please enter your address manually.";
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = "Location request timed out. Please enter your address manually.";
        }
        toast.error(msg);
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
};
