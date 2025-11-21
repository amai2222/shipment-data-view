// 使用环境变量配置 Supabase 客户端
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ✅ 从环境变量读取配置（安全）
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 验证环境变量是否存在
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    '缺少必要的环境变量：请在 .env.local 文件中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});