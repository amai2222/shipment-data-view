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
    // 确保时间戳是数字类型（毫秒）
    const now = new Date().getTime();
    let start: number;
    let end: number;
    
    if (startTime) {
      start = typeof startTime === 'number' ? startTime : parseInt(String(startTime), 10);
    } else {
      start = now - 12 * 60 * 60 * 1000;
    }
    
    if (endTime) {
      end = typeof endTime === 'number' ? endTime : parseInt(String(endTime), 10);
    } else {
      end = now;
    }
    
    // 验证时间戳有效性
    if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
      throw new Error(`无效的时间戳: startTime=${startTime}, endTime=${endTime}`);
    }
    
    // 确保 end >= start
    if (end < start) {
      throw new Error(`结束时间不能早于开始时间: start=${start}, end=${end}`);
    }

    // 构建 URL (URLSearchParams 会自动处理 # 号的编码)（参考 Gemini 代码）
    const targetUrl = new URL('https://zkzy.zkzy1688.com/rest/entity/trace/sinoiov');
    targetUrl.searchParams.append('id', vehicleId);      // 自动转为 %2326%3A...
    // 根据 vehicleId 格式判断：如果以 # 开头，使用 'id'；否则使用 'serialno'（车牌号）
    const queryField = field || (vehicleId.startsWith('#') ? 'id' : 'serialno');
    targetUrl.searchParams.append('field', queryField);  // 关键参数（参考 Gemini 代码，但支持灵活配置）
    
    // 🔴 关键修复：时间戳可能需要转换为秒（而不是毫秒）
    // 尝试两种格式：先尝试毫秒，如果失败再尝试秒
    // 但根据常见 API 设计，通常使用毫秒时间戳
    targetUrl.searchParams.append('startTime', start.toString());
    targetUrl.searchParams.append('endTime', end.toString());

    console.log(`正在查询轨迹: ${vehicleId} | 时间范围: ${start} - ${end}`);
    console.log(`请求URL: ${targetUrl.toString()}`);
    console.log(`请求参数: id=${vehicleId}, field=${queryField}, startTime=${start}, endTime=${end}`);
    console.log(`时间戳格式: 开始=${new Date(start).toISOString()}, 结束=${new Date(end).toISOString()}`);

    // 🔴 关键修复：Cookie 中的 Auth-Session 需要 URL 编码（参考原 curl 命令）
    // 原 curl: -b 'Auth-Session=%2313%3A206-dde3b628224190a02a6908b5-cladmin-ZKZY'
    // 而 x-auth-session 头不需要编码
    const encodedSessionToken = encodeURIComponent(SESSION_TOKEN);

    // 发起请求（完全匹配原 curl 命令的请求头格式）
    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',  // 🔴 修复：添加 en;q=0.8
        // 🔴 关键修复：Cookie 中的 Auth-Session 需要 URL 编码
        'Cookie': `Auth-Session=${encodedSessionToken}`,
        'x-auth-session': SESSION_TOKEN,  // x-auth-session 头不需要编码
        'x-requested-with': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',  // 🔴 修复：添加完整版本号
        'Referer': 'https://zkzy.zkzy1688.com/monitor/',
        // 🔴 添加浏览器相关的请求头（参考原 curl 命令）
        'dnt': '1',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    });

    console.log(`API响应状态: ${response.status} ${response.statusText}`);

    // 🔴 辅助函数：发起 API 请求
    const makeApiRequest = async (startTime: number, endTime: number): Promise<Response> => {
      const apiUrl = new URL('https://zkzy.zkzy1688.com/rest/entity/trace/sinoiov');
      apiUrl.searchParams.append('id', vehicleId);
      apiUrl.searchParams.append('field', queryField);
      apiUrl.searchParams.append('startTime', startTime.toString());
      apiUrl.searchParams.append('endTime', endTime.toString());

      return await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cookie': `Auth-Session=${encodedSessionToken}`,
          'x-auth-session': SESSION_TOKEN,
          'x-requested-with': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
          'Referer': 'https://zkzy.zkzy1688.com/monitor/',
          'dnt': '1',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        }
      });
    };

    let finalResponse = response;

    if (!response.ok) {
      // 尝试读取错误响应体
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.error(`API错误响应体: ${errorBody}`);
      } catch (e) {
        console.error('无法读取错误响应体:', e);
      }
      
      // 🔴 如果是 409 错误，可能是时间戳格式问题，尝试使用秒级时间戳重试
      if (response.status === 409) {
        console.log('检测到 409 错误，尝试使用秒级时间戳重试...');
        const startSeconds = Math.floor(start / 1000);
        const endSeconds = Math.floor(end / 1000);
        
        console.log(`重试参数: id=${vehicleId}, field=${queryField}, startTime=${startSeconds} (秒), endTime=${endSeconds} (秒)`);
        
        const retryResponse = await makeApiRequest(startSeconds, endSeconds);
        
        console.log(`重试响应状态: ${retryResponse.status} ${retryResponse.statusText}`);
        
        if (retryResponse.ok) {
          // 重试成功，使用重试的响应
          finalResponse = retryResponse;
          console.log('使用秒级时间戳重试成功');
        } else {
          // 重试也失败，尝试读取错误响应体
          let retryErrorBody = '';
          try {
            retryErrorBody = await retryResponse.text();
            console.error(`重试错误响应体: ${retryErrorBody}`);
          } catch (e) {
            console.error('无法读取重试错误响应体:', e);
          }
          throw new Error(`第三方接口报错: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}。重试（秒级时间戳）也失败: ${retryResponse.status}${retryErrorBody ? ` - ${retryErrorBody}` : ''}`);
        }
      } else {
        // 非 409 错误，直接抛出
        throw new Error(`第三方接口报错: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
      }
    }

    // 数据处理 (适配前端地图格式)
    // 根据实际API返回格式：{"result": [...]}，每个点包含 lat, lon, gtm, spd, mlg, hgt, agl
    const rawData = await finalResponse.json();
    
    console.log(`API返回数据类型: ${typeof rawData}, 是否为数组: ${Array.isArray(rawData)}`);
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
      console.log(`API返回数据键: ${Object.keys(rawData).join(', ')}`);
      // 详细检查 result 字段
      if (rawData.result !== undefined) {
        console.log(`result 字段类型: ${typeof rawData.result}, 是否为数组: ${Array.isArray(rawData.result)}`);
        if (Array.isArray(rawData.result)) {
          console.log(`result 数组长度: ${rawData.result.length}`);
          if (rawData.result.length > 0) {
            console.log(`result 第一个元素示例:`, JSON.stringify(rawData.result[0]));
          }
        } else {
          console.log(`result 值:`, JSON.stringify(rawData.result));
        }
      }
      // 详细检查 files 字段
      if (rawData.files !== undefined) {
        console.log(`files 字段类型: ${typeof rawData.files}, 是否为数组: ${Array.isArray(rawData.files)}`);
        if (Array.isArray(rawData.files)) {
          console.log(`files 数组长度: ${rawData.files.length}`);
        }
      }
    }

    // 处理返回数据格式：可能是 {"result": [...]} 或直接是数组
    let tracePoints: unknown[] = [];
    if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData)) {
        tracePoints = rawData;
        console.log(`数据是数组，长度: ${tracePoints.length}`);
      } else if (rawData.result && Array.isArray(rawData.result)) {
        // 如果返回格式是 {"result": [...]}
        tracePoints = rawData.result;
        console.log(`从 result 字段提取数据，长度: ${tracePoints.length}`);
      } else if (rawData.files && Array.isArray(rawData.files)) {
        // 如果返回格式是 {"files": [...]}
        tracePoints = rawData.files;
        console.log(`从 files 字段提取数据，长度: ${tracePoints.length}`);
      } else {
        // 其他格式，尝试直接使用
        tracePoints = [rawData];
        console.log(`使用原始数据对象，长度: ${tracePoints.length}`);
      }
    }
    
    console.log(`提取的轨迹点数量: ${tracePoints.length}`);
    if (tracePoints.length > 0) {
      console.log(`第一个轨迹点示例:`, JSON.stringify(tracePoints[0]));
    }

    // 数据格式转换：根据实际API返回格式
    // 实际格式：{"lat": "22153458", "lon": "70582233", "gtm": "20251202/044548", "spd": "0", "mlg": "3744103", "hgt": "0", "agl": "0"}
    interface TracePoint {
      lat?: string | number;      // 纬度（可能是字符串格式，如 "22153458"）
      lon?: string | number;      // 经度（可能是字符串格式，如 "70582233"）
      gtm?: string;               // GPS时间，格式 "YYYYMMDD/HHMMSS"
      spd?: string | number;      // 速度
      mlg?: string | number;      // 里程
      hgt?: string | number;      // 高度
      agl?: string | number;      // 角度
      lng?: number;               // 备用字段名
      time?: number | string;     // 备用时间字段
      [key: string]: unknown;     // 允许其他字段
    }

    const formattedData = tracePoints.map((point: unknown) => {
      // 类型断言
      const tracePoint = point as TracePoint;
      // 转换坐标：lat/lon 可能是字符串格式，需要转换为数字
      // 注意：如果 lat/lon 是字符串格式（如 "22153458"），可能需要除以某个倍数（如 1000000）得到实际坐标
      let latitude = 0;
      let longitude = 0;
      
      if (tracePoint.lat !== undefined) {
        const latNum = typeof tracePoint.lat === 'string' ? parseFloat(tracePoint.lat) : tracePoint.lat;
        // 如果 lat 是很大的数字（如 22153458），可能是以某种单位存储的，需要转换
        // 根据实际数据判断：22153458 可能是 22.153458 的某种编码
        latitude = latNum > 1000000 ? latNum / 1000000 : latNum;
      } else if (tracePoint.lng !== undefined) {
        latitude = typeof tracePoint.lng === 'string' ? parseFloat(tracePoint.lng) : tracePoint.lng;
      }
      
      if (tracePoint.lon !== undefined) {
        const lonNum = typeof tracePoint.lon === 'string' ? parseFloat(tracePoint.lon) : tracePoint.lon;
        longitude = lonNum > 1000000 ? lonNum / 1000000 : lonNum;
      } else if (tracePoint.lng !== undefined) {
        longitude = typeof tracePoint.lng === 'string' ? parseFloat(tracePoint.lng) : tracePoint.lng;
      }

      // 转换时间：gtm 格式 "YYYYMMDD/HHMMSS" 转换为时间戳
      let timestamp: number | string = tracePoint.time || tracePoint.gtm || '';
      if (tracePoint.gtm && typeof tracePoint.gtm === 'string') {
        // 解析 "20251202/044548" 格式
        const [datePart, timePart] = tracePoint.gtm.split('/');
        if (datePart && timePart) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          const hour = timePart.substring(0, 2);
          const minute = timePart.substring(2, 4);
          const second = timePart.substring(4, 6);
          const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
          timestamp = new Date(dateStr).getTime();
        }
      }

      return {
        ...tracePoint,
        // 转换为前端好用的格式（同时提供 lat/lng 和 latitude/longitude 两种格式，兼容不同组件）
        lat: latitude,           // 地图组件期望的字段名
        lng: longitude,          // 地图组件期望的字段名
        latitude,                // 保留 latitude 字段（向后兼容）
        longitude,               // 保留 longitude 字段（向后兼容）
        time: timestamp,
        // 保留原始数据
        originalLat: tracePoint.lat,
        originalLon: tracePoint.lon,
        gtm: tracePoint.gtm
      };
    });

    console.log(`处理后的轨迹点数: ${formattedData.length}`);

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

