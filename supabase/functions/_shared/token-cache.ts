// 共享 Token 缓存模块（供所有 Edge Functions 使用）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// 配置区域
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  accounts: {
    ADD: {
      username: "carquery",
      password: Deno.env.get('PWD_ADD') || Deno.env.get('TRACKING_ADD_PASSWORD') || "Zk19090323j",
      // 第三方实际使用的 MD5 哈希值（从浏览器开发者工具中获取）
      passwordHash: "4807173a3dfd74be2af258eac2368c0f",
      referer: "https://zkzy.zkzy1688.com/console/",
      clientId: 100,
      hasMenu: true
    },
    QUERY: {
      username: "cladmin",
      password: Deno.env.get('PWD_QUERY') || Deno.env.get('TRACKING_QUERY_PASSWORD') || "Zk16120325j",
      // 第三方实际使用的 MD5 哈希值（从浏览器开发者工具中获取）
      passwordHash: "7208851e4c11bbeaaa57772aa4008ba4",
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
 * 使用纯 JavaScript MD5 实现（因为 Deno Web Crypto API 不支持 MD5）
 * 内联实现，不依赖外部模块（确保在 Supabase Edge Functions 中可用）
 */
function md5(message: string): string {
  // 纯 JavaScript MD5 实现（内联，不依赖外部库）
  function md5cycle(x: number[], k: number[]): void {
    let a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function add32(a: number, b: number): number {
    return (a + b) & 0xFFFFFFFF;
  }

  function rhex(n: number): string {
    const hexChars = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += hexChars.charAt((n >> (j * 8 + 4)) & 0x0F) + hexChars.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }

  function hex(x: number[]): string {
    const result: string[] = [];
    for (let i = 0; i < x.length; i++) {
      result.push(rhex(x[i]));
    }
    return result.join('');
  }

  // 将字符串转换为字节数组
  const utf8Encode = (str: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (charCode < 0x80) {
        bytes.push(charCode);
      } else if (charCode < 0x800) {
        bytes.push(0xc0 | (charCode >> 6));
        bytes.push(0x80 | (charCode & 0x3f));
      } else if (charCode < 0xd800 || charCode >= 0xe000) {
        bytes.push(0xe0 | (charCode >> 12));
        bytes.push(0x80 | ((charCode >> 6) & 0x3f));
        bytes.push(0x80 | (charCode & 0x3f));
      } else {
        i++;
        const charCode2 = str.charCodeAt(i);
        const codePoint = 0x10000 + (((charCode & 0x3ff) << 10) | (charCode2 & 0x3ff));
        bytes.push(0xf0 | (codePoint >> 18));
        bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
        bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
        bytes.push(0x80 | (codePoint & 0x3f));
      }
    }
    return bytes;
  };

  const msgBytes = utf8Encode(message);
  const n = msgBytes.length;
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  let i: number;

  // 扩展数组到 64 字节的倍数
  const msg: number[] = [...msgBytes];
  msg.push(0x80);
  
  // 填充到 56 字节（448 位）的倍数
  while (msg.length % 64 !== 56) {
    msg.push(0);
  }

  // 添加原始消息长度（64位，小端序）
  const lengthBytes: number[] = [];
  let length = n * 8;
  for (i = 0; i < 8; i++) {
    lengthBytes[i] = length & 0xff;
    length >>>= 8;
  }

  for (i = 0; i < lengthBytes.length; i++) {
    msg.push(lengthBytes[i]);
  }

  for (i = 0; i < msg.length; i += 64) {
    const chunk: number[] = [];
    for (let j = 0; j < 64; j += 4) {
      chunk[j / 4] = msg[i + j] | (msg[i + j + 1] << 8) | (msg[i + j + 2] << 16) | (msg[i + j + 3] << 24);
    }
    md5cycle(state, chunk);
  }

  return hex(state);
}

/**
 * 从数据库获取 Token
 */
async function getTokenFromDatabase(type: 'add' | 'query'): Promise<{ token: string; expiresAt: number } | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
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
    // 内存缓存命中：这是正常的优化行为，不需要记录日志
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
    // 优先使用第三方实际使用的 MD5 哈希值（如果配置了）
    // 否则计算 MD5（虽然计算结果可能不匹配，但保留作为备用）
    const passwordHash = (acc as { passwordHash?: string }).passwordHash || md5(acc.password);
    console.log(`🔑 [${internalType}] 使用密码 MD5 哈希: ${passwordHash}`);
    if ((acc as { passwordHash?: string }).passwordHash) {
      console.log(`   ✅ 使用第三方实际哈希值（跳过 MD5 计算）`);
    } else {
      console.log(`   ⚠️ 使用计算的 MD5 哈希值（可能不匹配第三方）`);
    }
    
    // 构造 Payload
    const payload: Record<string, unknown> = {
      org: "zkzy",
      user: acc.username,
      password: passwordHash,
      md5: true,
      client: acc.clientId
    };
    
    // 🔴 验证密码哈希值是否正确
    console.log(`🔑 [${internalType}] 密码哈希值验证:`, {
      expected: (acc as { passwordHash?: string }).passwordHash || 'N/A',
      actual: passwordHash,
      match: passwordHash === ((acc as { passwordHash?: string }).passwordHash || '')
    });
    console.log(`📤 [${internalType}] 登录 Payload:`, JSON.stringify(payload));

    // 发起登录请求（带超时和重试机制）
    const maxRetries = 3;
    const timeout = 60000; // 🔴 增加到60秒超时（第三方API可能响应较慢）
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [${internalType}] 登录尝试 ${attempt}/${maxRetries}...`);
        
        // 使用 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // 🔴 构造完整的请求头（与浏览器请求保持一致，参考其他成功请求）
        const headers: Record<string, string> = {
          "Content-Type": "application/json;charset=UTF-8",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Referer": acc.referer,
          "Origin": CONFIG.baseUrl,
          "X-Requested-With": "XMLHttpRequest", // 🔴 添加此请求头（其他成功请求都有）
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
        };

        console.log(`📤 [${internalType}] 发送登录请求到: ${CONFIG.baseUrl}/rest/session`);
        console.log(`📤 [${internalType}] 请求头:`, JSON.stringify(headers, null, 2));
        console.log(`📤 [${internalType}] 请求体:`, JSON.stringify(payload));
        console.log(`⏱️ [${internalType}] 开始发送请求，超时时间: ${timeout}ms`);
        
        let res: Response;
        try {
          res = await fetch(`${CONFIG.baseUrl}/rest/session`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          console.log(`✅ [${internalType}] 请求完成，收到响应`);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error(`❌ [${internalType}] fetch 请求失败:`, {
            errorName: fetchError instanceof Error ? fetchError.name : 'Unknown',
            errorMessage: fetchError instanceof Error ? fetchError.message : String(fetchError),
            errorStack: fetchError instanceof Error ? fetchError.stack : undefined
          });
          throw fetchError; // 重新抛出，让外层 catch 处理
        }
        
        console.log(`📥 [${internalType}] 登录响应状态: ${res.status} ${res.statusText}`);
        console.log(`📥 [${internalType}] 响应头:`, JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
        
        // 🔴 先读取响应文本（用于调试）
        let responseText: string;
        try {
          responseText = await res.text();
          console.log(`📥 [${internalType}] 响应体（前500字符）:`, responseText.substring(0, 500));
        } catch (textError) {
          console.error(`❌ [${internalType}] 读取响应体失败:`, textError);
          responseText = '';
        }
        
        // 🔴 检查响应状态
        if (!res.ok) {
          // 尝试解析错误响应
          let errorMessage = `登录失败 [${res.status}]: ${responseText}`;
          try {
            const errorBody = JSON.parse(responseText);
            if (errorBody.message || errorBody.error) {
              errorMessage = `登录失败 [${res.status}]: ${errorBody.message || errorBody.error}`;
            }
          } catch (e) {
            // 响应不是JSON，使用原始文本
          }
          console.error(`❌ [${internalType}] 登录失败:`, errorMessage);
          throw new Error(errorMessage);
        }
        
        // 🔴 如果响应成功（200-299），继续处理
        if (res.ok) {
          
          // 🔴 提取 Token（多种方式尝试）
          let token: string | null = null;
          
          // 方式1：从响应头获取
          token = res.headers.get("Auth-Session");
          if (token) {
            console.log(`✅ [${internalType}] 从响应头获取到 Token`);
          }
          
          // 方式2：从 Set-Cookie 头获取
          if (!token) {
            const setCookie = res.headers.get("set-cookie");
            if (setCookie) {
              console.log(`🔍 [${internalType}] Set-Cookie 头:`, setCookie);
              const match = setCookie.match(/Auth-Session=([^;]+)/);
              if (match) {
                token = decodeURIComponent(match[1]);
                console.log(`✅ [${internalType}] 从 Set-Cookie 获取到 Token`);
              }
            }
          }
          
          // 方式3：从响应体获取
          if (!token && responseText) {
            try {
              const body = JSON.parse(responseText);
              token = (body as Record<string, unknown>)['Auth-Session'] as string || 
                      (body as Record<string, unknown>).token as string ||
                      (body as Record<string, unknown>).authSession as string;
              if (token) {
                console.log(`✅ [${internalType}] 从响应体获取到 Token`);
              }
            } catch (e) {
              // 响应体不是JSON，尝试从文本中提取
              const tokenMatch = responseText.match(/Auth-Session[=:]\s*([^\s;,"']+)/i);
              if (tokenMatch) {
                token = tokenMatch[1];
                console.log(`✅ [${internalType}] 从响应文本中提取到 Token`);
              }
            }
          }

          if (!token) {
            console.error(`❌ [${internalType}] 无法从响应中提取 Token`);
            console.error(`   响应状态: ${res.status}`);
            console.error(`   响应头:`, JSON.stringify(Object.fromEntries(res.headers.entries())));
            console.error(`   响应体:`, responseText);
            throw new Error("登录成功但未获取到 Token，请检查响应格式");
          }

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
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 🔴 详细记录错误信息
        console.error(`❌ [${internalType}] 登录尝试 ${attempt} 失败:`, {
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        });
        
        // 检查是否是超时或连接错误
        const isTimeoutError = 
          (error instanceof Error && (
            error.name === 'AbortError' || 
            error.message.includes('timeout') || 
            error.message.includes('Connection timed out') || 
            error.message.includes('tcp connect error') ||
            error.message.includes('network') ||
            error.message.includes('fetch failed')
          )) ||
          (error && typeof error === 'object' && 'code' in error && (
            error.code === 'ETIMEDOUT' || 
            error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND'
          ));
        
        if (isTimeoutError && attempt < maxRetries) {
          const waitTime = attempt * 2000; // 递增等待时间：2秒、4秒、6秒
          console.warn(`⚠️ [${internalType}] 连接超时或网络错误，${waitTime/1000}秒后重试 (${attempt}/${maxRetries})...`);
          console.warn(`   错误详情: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // 继续重试
        } else {
          // 最后一次尝试或非超时错误，直接抛出
          if (attempt === maxRetries) {
            console.error(`❌ [${internalType}] 登录失败：已重试 ${maxRetries} 次，仍然失败`);
            console.error(`   最终错误: ${lastError.message}`);
          }
          throw lastError;
        }
      }
    }
    
    // 所有重试都失败（理论上不会到达这里，因为最后一次会 throw）
    throw lastError || new Error(`登录失败：已重试 ${maxRetries} 次`);

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

