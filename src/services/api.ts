import { store } from '../app/store';

const API_BASE = '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; status?: number; data?: T; message?: string; [key: string]: any }> {
  const token = store.getState().auth.token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (typeof token === 'string' && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  try {
    const normalizedEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : endpoint.startsWith('api/')
      ? `/${endpoint.slice(4)}`
      : endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;

    const res = await fetch(`${API_BASE}${normalizedEndpoint}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    const rawText = await res.text();
    let data: any = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        message: data?.message || `Request failed with status ${res.status}`,
        ...(typeof data === 'object' && data !== null ? data : {}),
      };
    }

    return {
      success: true,
      status: res.status,
      ...(typeof data === 'object' && data !== null ? data : { data }),
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      message: err?.message || 'Network error occurred.',
    };
  }
}
