// 文件路径: supabase/functions/qiniu-delete/index.ts
// 版本: 最终修正版 (已解决中文文件名编码问题)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeUrlsafeBase64Encode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_');
}

async function generateManagementToken(accessKey: string, secretKey: string, url: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const signStr = `${url}\n${body}`;
  
  const signData = encoder.encode(signStr);
  
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
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
      return new Response(JSON.stringify({ success: true, message: 'No files to delete.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // ★★★ 核心修正: 使用 decodeURIComponent 解码包含中文等特殊字符的 key ★★★
    const keys = urls.map(url => decodeURIComponent(new URL(url).pathname.substring(1))).filter(Boolean);

    const ops = keys.map(key => `op=/delete/${safeUrlsafeBase64Encode(`${QINIU_BUCKET}:${key}`)}`);
    const requestBody = ops.join('&');
    
    const urlPath = '/batch';
    const token = await generateManagementToken(QINIU_ACCESS_KEY, QINIU_SECRET_KEY, urlPath, requestBody);

    const response = await fetch('https://rs.qiniu.com/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': token },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qiniu batch delete failed: ${response.status} ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error('Critical error in qiniu-delete function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
