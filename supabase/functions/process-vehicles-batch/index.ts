// 批量处理车辆（新建函数，不修改现有函数）
// @ts-expect-error - Edge Function运行在Deno环境
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 导入共享模块
import { getToken } from '../_shared/token-cache.ts';

// === 全局配置 ===
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
};

/**
 * 调用 add-vehicle Edge Function 添加车辆到第三方平台
 */
async function addVehicleViaEdgeFunction(licensePlate: string, loadWeight: string = "0") {
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/add-vehicle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        licensePlate: licensePlate.trim(),
        loadWeight: loadWeight.trim() || '0'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = JSON.parse(errorText);
        errorMessage = errorBody.message || errorBody.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return { 
        success: false, 
        message: `添加车辆失败: ${errorMessage}`,
        error: { status: response.status, message: errorMessage }
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("❌ 调用 add-vehicle Edge Function 失败:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "调用 add-vehicle 函数失败" 
    };
  }
}

/**
 * 查询车辆ID并同步到数据库（优化版：增加超时时间，优化消息格式）
 */
async function syncVehicleIdToDatabase(licensePlate: string) {
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 从共享模块获取 Token
  let authToken: string;
  try {
    authToken = await getToken('query');
    console.log('✅ 从共享模块获取到 QUERY Token');
  } catch (error) {
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    authToken = Deno.env.get('TRACKING_AUTH_SESSION') || "";
    if (!authToken) {
      throw new Error(`无法获取 Token：${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn('⚠️ 使用环境变量 Token（共享模块调用失败）');
  }

  const apiBaseUrl = CONFIG.baseUrl;

  try {
    // 请求第三方接口查询车辆ID
    const params = new URLSearchParams({ keyword: licensePlate, shab: "y" });
    const url = `${apiBaseUrl}/rest/entity/search?${params.toString()}`;

    // 🔴 设置 60秒 超时，防止查询请求无限等待（增加超时时间以应对慢速响应）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error(`⏱️ [Sync ID] 查询车辆ID请求超时: ${licensePlate}`);
    }, 60000); // 60秒超时

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Auth-Session": authToken,
        "X-Auth-Session": authToken,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://zkzy.zkzy1688.com/monitor/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API 请求失败: ${response.status}`, errorText);
      
      // 处理认证错误（401/403）- 自动重试
      if (response.status === 401 || response.status === 403) {
        console.warn("⚠️ Token 过期，重新获取 Token 并重试...");
        try {
          const newToken = await getToken('query');
          return syncVehicleIdToDatabase(licensePlate);
        } catch (retryError) {
          return { 
            success: false, 
            message: `认证失败：Token 已过期，重新获取 Token 也失败。错误: ${retryError instanceof Error ? retryError.message : String(retryError)}` 
          };
        }
      }
      
      return { 
        success: false, 
        message: `API 请求失败: ${response.status}` 
      };
    }

    const json = await response.json();

    // 兼容不同的返回结构
    let targetList: unknown[] = [];
    if (Array.isArray(json)) {
      targetList = json;
    } else if (json && typeof json === 'object' && 'result' in json && Array.isArray(json.result)) {
      targetList = json.result;
    } else if (json && typeof json === 'object' && 'data' in json && Array.isArray(json.data)) {
      targetList = json.data;
    }

    if (targetList.length === 0) {
      console.log(`⚠️ 第三方未找到车辆: ${licensePlate}`);
      return { 
        success: false, 
        message: `未在第三方平台找到车辆: ${licensePlate}` 
      };
    }

    // 获取 ID (external_tracking_id)
    const firstItem = targetList[0] as Record<string, unknown>;
    const externalId = firstItem?.id;

    if (!externalId) {
      console.error("❌ 未找到 ID 字段");
      return { 
        success: false, 
        message: "API 返回数据中未找到 ID 字段" 
      };
    }

    console.log(`✅ 获取到 ID: ${externalId}`);

    // 连接 Supabase 数据库（使用 Service Role Key 以绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 执行入库到 vehicle_tracking_id_mappings 表（更新或插入）
    const { data: existingMapping, error: checkError } = await supabase
      .from('vehicle_tracking_id_mappings')
      .select('license_plate')
      .eq('license_plate', licensePlate)
      .single();

    let result;
    if (existingMapping && !checkError) {
      // 更新已存在的映射记录
      const { error: updateError } = await supabase
        .from('vehicle_tracking_id_mappings')
        .update({
          external_tracking_id: String(externalId),
          vehicle_desc: licensePlate,
          dept_id: '#16:5043',
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        })
        .eq('license_plate', licensePlate);

      if (updateError) {
        console.error(`❌ 数据库更新失败: ${updateError.message}`);
        return { 
          success: false, 
          message: `数据库更新失败: ${updateError.message}` 
        };
      }

      result = { action: 'updated', id: String(externalId) };
      console.log(`💾 成功更新映射: ${licensePlate} | ID: ${externalId}`);
    } else {
      // 插入新映射记录
      const { error: insertError } = await supabase
        .from('vehicle_tracking_id_mappings')
        .insert({
          license_plate: licensePlate,
          external_tracking_id: String(externalId),
          vehicle_desc: licensePlate,
          dept_id: '#16:5043',
          last_synced_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`❌ 数据库插入失败: ${insertError.message}`);
        return { 
          success: false, 
          message: `数据库插入失败: ${insertError.message}` 
        };
      }

      result = { action: 'created', id: String(externalId) };
      console.log(`💾 成功插入映射: ${licensePlate} | ID: ${externalId}`);
    }

    return {
      success: true,
      message: `车辆 ${licensePlate} 的 ID (${externalId}) 已成功${result.action === 'created' ? '插入' : '更新'}到数据库`,
      data: {
        licensePlate,
        externalId: String(externalId),
        action: result.action
      }
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`❌ 查询车辆ID请求超时（60秒）: ${licensePlate}`);
      return { 
        success: false, 
        message: "查询车辆ID请求超时，请稍后重试" 
      };
    }
    console.error(`❌ 发生异常: ${licensePlate}`, error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "未知错误" 
    };
  }
}

