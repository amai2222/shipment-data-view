// 车辆轨迹查询代理函数
// 参考 Gemini 代码风格改进
// @ts-expect-error - Edge Function运行在Deno环境，Deno类型在运行时可用
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. 处理跨域请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. 获取请求参数
    const { vehicleId, startTime, endTime, field } = await req.json();
    
    console.log('收到请求:', { vehicleId, startTime, endTime, field });

    // 3. 验证必需参数
    if (!vehicleId) {
      throw new Error('缺少 vehicleId 参数 (例如 #26:xxxx)');
    }

    // 4. 获取环境变量中的认证令牌
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    const SESSION_TOKEN = Deno.env.get('TRACKING_AUTH_SESSION');
    if (!SESSION_TOKEN) {
      throw new Error('Missing TRACKING_AUTH_SESSION');
    }
    
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

    // 🔴 验证时间范围不能太大（最多30天，转换为毫秒）
    const maxTimeRange = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数
    const timeRange = end - start;
    if (timeRange > maxTimeRange) {
      const daysDiff = Math.ceil(timeRange / (24 * 60 * 60 * 1000));
      throw new Error(`查询时间范围过大（${daysDiff}天），最多只能查询30天的数据。请缩小日期范围后重试。`);
    }

    // 验证时间范围不能为0
    if (timeRange === 0) {
      throw new Error('开始时间和结束时间相同，请选择至少包含1天的时间范围。');
    }

    // 记录时间戳转换信息（用于调试）
    console.log('时间戳转换信息:', {
      startTime: start,
      endTime: end,
      startTimeISO: new Date(start).toISOString(),
      endTimeISO: new Date(end).toISOString(),
      timeRangeDays: Math.ceil(timeRange / (24 * 60 * 60 * 1000))
    });

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

    // 5. Cookie 中的 Auth-Session 需要 URL 编码
    const encodedSessionToken = encodeURIComponent(SESSION_TOKEN);

    // 6. 辅助函数：发起 API 请求（带超时和重试机制）
    const makeApiRequest = async (startTime: number, endTime: number, retryCount = 0): Promise<Response> => {
      const apiUrl = new URL('https://zkzy.zkzy1688.com/rest/entity/trace/sinoiov');
      apiUrl.searchParams.append('id', vehicleId);
      apiUrl.searchParams.append('field', queryField);
      apiUrl.searchParams.append('startTime', startTime.toString());
      apiUrl.searchParams.append('endTime', endTime.toString());

      const maxRetries = 2; // 最多重试2次
      const timeout = 30000; // 30秒超时

      try {
        // 使用 AbortController 实现超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        console.log(`发起API请求 (尝试 ${retryCount + 1}/${maxRetries + 1}): ${apiUrl.toString()}`);

        const response = await fetch(apiUrl.toString(), {
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
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        // 如果是超时或连接错误，且还有重试次数，则重试
        if ((error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('Connection timed out'))) && retryCount < maxRetries) {
          console.warn(`请求超时或连接失败，${2}秒后重试 (${retryCount + 1}/${maxRetries})...`);
          // 等待2秒后重试
          await new Promise(resolve => setTimeout(resolve, 2000));
          return makeApiRequest(startTime, endTime, retryCount + 1);
        }
        // 如果重试次数用完或不是超时错误，则抛出
        throw error;
      }
    };

    // 7. 使用带重试机制的请求函数调用第三方 API
    let finalResponse: Response;
    try {
      finalResponse = await makeApiRequest(start, end);
      console.log(`API响应状态: ${finalResponse.status} ${finalResponse.statusText}`);
    } catch (error) {
      // 如果是连接超时错误，提供更友好的错误信息
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Connection timed out'))) {
        throw new Error(`连接第三方API超时。可能原因：1) 网络连接问题 2) 第三方服务器响应慢 3) 防火墙阻止连接。请稍后重试或联系管理员检查网络配置。原始错误: ${error.message}`);
      }
      throw error;
    }

    // 8. 检查 API 响应状态
    if (!finalResponse.ok) {
      // 尝试读取错误响应体
      let errorBody = '';
      try {
        errorBody = await finalResponse.text();
        console.error(`API错误响应体: ${errorBody}`);
      } catch (e) {
        console.error('无法读取错误响应体:', e);
      }
      
      // 🔴 如果是 409 错误，可能是时间戳格式问题或时间范围过大，尝试使用秒级时间戳重试
      if (finalResponse.status === 409) {
        // 检查是否是时间间隔过大的错误
        let errorBodyObj: { code?: string; message?: string } | null = null;
        try {
          errorBodyObj = JSON.parse(errorBody);
        } catch (e) {
          // 解析失败，使用原始错误信息
        }
        
        const isIntervalTooLarge = errorBodyObj?.message?.toLowerCase().includes('interval too large') || 
                                   errorBodyObj?.code === 'InvalidArgument' ||
                                   errorBody.toLowerCase().includes('interval too large');
        
        if (isIntervalTooLarge) {
          const timeRangeDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
          throw new Error(`查询时间范围过大（${timeRangeDays}天）。API返回错误："query interval too large"。请缩小查询日期范围（建议不超过7天）后重试。`);
        }
        
        console.log('检测到 409 错误，尝试使用秒级时间戳重试...');
        const startSeconds = Math.floor(start / 1000);
        const endSeconds = Math.floor(end / 1000);
        
        console.log(`重试参数: id=${vehicleId}, field=${queryField}, startTime=${startSeconds} (秒), endTime=${endSeconds} (秒)`);
        
        try {
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
            
            // 检查重试是否也是时间间隔过大的错误
            let retryErrorBodyObj: { code?: string; message?: string } | null = null;
            try {
              retryErrorBodyObj = JSON.parse(retryErrorBody);
            } catch (e) {
              // 解析失败
            }
            
            const retryIsIntervalTooLarge = retryErrorBodyObj?.message?.toLowerCase().includes('interval too large') || 
                                           retryErrorBodyObj?.code === 'InvalidArgument' ||
                                           retryErrorBody.toLowerCase().includes('interval too large');
            
            if (retryIsIntervalTooLarge) {
              const timeRangeDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
              throw new Error(`查询时间范围过大（${timeRangeDays}天）。API返回错误："query interval too large"。请缩小查询日期范围（建议不超过7天）后重试。`);
            }
            
            throw new Error(`第三方接口报错: ${finalResponse.status} ${finalResponse.statusText}${errorBody ? ` - ${errorBody}` : ''}。重试（秒级时间戳）也失败: ${retryResponse.status}${retryErrorBody ? ` - ${retryErrorBody}` : ''}`);
          }
        } catch (retryError) {
          // 重试时也发生错误（可能是超时）
          throw new Error(`第三方接口报错: ${finalResponse.status} ${finalResponse.statusText}${errorBody ? ` - ${errorBody}` : ''}。重试时发生错误: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
        }
      } else {
        // 非 409 错误，直接抛出
        throw new Error(`第三方接口报错: ${finalResponse.status} ${finalResponse.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
      }
    }

    // 9. 处理 API 返回数据 (适配前端地图格式)
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
    
    // 统一错误处理，参考 Gemini 代码风格
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 根据错误类型返回适当的 HTTP 状态码
    const status = errorMessage.includes('缺少') || errorMessage.includes('Missing') ? 400 : 500;
    
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

