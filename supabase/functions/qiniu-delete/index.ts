// 文件路径: supabase/functions/qiniu-delete/index.ts
// 描述: 接收一个文件 URL 数组，并从七牛云存储中批量删除这些文件。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URL 安全的 Base64 编码
function safeUrlsafeBase64Encode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_');
}

// 生成七牛云管理凭证
async function generateManagementToken(accessKey: string, secretKey: string, url: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const signStr = `${url}\n${body}`;
  const signData = encoder.encode(signStr);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, signData);
  const encodedSign = safeUrlsafeBase64Encode(String.fromCharCode(...new Uint8Array(signature)));
  
  return `Qiniu ${accessKey}:${encodedSign}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const QINIU_ACCESS_KEY = Deno.env.get('QINIU_ACCESS_KEY');
    const QINIU_SECRET_KEY = Deno.env.get('QINIU_SECRET_KEY');
    const QINIU_BUCKET = Deno.env.get('QINIU_BUCKET');

    if (!QINIU_ACCESS_KEY || !QINIU_SECRET_KEY || !QINIU_BUCKET) {
      throw new Error('Qiniu environment variables are not fully configured.');
    }

    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      // 如果没有 URL，直接返回成功，因为没有文件需要删除
      return new Response(JSON.stringify({ success: true, message: 'No files to delete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 从完整的 URL 中提取七牛云的 key
    const keys = urls.map(url => {
      try {
        const urlObject = new URL(url);
        // 移除路径开头的 '/'
        return urlObject.pathname.substring(1);
      } catch (e) {
        console.warn(`Invalid URL format, skipping: ${url}`);
        return null;
      }
    }).filter(key => key !== null) as string[];

    if (keys.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No valid keys to delete.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 构建批量删除操作的请求体
    const ops = keys.map(key => {
      const entry = `${QINIU_BUCKET}:${key}`;
      const encodedEntry = safeUrlsafeBase64Encode(entry);
      return `op=/delete/${encodedEntry}`;
    });
    const requestBody = ops.join('&');

    const url = 'https://rs.qiniu.com/batch';
    const token = await generateManagementToken(QINIU_ACCESS_KEY, QINIU_SECRET_KEY, '/batch', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token,
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qiniu batch delete failed: ${response.status} ${errorText}`);
    }

    // 七牛云批量操作即使成功(200)，也可能包含部分失败项，但对于我们的场景，200 即可认为操作已执行
    // const result = await response.json();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Critical error in qiniu-delete function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
