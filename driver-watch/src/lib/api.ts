const RENDER_BACKEND_URL = 'https://driver-watch.onrender.com';
const LOCAL_BACKEND_URL = 'http://localhost:8000';

const isLocalFrontendHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE_URLS = Array.from(
  new Set(
    [
      import.meta.env.VITE_API_BASE_URL,
      isLocalFrontendHost ? LOCAL_BACKEND_URL : RENDER_BACKEND_URL,
      isLocalFrontendHost ? RENDER_BACKEND_URL : LOCAL_BACKEND_URL,
    ].filter((value): value is string => Boolean(value))
  )
);

let activeBaseUrl: string | null = null;

async function requestWithFallback(path: string, init?: RequestInit) {
  const failures: string[] = [];
  const orderedBaseUrls = activeBaseUrl
    ? [activeBaseUrl, ...API_BASE_URLS.filter((baseUrl) => baseUrl !== activeBaseUrl)]
    : API_BASE_URLS;

  for (const baseUrl of orderedBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (response.ok) {
        activeBaseUrl = baseUrl;
        return response;
      }

      const errorText = await response.text().catch(() => '');
      const compactError = (errorText || '').replace(/\s+/g, ' ').trim();
      failures.push(
        `${baseUrl}${path} -> ${response.status}${compactError ? ` ${compactError}` : ''}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown network error';
      failures.push(`${baseUrl}${path} -> network error: ${message}`);
    }
  }

  if (failures.length === 0) {
    throw new Error(`Unable to reach backend for ${path}`);
  }

  throw new Error(failures.join(' | '));
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await requestWithFallback(path);
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await requestWithFallback(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return response.json() as Promise<T>;
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const response = await requestWithFallback(path, {
    method: 'POST',
    body: formData,
  });

  return response.json() as Promise<T>;
}
