// 车辆轨迹查询代理函数
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS配置（参考 Gemini 代码）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理跨域（参考 Gemini 代码）
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { vehicleId, startTime, endTime, field } = await req.json();

    // 🔴 检查: 如果没有 vehicleId，直接报错（参考 Gemini 代码）
    if (!vehicleId) {
      throw new Error('缺少 vehicleId 参数 (例如 #26:xxxx)');
    }

    // 准备第三方 API 参数（参考 Gemini 代码）
    const SESSION_TOKEN = Deno.env.get('TRACKING_AUTH_SESSION') || '#13:206-dde3b628224190a02a6908b5-cladmin-ZKZY'; // ⚠️ 注意：这个Token会过期，过期需更新
    
    // 默认查询最近 12 小时（参考 Gemini 代码）
    const now = new Date().getTime();
    const start = startTime || (now - 12 * 60 * 60 * 1000);
    const end = endTime || now;

    // 构建 URL (URLSearchParams 会自动处理 # 号的编码)（参考 Gemini 代码）
    const targetUrl = new URL('https://zkzy.zkzy1688.com/rest/entity/trace/sinoiov');
    targetUrl.searchParams.append('id', vehicleId);      // 自动转为 %2326%3A...
    // 根据 vehicleId 格式判断：如果以 # 开头，使用 'id'；否则使用 'serialno'（车牌号）
    const queryField = field || (vehicleId.startsWith('#') ? 'id' : 'serialno');
    targetUrl.searchParams.append('field', queryField);  // 关键参数（参考 Gemini 代码，但支持灵活配置）
    targetUrl.searchParams.append('startTime', start.toString());
    targetUrl.searchParams.append('endTime', end.toString());

    console.log(`正在查询轨迹: ${vehicleId} | 时间范围: ${start} - ${end}`);

    // 发起请求（参考 Gemini 代码的请求头格式）
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        // 关键鉴权信息
        'Cookie': `Auth-Session=${SESSION_TOKEN}`,
        'x-auth-session': SESSION_TOKEN,
        'x-requested-with': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
        'Referer': 'https://zkzy.zkzy1688.com/monitor/'
      }
    });

    if (!response.ok) {
      throw new Error(`第三方接口报错: ${response.status} ${response.statusText}`);
    }

    // 数据处理 (适配前端地图格式)（参考 Gemini 代码）
    const rawData = await response.json();
    
    // 假设返回的数据是数组，我们对其进行坐标转换 (从 Lat,Lng 转为 Lng,Lat)
    // 注意：这里是基于您提供的截图推测的格式，如果 trace 接口返回格式不同，这里可能需要调整
    interface TracePoint {
      lng?: number;
      lat?: number;
      gps?: [number, number, number]; // [lat, lng, alt]
      time?: number | string;
      createTime?: number | string;
      loc_time?: number | string;
      [key: string]: unknown; // 允许其他字段
    }

    let formattedData = rawData;
    if (Array.isArray(rawData)) {
        formattedData = rawData.map((point: TracePoint) => {
            // 如果 point 里包含 gps 数组 [lat, lng, alt]
            // 或者 point 本身就是数组
            // 这里做一个兼容处理
            return {
                ...point,
                // 强制转换为前端好用的格式
                longitude: point.lng || (Array.isArray(point.gps) ? point.gps[1] : 0),
                latitude: point.lat || (Array.isArray(point.gps) ? point.gps[0] : 0),
                time: point.time || point.createTime || point.loc_time
            };
        });
    }

    return new Response(JSON.stringify(formattedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('轨迹查询失败:', error);
    // 参考 Gemini 代码，简化错误处理
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

