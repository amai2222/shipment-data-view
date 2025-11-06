// Supabase Edge Functions Stubs
// This file provides type stubs for Supabase RPC calls to avoid TypeScript errors

declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc(fn: string, params?: any): any;
  }
}