/**
 * 处理单个车辆：添加车辆并同步ID（优化消息格式）
 */
async function processVehicle(licensePlate: string, loadWeight: string = "0") {
  const cleanPlate = licensePlate.trim();
  if (!cleanPlate) {
    return {
      licensePlate: cleanPlate,
      success: false,
      message: '车牌号不能为空'
    };
  }

  // 第一步：添加车辆到第三方平台
  const addResult = await addVehicleViaEdgeFunction(cleanPlate, loadWeight);
  
  if (!addResult.success) {
    return {
      licensePlate: cleanPlate,
      success: false,
      addStatus: 'failed',
      message: addResult.message || '添加车辆失败'
    };
  }

  // 等待1秒，确保第三方平台已处理完添加请求
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 第二步：查询ID并同步到数据库
  const syncIdResult = await syncVehicleIdToDatabase(cleanPlate);

  // 🔴 优化消息格式，避免显示 undefined
  const addMessage = addResult.message || (addResult.status === 'existed' ? '车辆已存在' : '车辆添加成功');
  const syncMessage = syncIdResult.message || (syncIdResult.success ? 'ID同步成功' : 'ID同步失败');

  return {
    licensePlate: cleanPlate,
    success: addResult.success && syncIdResult.success,
    addStatus: addResult.status || (addResult.success ? 'created' : 'failed'),
    syncIdStatus: syncIdResult.success ? 'synced' : 'failed',
    message: syncIdResult.success 
      ? `${addMessage}；${syncMessage}`
      : `${addMessage}；但ID同步失败：${syncMessage}`,
    data: {
      add: addResult.data,
      syncId: syncIdResult.data
    }
  };
}

// 主入口
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('收到批量处理请求:', { 
        licensePlatesCount: requestBody.licensePlates?.length || 0,
        loadWeight: requestBody.loadWeight 
      });
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: `请求体格式错误（Invalid JSON）: ${parseError instanceof Error ? parseError.message : '未知错误'}` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { licensePlates, loadWeight } = requestBody;

    if (!licensePlates || !Array.isArray(licensePlates) || licensePlates.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必要参数：licensePlates（车牌号数组）' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 批量处理车辆（串行处理，遇到错误记录日志并继续）
    const results = [];
    const defaultLoadWeight = loadWeight ? String(loadWeight).trim() : "0";
    const total = licensePlates.length;

    console.log(`🚀 [批量处理] 开始处理 ${total} 个车辆`);

    for (let i = 0; i < licensePlates.length; i++) {
      const plate = licensePlates[i];
      const currentIndex = i + 1;
      
      console.log(`📋 [批量处理] 处理进度: ${currentIndex}/${total} - 车牌号: ${plate}`);

      try {
        const result = await processVehicle(plate, defaultLoadWeight);
        results.push(result);

        // 记录处理结果
        if (result.success) {
          console.log(`✅ [批量处理] [${currentIndex}/${total}] ${plate} - 处理成功`);
        } else {
          console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 处理失败: ${result.message}`);
        }
      } catch (error) {
        // 🔴 遇到错误：记录日志，跳过当前项，继续执行下一个
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 发生异常:`, {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });

        // 添加错误结果，但继续处理下一个
        results.push({
          licensePlate: plate.trim(),
          success: false,
          addStatus: 'error',
          syncIdStatus: 'skipped',
          message: `处理异常: ${errorMessage}`,
          error: errorMessage
        });
      }
    }

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    console.log(`📊 [批量处理] 处理完成 - 总数: ${total}, 成功: ${successCount}, 失败: ${failedCount}`);

    return new Response(JSON.stringify({
      success: failedCount === 0,
      total: results.length,
      successCount,
      failedCount,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [批量处理] Edge Function 内部错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : '服务器内部错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

