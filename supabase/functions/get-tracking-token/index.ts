// 自动登录获取第三方平台 Token（使用共享模块）
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getTokenWithInfo } from '../_shared/token-cache.ts';

// CORS配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求体
    let requestBody: { type?: 'add' | 'query' } = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (e) {
      // 如果没有请求体或解析失败，使用默认值
    }

    const type = requestBody.type || 'query'; // 默认查询类型
    
    if (type !== 'add' && type !== 'query') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'type 参数必须是 "add" 或 "query"' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🚀 开始获取 Token [类型: ${type}]`);
    
    // 使用共享模块获取 Token
    const { token, expiresAt } = await getTokenWithInfo(type);
    
    if (!token) {
      throw new Error('获取 Token 失败：返回值为空');
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: type,
        token: token,
        expiresAt: expiresAt,
        expiresIn: Math.floor((expiresAt - Date.now()) / 1000), // 剩余秒数
        message: `成功获取 ${type === 'add' ? '添加车辆' : '查询车辆'} Token`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ 获取 Token 失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        message: `获取 Token 失败: ${errorMessage}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

