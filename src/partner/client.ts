import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('缺少环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

/**
 * 合作方门户专用客户端。
 *
 * storageKey 与内部系统不同（主站是 supabase 默认 key），因此同一浏览器里
 * 内部员工身份和合作方身份互不覆盖，可以同时保持两份登录态。
 * detectSessionInUrl 关闭：门户不做邮箱验证/魔法链接回调。
 */
export const partnerSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'sb-partner-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
