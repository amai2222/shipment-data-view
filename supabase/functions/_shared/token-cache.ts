// 共享 Token 缓存模块（供所有 Edge Functions 使用）
// @ts-expect-error - Edge Function运行在Deno环境，ESM导入在运行时可用
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 配置区域
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  accounts: {
    ADD: {
      username: "carquery",
      // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
      password: Deno.env.get('PWD_ADD') || Deno.env.get('TRACKING_ADD_PASSWORD') || "Zk19090323j",
      referer: "https://zkzy.zkzy1688.com/console/",
      clientId: 100,
      hasMenu: true
    },
    QUERY: {
      username: "cladmin",
      // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
      password: Deno.env.get('PWD_QUERY') || Deno.env.get('TRACKING_QUERY_PASSWORD') || "Zk16120325j",
      referer: "https://zkzy.zkzy1688.com/monitor/",
      clientId: 3,
      hasMenu: false
    }
  }
};

// 内存缓存（用于单次调用内的缓存，避免重复数据库查询）
const MEMORY_CACHE: {
  ADD: { token: string; expiresAt: number } | null;
  QUERY: { token: string; expiresAt: number } | null;
} = {
  ADD: null,
  QUERY: null
};

/**
 * MD5 加密函数
 * 使用第三方 MD5 库（因为 Deno Web Crypto API 不支持 MD5）
 */
async function md5(message: string): Promise<string> {
  // 使用 esm.sh 提供的 MD5 库
  // @ts-expect-error - Deno 环境支持动态导入
  const { default: md5Hash } = await import('https://esm.sh/md5@2.3.0');
  return md5Hash(message);
}

/**
 * 从数据库获取 Token
 */
async function getTokenFromDatabase(type: 'add' | 'query'): Promise<{ token: string; expiresAt: number } | null> {
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ 缺少 Supabase 环境变量，无法使用数据库缓存');
    return null;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data, error } = await supabase
      .from('tracking_token_cache')
      .select('token_value, expires_at')
      .eq('token_type', type)
      .single();
    
    if (error || !data) {
      console.log(`📋 数据库中没有 ${type} 类型的 Token 缓存`);
      return null;
    }
    
    const expiresAt = new Date(data.expires_at).getTime();
    const now = Date.now();
    
    // 检查是否过期（提前5分钟刷新，确保 Token 有效）
    const bufferTime = 5 * 60 * 1000; // 5分钟缓冲时间
    if (now >= expiresAt - bufferTime) {
      console.log(`⏰ Token 已过期或即将过期（过期时间: ${new Date(expiresAt).toISOString()}）`);
      return null;
    }
    
    console.log(`✅ 从数据库获取到有效的 ${type} Token（过期时间: ${new Date(expiresAt).toISOString()}）`);
    return {
      token: data.token_value,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error(`❌ 从数据库获取 Token 失败:`, error);
    return null;
  }
}

/**
 * 保存 Token 到数据库
 */
async function saveTokenToDatabase(type: 'add' | 'query', token: string, expiresAt: number): Promise<void> {
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ 缺少 Supabase 环境变量，无法保存 Token 到数据库');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { error } = await supabase
      .from('tracking_token_cache')
      .upsert({
        token_type: type,
        token_value: token,
        expires_at: new Date(expiresAt).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'token_type'
      });
    
    if (error) {
      console.error(`❌ 保存 Token 到数据库失败:`, error);
    } else {
      console.log(`💾 Token 已保存到数据库（类型: ${type}）`);
    }
  } catch (error) {
    console.error(`❌ 保存 Token 到数据库异常:`, error);
  }
}

/**
 * 核心功能：获取 Token（带三层缓存机制）
 * 
 * 1. 内存缓存（单次调用内）
 * 2. 数据库缓存（跨调用共享）
 * 3. 自动登录（缓存失效时）
 * 
 * @param type Token 类型：'add' 或 'query'
 * @returns Token 字符串
 */
