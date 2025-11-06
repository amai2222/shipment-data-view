// Global Supabase RPC type overrides
// This file provides relaxed typing for RPC calls to avoid TypeScript errors

import type { SupabaseClient } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc<T = any>(
      fn: string,
      params?: Record<string, any>,
      options?: { count?: 'exact' | 'planned' | 'estimated' }
    ): PromiseLike<{ data: T | null; error: any; count?: number }>;
  }
}

export interface RolePermissionTemplate {
  id: string;
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
}
