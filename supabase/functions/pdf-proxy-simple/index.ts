// supabase/functions/pdf-proxy-simple/index.ts
// 简化版本，暂时移除认证要求用于测试

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 允许的域名列表，用于安全校验
const ALLOWED_DOMAINS = [
  "photo.325218.xyz",  // 七牛云存储域名
  "zkzy.325218.xyz"    // 生产环境域名
];

serve(async (req) => {
  // 设置CORS头，允许任何来源的前端应用调用此函数
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  // 响应OPTIONS预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 从请求的URL中获取要代理的文件URL
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "URL parameter is missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Requesting file:", targetUrl);

    // --- 安全性检查：确保我们只代理来自允许域名的文件 ---
    const targetDomain = new URL(targetUrl).hostname;
    if (!ALLOWED_DOMAINS.includes(targetDomain)) {
      return new Response(JSON.stringify({ 
        error: "Proxying from this domain is not allowed",
        allowedDomains: ALLOWED_DOMAINS,
        requestedDomain: targetDomain
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 使用fetch去请求真正的文件
    const response = await fetch(targetUrl);

    // 如果请求失败，返回错误
    if (!response.ok) {
      console.log("Fetch failed:", response.status, response.statusText);
      return new Response(response.body, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // 成功获取文件，将文件内容作为响应体返回给前端
    // 重要的是，我们保留了原始的Content-Type，这样浏览器才知道这是一个PDF
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    
    console.log("Successfully proxied file, content-type:", response.headers.get("Content-Type"));
    
    return new Response(response.body, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    console.error("Error in pdf-proxy-simple:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
