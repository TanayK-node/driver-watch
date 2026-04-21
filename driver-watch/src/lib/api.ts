const API_BASE_URLS = Array.from(
  new Set(
    [
      import.meta.env.VITE_API_BASE_URL,
      'http://localhost:8000',
      'https://driver-watch.onrender.com',
    ].filter((value): value is string => Boolean(value))
  )
);

async function requestWithFallback(path: string, init?: RequestInit) {
  const failures: string[] = [];

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (response.ok) return response;

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
