import { supabase } from '../supabase';

/**
 * Returns an Authorization header containing the current Supabase user's JWT access token
 * if an active session exists.
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (err) {
    console.warn("Could not retrieve Supabase session token:", err);
  }
  return {};
}

// Preserve original window.fetch reference
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

/**
 * Enhanced fetch wrapper (FIX 5) that automatically attaches 'Authorization: Bearer <token>'
 * to outgoing API requests while preserving caller headers and options.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authHeaders = await getAuthHeader();
  const headers = new Headers(init?.headers || {});

  if (authHeaders.Authorization && !headers.has('Authorization')) {
    headers.set('Authorization', authHeaders.Authorization);
  }

  return nativeFetch(input, {
    ...init,
    headers
  });
}

/**
 * Global fetch interceptor ensuring all fetch() calls to /api/ routes
 * automatically include the Bearer token without needing to rewrite hundreds of calls.
 */
let interceptorInstalled = false;
export function setupApiAuthInterceptor() {
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;

  const originalWindowFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (input && typeof (input as Request).url === 'string') {
      urlStr = (input as Request).url;
    }

    if (urlStr && urlStr.includes('/api/')) {
      const authHeaders = await getAuthHeader();
      const headers = new Headers(init?.headers || {});

      if (authHeaders.Authorization && !headers.has('Authorization')) {
        headers.set('Authorization', authHeaders.Authorization);
      }

      return originalWindowFetch(input, {
        ...init,
        headers
      });
    }

    return originalWindowFetch(input, init);
  };
}
