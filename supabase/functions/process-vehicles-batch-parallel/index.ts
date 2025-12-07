// 并行批量处理车辆（优化版：添加和查询ID分离，支持并行处理）
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// 导入共享模块
import { getToken } from '../_shared/token-cache.ts';

// === 全局配置 ===
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36",
  // 并发配置
  ADD_BATCH_SIZE: 10,  // 每批并行添加10个车辆
  QUERY_BATCH_SIZE: 10, // 每批并行查询10个ID
  ADD_DELAY_AFTER_BATCH: 500, // 批次间延迟500ms
  QUERY_DELAY_AFTER_BATCH: 300, // 查询批次间延迟300ms
};

/**
 * 添加单个车辆到第三方平台
 */
async function addSingleVehicle(licensePlate: string, loadWeight: string = "0"): Promise<{
  licensePlate: string;
  success: boolean;
  status?: 'created' | 'existed';
  message: string;
}> {
  const url = `${CONFIG.baseUrl}/rest/equip`;
  const cleanLicensePlate = String(licensePlate).trim();

  // 1. 获取 Token
  let authToken: string;
  try {
    authToken = await getToken('add');
  } catch (error) {
    authToken = Deno.env.get('TRACKING_ADD_TOKEN') || "";
    if (!authToken) {
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: `无法获取 Token: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // 2. 生成 UID
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const random13 = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
  const uid = `100${timeStr}${random13}`;

  // 3. 准备数据
  const safeLoadWeight = (() => {
    const weightStr = String(loadWeight || "0").trim();
    if (weightStr && !isNaN(parseFloat(weightStr)) && isFinite(parseFloat(weightStr))) {
      return weightStr;
    }
    return "0";
  })();

  const colorValueString = JSON.stringify({
    "rid": "#183:51",
    "value": "黄色",
    "display": "黄色",
    "selector": "黄色",
    "values": [
      { "key": "Name", "name": "名称", "value": "黄色" },
      { "key": "Code", "name": "代码", "value": "2" }
    ]
  });

  const payloadObject = {
    lastDeptId: "#16:171",
    deptId: "#16:5043",
    desc: cleanLicensePlate,
    serialno: cleanLicensePlate,
    backup: false,
    equipModelId: "#20:81",
    uid: uid,
    exFields: [
      {
        exFieldId: "#157:277",
        field: "核定载质量",
        value: safeLoadWeight,
        format: "json"
      },
      {
        exFieldId: "#157:590",
        field: "车牌颜色",
        value: colorValueString,
        format: "json",
        valueRefId: "#183:51",
        codefId: "#182:14"
      }
    ],
    relations: []
  };
  
  const bodyString = JSON.stringify(payloadObject);

  const requestHeaders: Record<string, string> = {
    "accept": "application/json, text/plain, */*",
    "auth-session": authToken,
    "content-type": "application/json;charset=UTF-8",
    "cookie": `Auth-Session=${encodeURIComponent(authToken)}`,
    "origin": "https://zkzy.zkzy1688.com",
    "referer": `${CONFIG.baseUrl}/console/`,
    "user-agent": CONFIG.userAgent,
    "x-auth-session": authToken
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: bodyString,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await response.text();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          licensePlate: cleanLicensePlate,
          success: false,
          message: "Token 已过期，请重试"
        };
      }

      let errorData: { code?: string; message?: string } = {};
      try {
        errorData = text ? JSON.parse(text) : {};
      } catch (e) {
        // 忽略解析错误
      }
      
      const errorMessage = errorData.message || errorData.code || text;
      
      // 409 Conflict 表示车辆已存在
      if (response.status === 409 && (errorMessage.includes("已存在") || errorMessage.includes("Conflict"))) {
        return {
          licensePlate: cleanLicensePlate,
          success: true,
          status: "existed",
          message: "车辆已存在"
        };
      }

      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: `添加失败 [${response.status}]: ${errorMessage}`
      };
    }

    return {
      licensePlate: cleanLicensePlate,
      success: true,
      status: "created",
      message: "车辆添加成功"
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: "添加车辆请求超时（30秒）"
      };
    }
    return {
      licensePlate: cleanLicensePlate,
      success: false,
      message: error instanceof Error ? error.message : "添加车辆失败"
    };
  }
}

/**
 * 查询单个车辆ID并同步到数据库
 */
async function queryAndSyncVehicleId(licensePlate: string): Promise<{
  licensePlate: string;
  success: boolean;
  message: string;
  externalId?: string;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cleanLicensePlate = String(licensePlate).trim();

  // 从共享模块获取 Token
  let authToken: string;
  try {
    authToken = await getToken('query');
  } catch (error) {
    authToken = Deno.env.get('TRACKING_AUTH_SESSION') || "";
    if (!authToken) {
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: `无法获取 Token：${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  const apiBaseUrl = CONFIG.baseUrl;

  try {
    // 请求第三方接口查询车辆ID
    const params = new URLSearchParams({ keyword: cleanLicensePlate, shab: "y" });
    const url = `${apiBaseUrl}/rest/entity/search?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 20000); // 20秒超时

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
      
      if (response.status === 401 || response.status === 403) {
        // Token过期，尝试重新获取
        try {
          const newToken = await getToken('query');
          // 递归重试一次
          return queryAndSyncVehicleId(licensePlate);
        } catch (retryError) {
          return {
            licensePlate: cleanLicensePlate,
            success: false,
            message: `认证失败：Token 已过期，重新获取 Token 也失败`
          };
        }
      }
      
      return {
        licensePlate: cleanLicensePlate,
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
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: `未在第三方平台找到车辆: ${cleanLicensePlate}`
      };
    }

    const firstItem = targetList[0] as Record<string, unknown>;
    const externalId = firstItem?.id;

    if (!externalId) {
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: "API 返回数据中未找到 ID 字段"
      };
    }

    // 连接 Supabase 数据库
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 执行入库到 vehicle_tracking_id_mappings 表（更新或插入）
    const { data: existingMapping, error: checkError } = await supabase
      .from('vehicle_tracking_id_mappings')
      .select('license_plate')
      .eq('license_plate', cleanLicensePlate)
      .single();

    if (existingMapping && !checkError) {
      // 更新已存在的映射记录
      const { error: updateError } = await supabase
        .from('vehicle_tracking_id_mappings')
        .update({
          external_tracking_id: String(externalId),
          vehicle_desc: cleanLicensePlate,
          dept_id: '#16:5043',
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        })
        .eq('license_plate', cleanLicensePlate);

      if (updateError) {
        return {
          licensePlate: cleanLicensePlate,
          success: false,
          message: `数据库更新失败: ${updateError.message}`
        };
      }
    } else {
      // 插入新映射记录
      const { error: insertError } = await supabase
        .from('vehicle_tracking_id_mappings')
        .insert({
          license_plate: cleanLicensePlate,
          external_tracking_id: String(externalId),
          vehicle_desc: cleanLicensePlate,
          dept_id: '#16:5043',
          last_synced_at: new Date().toISOString()
        });

      if (insertError) {
        return {
          licensePlate: cleanLicensePlate,
          success: false,
          message: `数据库插入失败: ${insertError.message}`
        };
      }
    }

    return {
      licensePlate: cleanLicensePlate,
      success: true,
      message: `ID同步成功 (${externalId})`,
      externalId: String(externalId)
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        licensePlate: cleanLicensePlate,
        success: false,
        message: "查询车辆ID请求超时（20秒）"
      };
    }
    return {
      licensePlate: cleanLicensePlate,
      success: false,
      message: error instanceof Error ? error.message : "未知错误"
    };
  }
}

/**
 * 批量并行添加车辆（批次并发）
 * @param onProgress 进度回调函数（用于实时更新前端进度，通过中间状态存储）
 */
async function batchAddVehicles(
  licensePlates: string[],
  loadWeight: string = "0",
  onProgress?: (current: number, total: number, result: { licensePlate: string; success: boolean; message: string; status?: 'created' | 'existed' }) => void
): Promise<Array<{ licensePlate: string; success: boolean; message: string; status?: 'created' | 'existed' }>> {
  const results: Array<{ licensePlate: string; success: boolean; message: string; status?: 'created' | 'existed' }> = [];
  const total = licensePlates.length;
  
  // 🔴 关键优化：在批量处理开始前，先预热Token缓存（只获取一次）
  // 这样所有并行进程都能使用内存缓存中的Token，避免重复获取
  console.log('🔑 [批量添加] 预热Token缓存...');
  try {
    await getToken('add');
    console.log('✅ [批量添加] Token缓存预热完成，后续并行进程将使用内存缓存');
  } catch (error) {
    console.warn(`⚠️ [批量添加] Token预热失败，但继续处理: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 将车牌号分成批次
  const batches: string[][] = [];
  for (let i = 0; i < licensePlates.length; i += CONFIG.ADD_BATCH_SIZE) {
    batches.push(licensePlates.slice(i, i + CONFIG.ADD_BATCH_SIZE));
  }

  console.log(`🚀 [批量添加] 开始处理 ${total} 个车辆，分成 ${batches.length} 批次，每批 ${CONFIG.ADD_BATCH_SIZE} 个`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;

    console.log(`📦 [批量添加] 处理批次 ${batchNumber}/${batches.length} (${batch.length} 个车辆)`);

    // 并行处理当前批次
    const batchPromises = batch.map(plate => addSingleVehicle(plate, loadWeight));
    const batchResults = await Promise.allSettled(batchPromises);

    // 处理批次结果
    batchResults.forEach((settled, index) => {
      const plate = batch[index];
      let result: { licensePlate: string; success: boolean; message: string; status?: 'created' | 'existed' };

      if (settled.status === 'fulfilled') {
        result = settled.value;
      } else {
        result = {
          licensePlate: plate.trim(),
          success: false,
          message: `添加异常: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`
        };
      }

      results.push(result);
      
      // 调用进度回调
      if (onProgress) {
        onProgress(results.length, total, result);
      }
    });

    // 批次间延迟（避免过快请求）
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.ADD_DELAY_AFTER_BATCH));
    }
  }

  return results;
}

/**
 * 批量并行查询并同步车辆ID（批次并发）
 */
async function batchQueryAndSyncVehicleIds(
  licensePlates: string[],
  onProgress?: (current: number, total: number, result: { licensePlate: string; success: boolean; message: string }) => void
): Promise<Array<{ licensePlate: string; success: boolean; message: string; externalId?: string }>> {
  const results: Array<{ licensePlate: string; success: boolean; message: string; externalId?: string }> = [];
  const total = licensePlates.length;
  
  // 🔴 关键优化：在批量查询开始前，先预热Token缓存（只获取一次）
  // 这样所有并行进程都能使用内存缓存中的Token，避免重复获取
  console.log('🔑 [批量查询ID] 预热Token缓存...');
  try {
    await getToken('query');
    console.log('✅ [批量查询ID] Token缓存预热完成，后续并行进程将使用内存缓存');
  } catch (error) {
    console.warn(`⚠️ [批量查询ID] Token预热失败，但继续处理: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 将车牌号分成批次
  const batches: string[][] = [];
  for (let i = 0; i < licensePlates.length; i += CONFIG.QUERY_BATCH_SIZE) {
    batches.push(licensePlates.slice(i, i + CONFIG.QUERY_BATCH_SIZE));
  }

  console.log(`🔍 [批量查询ID] 开始处理 ${total} 个车辆，分成 ${batches.length} 批次，每批 ${CONFIG.QUERY_BATCH_SIZE} 个`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;

    console.log(`📦 [批量查询ID] 处理批次 ${batchNumber}/${batches.length} (${batch.length} 个车辆)`);

    // 并行处理当前批次
    const batchPromises = batch.map(plate => queryAndSyncVehicleId(plate));
    const batchResults = await Promise.allSettled(batchPromises);

    // 处理批次结果
    batchResults.forEach((settled, index) => {
      const plate = batch[index];
      let result: { licensePlate: string; success: boolean; message: string; externalId?: string };

      if (settled.status === 'fulfilled') {
        result = settled.value;
      } else {
        result = {
          licensePlate: plate.trim(),
          success: false,
          message: `查询异常: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`
        };
      }

      results.push(result);
      
      // 调用进度回调
      if (onProgress) {
        onProgress(results.length, total, result);
      }
    });

    // 批次间延迟（避免过快请求）
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.QUERY_DELAY_AFTER_BATCH));
    }
  }

  return results;
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
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: `请求体格式错误: ${parseError instanceof Error ? parseError.message : '未知错误'}` 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 支持两种参数格式
    let licensePlates: string[] = [];
    const { licensePlates: platesArray, licensePlate: singlePlate, loadWeight } = requestBody;

    if (platesArray && Array.isArray(platesArray) && platesArray.length > 0) {
      licensePlates = platesArray.map((p: unknown) => String(p).trim()).filter((p: string) => p);
    } else if (singlePlate && typeof singlePlate === 'string' && singlePlate.trim()) {
      licensePlates = [singlePlate.trim()];
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必要参数：请提供 licensePlates（车牌号数组）或 licensePlate（单个车牌号）' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (licensePlates.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '车牌号列表为空' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const defaultLoadWeight = loadWeight ? String(loadWeight).trim() : "0";
    const total = licensePlates.length;

    console.log(`🚀 [并行批量处理] 开始处理 ${total} 个车辆`);

    // 第一阶段：并行批量添加车辆到第三方平台
    console.log('📋 [阶段1] 开始批量添加车辆到第三方平台...');
    const addResults = await batchAddVehicles(licensePlates, defaultLoadWeight);

    // 统计添加结果
    const addSuccessCount = addResults.filter(r => r.success).length;
    const addFailedCount = addResults.length - addSuccessCount;
    console.log(`✅ [阶段1] 添加完成 - 成功: ${addSuccessCount}, 失败: ${addFailedCount}`);

    // 筛选出需要查询ID的车辆（添加成功的车辆）
    const platesToQuery = addResults
      .filter(r => r.success)
      .map(r => r.licensePlate);

    if (platesToQuery.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        total: total,
        addSuccessCount: 0,
        addFailedCount: addFailedCount,
        querySuccessCount: 0,
        queryFailedCount: 0,
        message: '所有车辆添加都失败，无法继续查询ID',
        results: addResults.map(addResult => ({
          licensePlate: addResult.licensePlate,
          success: false,
          addStatus: addResult.status || (addResult.success ? 'created' : 'failed'),
          syncIdStatus: 'skipped',
          message: addResult.message
        }))
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 等待一段时间，让第三方平台完成数据同步
    // 对于新添加的车辆等待更长时间，已存在的车辆等待较短时间
    const newAddedCount = addResults.filter(r => r.success && r.status === 'created').length;
    const existedCount = addResults.filter(r => r.success && r.status === 'existed').length;
    const waitTime = newAddedCount > 0 ? 5000 : (existedCount > 0 ? 2000 : 3000);
    
    console.log(`⏳ [等待] 等待 ${waitTime}ms 让第三方平台完成数据同步（新添加: ${newAddedCount}, 已存在: ${existedCount}）...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // 第二阶段：并行批量查询并同步车辆ID
    console.log('📋 [阶段2] 开始批量查询并同步车辆ID...');
    const queryResults = await batchQueryAndSyncVehicleIds(platesToQuery);

    // 统计查询结果
    const querySuccessCount = queryResults.filter(r => r.success).length;
    const queryFailedCount = queryResults.length - querySuccessCount;
    console.log(`✅ [阶段2] 查询完成 - 成功: ${querySuccessCount}, 失败: ${queryFailedCount}`);

    // 合并结果
    const finalResults = licensePlates.map(plate => {
      const addResult = addResults.find(r => r.licensePlate === plate);
      const queryResult = queryResults.find(r => r.licensePlate === plate);

      if (!addResult) {
        return {
          licensePlate: plate,
          success: false,
          addStatus: 'error',
          syncIdStatus: 'skipped',
          message: '添加阶段未找到结果'
        };
      }

      if (!addResult.success) {
        return {
          licensePlate: plate,
          success: false,
          addStatus: addResult.status || 'failed',
          syncIdStatus: 'skipped',
          message: addResult.message
        };
      }

      if (!queryResult) {
        return {
          licensePlate: plate,
          success: false,
          addStatus: addResult.status || 'created',
          syncIdStatus: 'failed',
          message: `${addResult.message}；查询阶段未找到结果`
        };
      }

      return {
        licensePlate: plate,
        success: addResult.success && queryResult.success,
        addStatus: addResult.status || 'created',
        syncIdStatus: queryResult.success ? 'synced' : 'failed',
        message: queryResult.success 
          ? `${addResult.message}；${queryResult.message}`
          : `${addResult.message}；但ID同步失败：${queryResult.message}`
      };
    });

    const totalSuccessCount = finalResults.filter(r => r.success).length;
    const totalFailedCount = finalResults.length - totalSuccessCount;

    console.log(`📊 [并行批量处理] 处理完成 - 总数: ${total}, 成功: ${totalSuccessCount}, 失败: ${totalFailedCount}`);

    return new Response(JSON.stringify({
      success: totalFailedCount === 0,
      total: finalResults.length,
      addSuccessCount,
      addFailedCount,
      querySuccessCount,
      queryFailedCount,
      totalSuccessCount,
      totalFailedCount,
      results: finalResults
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [并行批量处理] Edge Function 内部错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error instanceof Error ? error.message : '服务器内部错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
