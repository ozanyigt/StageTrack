import axios, { AxiosError } from 'axios';
import { session } from '../auth/session';
import i18n from '../i18n';

/** Normalized backend error. `code` is translated through the "errors" namespace of the locale files. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> = {},
    public readonly validationErrors: { field: string; message: string }[] = [],
  ) {
    super(code);
  }
}

interface ErrorResponse {
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    validationErrors?: { field: string; message: string }[] | null;
  };
}

export const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = session.getCompanyId();
  if (companyId) config.headers['X-Company-Id'] = companyId;
  config.headers['Accept-Language'] = i18n.language;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data?.error;
    if (status === 401) {
      // Suspended firm / expired subscription: the login page explains why the user was signed out.
      session.expire(body && body.code !== 'Common.Unauthorized' ? { code: body.code, details: body.details ?? {} } : undefined);
    }

    if (body) {
      return Promise.reject(new ApiError(body.code, status, body.details ?? {}, body.validationErrors ?? []));
    }

    return Promise.reject(new ApiError(status === 0 ? 'Common.Network' : 'Common.Unexpected', status));
  },
);

/** Serializes arrays as repeated keys (statuses=A&statuses=B), which ASP.NET Core binds to lists. */
export function toQuery(params: Record<string, unknown>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => query.append(key, String(v)));
    else query.append(key, String(value));
  }
  return query;
}
