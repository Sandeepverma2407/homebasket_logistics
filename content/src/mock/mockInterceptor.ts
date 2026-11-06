import { handleMockApiRequest } from './mockService';

let originalFetch: typeof globalThis.fetch | null = null;
let isInterceptorInstalled = false;

const isBackendUrl = (url: string, baseUrl?: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();

  // If URL explicitly matches backend API prefixes
  if (
    lower.includes('/auth/') || 
    lower.includes('/home/') || 
    lower.includes('/orders/') || 
    lower.includes('/delivery/') || 
    lower.includes('/earnings/') || 
    lower.includes('/profile/')
  ) {
    return true;
  }

  // If matches dynamic API base URL
  if (baseUrl && lower.startsWith(baseUrl.toLowerCase())) {
    return true;
  }

  return false;
};

/**
 * Installs the Mock API Interceptor onto global fetch
 * Automatically called when USE_MOCK_DATA = true
 */
export const installMockInterceptor = (getIsMockEnabled: () => boolean, getBaseUrl?: () => string) => {
  if (isInterceptorInstalled) return;

  if (typeof globalThis.fetch === 'function') {
    originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any)?.url || '';
      const isMockEnabled = getIsMockEnabled();
      const baseUrl = getBaseUrl ? getBaseUrl() : undefined;

      if (isMockEnabled && isBackendUrl(url, baseUrl)) {
        try {
          const data = await handleMockApiRequest(url, init);
          const responseText = JSON.stringify(data);

          // Return a fully-featured Response-like object
          const mockResponse: any = {
            ok: true,
            status: 200,
            statusText: 'OK',
            type: 'basic',
            url,
            redirected: false,
            headers: {
              get: (header: string) => header.toLowerCase() === 'content-type' ? 'application/json' : null,
              has: (header: string) => header.toLowerCase() === 'content-type',
              forEach: (cb: any) => cb('application/json', 'content-type'),
            },
            json: async () => data,
            text: async () => responseText,
            blob: async () => new Blob([responseText], { type: 'application/json' }),
            clone: function () { return this; },
          };

          return mockResponse as Response;
        } catch (err) {
          console.error('[MockInterceptor] Error processing mock request:', err);
        }
      }

      // Pass-through to original native fetch for all other requests
      return originalFetch ? originalFetch(input, init) : (fetch as any)(input, init);
    };

    isInterceptorInstalled = true;
    console.log('[HB Logistics] Mock Data Interceptor installed successfully.');
  }
};
