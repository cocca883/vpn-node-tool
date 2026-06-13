'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface SupabaseConfigContextType {
  config: SupabaseConfig | null;
  isLoading: boolean;
  error: string | null;
}

const SupabaseConfigContext = createContext<SupabaseConfigContextType>({
  config: null,
  isLoading: true,
  error: null,
});

export const SUPABASE_CONFIG_READY_EVENT = 'supabase-config-ready';

export function useSupabaseConfig() {
  return useContext(SupabaseConfigContext);
}

interface SupabaseConfigProviderProps {
  children: ReactNode;
}

export function SupabaseConfigProvider({ children }: SupabaseConfigProviderProps) {
  const [config, setConfig] = useState<SupabaseConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 3;

    async function loadConfig(): Promise<void> {
      try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.url && data.anonKey) {
          setConfig(data);
          (window as unknown as { __SUPABASE_CONFIG__: SupabaseConfig }).__SUPABASE_CONFIG__ = data;
          window.dispatchEvent(new CustomEvent(SUPABASE_CONFIG_READY_EVENT, { detail: data }));
          setError(null);
        } else {
          throw new Error('Invalid config response');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        retries++;
        if (retries < maxRetries) {
          setTimeout(loadConfig, 1000 * retries);
        } else {
          setError(message);
          console.error('Failed to load Supabase config after retries:', message);
        }
      } finally {
        if (retries >= maxRetries || config !== null) {
          setIsLoading(false);
        }
      }
    }

    loadConfig();
  }, []);

  useEffect(() => {
    if (config || error) {
      setIsLoading(false);
    }
  }, [config, error]);

  return (
    <SupabaseConfigContext.Provider value={{ config, isLoading, error }}>
      {children}
    </SupabaseConfigContext.Provider>
  );
}
