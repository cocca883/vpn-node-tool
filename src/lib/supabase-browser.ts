import type { LocalAuthResponse, LocalSession } from '@/lib/local-auth-types';

type AuthChangeCallback = (event: string, session: LocalSession | null) => void;

const SESSION_STORAGE_KEY = 'vpn-node-tool-session-token';

interface Credentials {
  email: string;
  password: string;
}

interface LocalAuthClient {
  auth: {
    getSession: () => Promise<{ data: { session: LocalSession | null } }>;
    signInWithPassword: (credentials: Credentials) => Promise<LocalAuthResponse>;
    signUp: (credentials: Credentials) => Promise<LocalAuthResponse>;
    signOut: () => Promise<{ error: null }>;
    onAuthStateChange: (
      callback: AuthChangeCallback
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
}

const subscribers = new Set<AuthChangeCallback>();
let browserClient: LocalAuthClient | null = null;

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function notify(event: string, session: LocalSession | null): void {
  for (const subscriber of subscribers) {
    subscriber(event, session);
  }
}

async function requestAuth(path: string, body?: Credentials): Promise<LocalAuthResponse> {
  const token = getStoredToken();
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    return { data: { session: null, user: null }, error: { message: data.error || '认证失败' } };
  }

  const session = (data.session ?? null) as LocalSession | null;
  return { data: { session, user: session?.user ?? data.user ?? null }, error: null };
}

function createLocalAuthClient(): LocalAuthClient {
  return {
    auth: {
      async getSession() {
        const token = getStoredToken();
        if (!token) return { data: { session: null } };

        const response = await requestAuth('/api/auth/session');
        if (response.error || !response.data.session) {
          setStoredToken(null);
          return { data: { session: null } };
        }

        return { data: { session: response.data.session } };
      },

      async signInWithPassword(credentials: Credentials) {
        const response = await requestAuth('/api/auth/sign-in', credentials);
        if (response.data.session) {
          setStoredToken(response.data.session.access_token);
          notify('SIGNED_IN', response.data.session);
        }
        return response;
      },

      async signUp(credentials: Credentials) {
        const response = await requestAuth('/api/auth/sign-up', credentials);
        if (response.data.session) {
          setStoredToken(response.data.session.access_token);
          notify('SIGNED_IN', response.data.session);
        }
        return response;
      },

      async signOut() {
        const token = getStoredToken();
        if (token) {
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        setStoredToken(null);
        notify('SIGNED_OUT', null);
        return { error: null };
      },

      onAuthStateChange(callback: AuthChangeCallback) {
        subscribers.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => subscribers.delete(callback),
            },
          },
        };
      },
    },
  };
}

function getSupabaseBrowserClient(): LocalAuthClient {
  if (!browserClient) {
    browserClient = createLocalAuthClient();
  }
  return browserClient;
}

async function getSupabaseBrowserClientWithRetry(): Promise<LocalAuthClient> {
  return getSupabaseBrowserClient();
}

async function getSupabaseBrowserClientAsync(): Promise<LocalAuthClient> {
  return getSupabaseBrowserClient();
}

function waitForConfig(): Promise<boolean> {
  return Promise.resolve(true);
}

export { getSupabaseBrowserClient, getSupabaseBrowserClientWithRetry, getSupabaseBrowserClientAsync, waitForConfig };
