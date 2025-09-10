// supabase/functions/pdf-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 你的七牛云域名，用于安全校验
const ALLOWED_DOMAIN = "photo.325218.xyz";

serve(async (req) => {
  // 设置CORS头，允许任何来源的前端应用调用此函数
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
  };

  // 响应OPTIONS预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 从请求的URL中获取要代理的文件URL
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    const token = url.searchParams.get("token");

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "URL parameter is missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 验证认证token（如果提供了）
    if (token) {
      // 这里可以添加token验证逻辑，暂时跳过
      // 在实际应用中，你应该验证token的有效性
    } else {
      // 如果没有token，检查Authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- 安全性检查：确保我们只代理来自我们自己七牛云域名的文件 ---
    const targetDomain = new URL(targetUrl).hostname;
    if (targetDomain !== ALLOWED_DOMAIN) {
      return new Response(JSON.stringify({ error: "Proxying from this domain is not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 使用fetch去请求真正的文件
    const response = await fetch(targetUrl);

    // 如果请求失败，返回错误
    if (!response.ok) {
      return new Response(response.body, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // 成功获取文件，将文件内容作为响应体返回给前端
    // 重要的是，我们保留了原始的Content-Type，这样浏览器才知道这是一个PDF
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
    
    return new Response(response.body, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
