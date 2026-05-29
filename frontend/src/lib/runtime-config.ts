import { API_BASE_URL as DEFAULT_API_BASE_URL, WS_PATH } from '@climence/shared';

/**
 * Runtime-configured API base URL.
 *
 * - In dev/demo we default to the shared constant (http://localhost:3002)
 * - In Docker/HTTPS mode we can override with Vite env: VITE_CLIMENCE_API_URL
 */
export const API_BASE_URL: string =
  (import.meta.env?.VITE_CLIMENCE_API_URL as string | undefined) || DEFAULT_API_BASE_URL;

export function wsBaseUrl() {
  return API_BASE_URL.replace(/^http/, 'ws');
}

export function wsUrlForToken(token: string) {
  return `${wsBaseUrl()}${WS_PATH}?token=${encodeURIComponent(token)}`;
}
