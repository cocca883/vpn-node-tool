'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface SupabaseConfigContextType {
  config: null;
  isLoading: boolean;
  error: string | null;
}

const SupabaseConfigContext = createContext<SupabaseConfigContextType>({
  config: null,
  isLoading: false,
  error: null,
});

export const SUPABASE_CONFIG_READY_EVENT = 'supabase-config-ready';

export function useSupabaseConfig(): SupabaseConfigContextType {
  return useContext(SupabaseConfigContext);
}

export function SupabaseConfigProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseConfigContext.Provider value={{ config: null, isLoading: false, error: null }}>
      {children}
    </SupabaseConfigContext.Provider>
  );
}
