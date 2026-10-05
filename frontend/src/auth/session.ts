// Token and selected company live in localStorage so a page reload keeps the user signed in.
// Every access is guarded: storage can be unavailable (private mode, blocked site data).

const TOKEN_KEY = 'stagetrack.token';
const COMPANY_KEY = 'stagetrack.company';

type Listener = () => void;
const expiredListeners = new Set<Listener>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session simply lasts for this tab */
  }
}

let memoryToken = read(TOKEN_KEY);
let expireReason: { code: string; details: Record<string, unknown> } | null = null;
let memoryCompany = read(COMPANY_KEY);

export const session = {
  getToken: () => memoryToken,
  setToken(token: string | null) {
    memoryToken = token;
    write(TOKEN_KEY, token);
  },
  getCompanyId: () => memoryCompany,
  setCompanyId(companyId: string | null) {
    memoryCompany = companyId;
    write(COMPANY_KEY, companyId);
  },
  /** Called on HTTP 401: clears the token and lets the auth context return to the login page. */
  expire(reason?: { code: string; details: Record<string, unknown> }) {
    if (!memoryToken) return;
    if (reason) expireReason = reason;
    session.setToken(null);
    expiredListeners.forEach((l) => l());
  },
  /** Why the server ended the session (e.g. Tenant.Suspended); read once by the login page. */
  takeExpireReason() {
    const reason = expireReason;
    expireReason = null;
    return reason;
  },
  onExpired(listener: Listener) {
    expiredListeners.add(listener);
    return () => {
      expiredListeners.delete(listener);
    };
  },
};