export async function getToken(type: 'add' | 'query'): Promise<string> {
  // 转换为内部类型
  const internalType = type === 'add' ? 'ADD' : 'QUERY';
  
  // 1. 检查内存缓存（单次调用内有效）
  const memoryCache = MEMORY_CACHE[internalType];
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    console.log(`✅ [${internalType}] 使用内存缓存 Token`);
    return memoryCache.token;
  }
  
  // 2. 从数据库获取 Token（跨调用缓存）
  const dbToken = await getTokenFromDatabase(type);
  if (dbToken) {
    // 更新内存缓存
    MEMORY_CACHE[internalType] = dbToken;
    return dbToken.token;
  }
  
  // 3. 如果数据库中没有有效 Token，执行登录
  const acc = CONFIG.accounts[internalType];
  console.log(`🔐 [${internalType}] 正在登录账号: ${acc.username} (Client: ${acc.clientId})...`);

  try {
    // 计算 MD5
    const passwordHash = await md5(acc.password);
    
    // 构造 Payload
    const payload: Record<string, unknown> = {
      org: "zkzy",
      user: acc.username,
      password: passwordHash,
      md5: true,
      client: acc.clientId
    };

    // 特殊字段处理
    if (acc.hasMenu) {
      payload.menu = false;
    }

    // 发起登录请求
    const res = await fetch(`${CONFIG.baseUrl}/rest/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Referer": acc.referer,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`登录失败 [${res.status}]: ${err}`);
    }

    // 提取 Token (Auth-Session)
    let token = res.headers.get("Auth-Session");
    
    if (!token) {
      // 尝试从 Body 或 Cookie 获取
      const body = await res.json().catch(() => ({}));
      token = (body as Record<string, unknown>)['Auth-Session'] as string || (body as Record<string, unknown>).token as string;
      
      if (!token) {
        const setCookie = res.headers.get("set-cookie");
        if (setCookie && setCookie.includes("Auth-Session=")) {
          const match = setCookie.match(/Auth-Session=([^;]+)/);
          token = match ? match[1] : null;
        }
      }
    }

    if (!token) throw new Error("登录成功但未获取到 Token");

    console.log(`✅ [${internalType}] 登录成功! Token: ${token.substring(0, 10)}...`);

    // 缓存 Token (25分钟有效期)
    const expiresAt = Date.now() + 25 * 60 * 1000;
    
    // 更新内存缓存
    MEMORY_CACHE[internalType] = {
      token: token,
      expiresAt: expiresAt
    };
    
    // 保存到数据库（等待完成，确保 Token 被保存）
    try {
      await saveTokenToDatabase(type, token, expiresAt);
      console.log(`✅ [${internalType}] Token 已保存到数据库缓存表`);
    } catch (err) {
      // 保存失败不影响返回 Token，但记录错误
      console.error(`⚠️ [${internalType}] 保存 Token 到数据库失败（不影响使用）:`, err);
    }

    return token;

  } catch (error) {
    console.error(`❌ [${internalType}] 登录异常:`, error);
    throw error;
  }
}

/**
 * 获取 Token 详细信息（包含过期时间等）
 * 主要用于 get-tracking-token Edge Function 返回详细信息
 */
export async function getTokenWithInfo(type: 'add' | 'query'): Promise<{ token: string; expiresAt: number }> {
  const internalType = type === 'add' ? 'ADD' : 'QUERY';
  
  // 1. 检查内存缓存
  const memoryCache = MEMORY_CACHE[internalType];
  if (memoryCache && Date.now() < memoryCache.expiresAt) {
    return memoryCache;
  }
  
  // 2. 从数据库获取
  const dbToken = await getTokenFromDatabase(type);
  if (dbToken) {
    MEMORY_CACHE[internalType] = dbToken;
    return dbToken;
  }
  
  // 3. 执行登录
  const token = await getToken(type);
  const expiresAt = MEMORY_CACHE[internalType]?.expiresAt || Date.now() + 25 * 60 * 1000;
  
  return { token, expiresAt };
}

