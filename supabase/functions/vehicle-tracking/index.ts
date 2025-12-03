// 车辆轨迹查询代理函数
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// 轨迹查询API配置
const TRACKING_API_BASE = 'https://zkzy.zkzy1688.com';
const TRACKING_API_PATH = '/rest/entity/trace/sinoiov';

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 从请求中获取参数
    const { vehicleId, field = 'serialno', startTime, endTime } = await req.json();

    if (!vehicleId || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: '缺少必需参数: vehicleId, startTime, endTime' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 构建查询URL
    const url = new URL(TRACKING_API_PATH, TRACKING_API_BASE);
    url.searchParams.set('id', encodeURIComponent(vehicleId));
    url.searchParams.set('field', field);
    url.searchParams.set('startTime', String(startTime));
    url.searchParams.set('endTime', String(endTime));

    // 从环境变量获取认证信息（如果配置了）
    // 如果没有配置，使用默认值（需要根据实际情况调整）
    const authSession = Deno.env.get('TRACKING_AUTH_SESSION') || '#13:206-dde3b628224190a02a6908b5-cladmin-ZKZY';
    
    // URL编码认证信息（用于Cookie）
    const encodedAuthSession = encodeURIComponent(authSession);

    // 调用外部API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'x-auth-session': authSession,
        'x-requested-with': 'XMLHttpRequest',
        'referer': 'https://zkzy.zkzy1688.com/monitor/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'cookie': `Auth-Session=${encodedAuthSession}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('轨迹查询API错误:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `轨迹查询失败: ${response.status} ${response.statusText}`,
          details: errorText 
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('轨迹查询代理错误:', error);
    return new Response(
      JSON.stringify({ 
        error: '轨迹查询代理失败',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

