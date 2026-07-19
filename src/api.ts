/**
 * Centralized API utility for resilient cross-origin communication.
 * When running in custom-hosted environments (like GitHub Pages), this utility 
 * tries the pre-production container first, and falls back to the active development 
 * container automatically if the primary container is dormant or blocked.
 */

const PRIMARY_BASE = 'https://ais-pre-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';
const SECONDARY_BASE = 'https://ais-dev-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';

export const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (
    hostname.includes('localhost') ||
    hostname.includes('run.app') ||
    hostname.includes('0.0.0.0') ||
    hostname.includes('127.0.0.1')
  ) {
    return '';
  }
  // Default to pre-production container for external sites, but resilientFetch handles fallback
  return PRIMARY_BASE;
})();

export async function resilientFetch(path: string, options?: RequestInit): Promise<Response> {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = (
    hostname.includes('localhost') ||
    hostname.includes('run.app') ||
    hostname.includes('0.0.0.0') ||
    hostname.includes('127.0.0.1') ||
    hostname === ''
  );

  if (isLocal) {
    // Relative fetch directly to the current container hosting the frontend
    return fetch(path, options);
  }

  // Ensure path starts with a slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Try the primary container (Pre-production)
  try {
    const primaryUrl = `${PRIMARY_BASE}${cleanPath}`;
    const response = await fetch(primaryUrl, options);
    // If the response is OK or a valid client-side error (like 400 or 401), return it.
    // We only want to fall back if there's a network/CORS error or a 5xx server error.
    if (response.ok || response.status < 500) {
      return response;
    }
    throw new Error(`Primary container returned server error: ${response.status}`);
  } catch (err) {
    console.warn(`Primary container API call failed for ${cleanPath}. Attempting active dev container fallback...`, err);
    
    // Try the secondary container (Development)
    try {
      const secondaryUrl = `${SECONDARY_BASE}${cleanPath}`;
      const response = await fetch(secondaryUrl, options);
      return response;
    } catch (fallbackErr) {
      console.error(`Both pre-production and development containers failed for ${cleanPath}:`, fallbackErr);
      throw fallbackErr;
    }
  }
}
