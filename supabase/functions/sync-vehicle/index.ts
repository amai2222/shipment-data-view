// 同步车辆到第三方平台（ZKZY）并可选地查询ID同步到数据库（集成自动登录功能）
// @ts-expect-error - Edge Function运行在Deno环境，Deno类型在运行时可用
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Edge Function运行在Deno环境，ESM导入在运行时可用
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 配置区域
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com"
};

// 直接导入共享模块，避免 HTTP 调用开销
import { getToken } from '../_shared/token-cache.ts';

/**
 * 调用 add-vehicle Edge Function 添加车辆到第三方平台
 * @param licensePlate 车牌号 (例如: "冀EX9795")
 * @param loadWeight 核定载质量 (可选，默认 "0")
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
 * @deprecated 已废弃：使用 addVehicleViaEdgeFunction 代替
 * 保留此函数仅用于向后兼容，实际不再使用
 */
async function syncVehicleToThirdParty(licensePlate: string, loadWeight: string = "0") {
  // 1. 修正后的准确 API 地址
  const url = `${CONFIG.baseUrl}/rest/equip`;

  // 2. 从共享模块获取 Token（直接调用，无 HTTP 开销）
  let authToken: string;
  try {
    authToken = await getToken('add');
    console.log('✅ 从共享模块获取到 ADD Token');
  } catch (error) {
    // 如果获取失败，尝试使用环境变量（降级方案）
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    authToken = Deno.env.get('TRACKING_ADD_TOKEN') || Deno.env.get('TRACKING_AUTH_SESSION') || "";
    if (!authToken) {
      throw new Error(`无法获取 Token：共享模块调用失败且未配置环境变量。错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn('⚠️ 使用环境变量 Token（共享模块调用失败）');
  }

  // 3. 生成动态 UID (确保是纯字符串)
  // 必须生成新的，否则会报 "主键冲突" 错误
  // 🔴 修复：成功案例的 UID 格式是 100 + 14位时间戳 + 13位随机数 = 30 字符
  // 例如：100202512051150527582458941931
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14); // 结果如 20251203123000
  // 生成 13 位随机数（0-9999999999999）
  const random13 = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
  const uid = `100${timeStr}${random13}`;

  // 4. 构造 Payload (强制转换类型，防止 undefined)
  // ⚠️ 注意：后端要求 value 必须是字符串，例如 "30" 而不是 30
  const safeLoadWeight = String(loadWeight || "0").trim();

  // 🔴 确保所有字符串字段都不包含控制字符或特殊字符
  const cleanLicensePlate = licensePlate.trim();

  // 🔴 验证车牌号不为空
  if (!cleanLicensePlate || cleanLicensePlate.length === 0) {
    throw new Error('车牌号不能为空');
  }

  // 构造 Payload (手动拼接版)
  const validatedLoadWeight = (() => {
    const weightStr = String(safeLoadWeight || "0").trim();
    if (weightStr && !isNaN(parseFloat(weightStr)) && isFinite(parseFloat(weightStr))) {
      return weightStr;
    }
    console.warn(`⚠️ [Sync] 无效的 loadWeight 值: "${weightStr}"，使用默认值 "0"`);
    return "0";
  })();

  // ✅ 关键修改：手动构建 body 字符串
  // 先序列化颜色对象为 JSON 字符串
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

  // ✅ 手动拼接，确保万无一失
  const bodyString = `{
    "lastDeptId": "#16:171",
    "deptId": "#16:5043",
    "desc": ${JSON.stringify(cleanLicensePlate)},
    "serialno": ${JSON.stringify(cleanLicensePlate)},
    "backup": false,
    "equipModelId": "#20:81",
    "uid": ${JSON.stringify(uid)},
    "exFields": [
      {
        "exFieldId": "#157:277",
        "field": "核定载质量",
        "value": ${JSON.stringify(validatedLoadWeight)},
        "format": "json"
      },
      {
        "exFieldId": "#157:590",
        "field": "车牌颜色",
        "value": ${JSON.stringify(colorValueString)},
        "format": "json",
        "valueRefId": "#183:51",
        "codefId": "#182:14"
      }
    ],
    "relations": []
  }`.replace(/\s/g, ''); // 移除所有空格，确保紧凑
  

  try {
    // 设置 60秒 超时，防止前端无限等待（包含添加车辆和查询ID的完整流程）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "auth-session": authToken,
        "content-type": "application/json;charset=UTF-8",
        "Cookie": `Auth-Session=${encodeURIComponent(authToken)}`,
        "origin": "https://zkzy.zkzy1688.com",
        "referer": `${CONFIG.baseUrl}/console/`,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
      },
      body: bodyString,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await response.text();

    if (!response.ok) {
      // 401/403 重试逻辑
      if (response.status === 401 || response.status === 403) {
        console.warn("⚠️ Token 过期，重试一次...");
        return { success: false, message: "Token 已刷新，请重试操作" };
      }

      // 🔴 尝试解析错误响应（可能是 JSON 格式）
      let errorData: { code?: string; message?: string } = {};
      try {
        if (text && text.trim().startsWith('[')) {
          // 可能是数组格式的错误响应
          const errorArray = JSON.parse(text);
          if (Array.isArray(errorArray) && errorArray.length > 0) {
            errorData = errorArray[0] || {};
          }
        } else if (text && text.trim().startsWith('{')) {
          // 对象格式的错误响应
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // 如果解析失败，使用原始文本
        console.warn("无法解析错误响应为 JSON:", text);
      }

      // 🔴 处理 400 Bad Request（通常是格式错误）
      if (response.status === 400) {
        const errorMessage = errorData.message || errorData.code || text;
        if (errorMessage.includes("Invalid JSON") || errorData.code === "InvalidArgument") {
          console.error("❌ [Sync] 第三方 API 返回 Invalid JSON 错误:", errorData);
          return { 
            success: false, 
            message: `API 格式错误: ${errorMessage}`,
            error: errorData
          };
        }
        return { 
          success: false, 
          message: `添加失败 [400]: ${errorData.message || errorData.code || text}`,
          error: errorData
        };
      }

      // 🔴 处理 409 Conflict（可能是已存在或格式错误）
      if (response.status === 409) {
        const errorMessage = errorData.message || errorData.code || text;
        if (errorMessage.includes("Invalid JSON") || errorData.code === "InvalidArgument") {
          console.error("❌ [Sync] 第三方 API 返回 Invalid JSON 错误 (409):", errorData);
          return { 
            success: false, 
            message: `API 格式错误: ${errorMessage}`,
            error: errorData
          };
        }
        if (errorMessage.includes("已存在") || errorMessage.includes("Conflict") || errorData.code === "ConflictError") {
          return { success: true, status: "existed", message: "车辆已存在" };
        }
      }
      
      return { 
        success: false, 
        message: `添加失败 [${response.status}]: ${errorData.message || errorData.code || text}`,
        error: errorData
      };
    }

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      console.warn("响应非JSON:", text);
    }

    return { success: true, status: "created", data };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("❌ [Sync] 请求超时（30秒）");
      return { success: false, message: "添加车辆请求超时，请稍后重试" };
    }
    console.error("❌ [Sync] 网络异常:", error);
    return { success: false, message: error instanceof Error ? error.message : "请求超时或网络错误" };
  }
}

/**
 * 查询车辆ID并同步到数据库
 * @param licensePlate 车牌号
 */
async function syncVehicleIdToDatabase(licensePlate: string) {
  // 1. 获取环境变量
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 2. 从共享模块获取 Token（直接调用，无 HTTP 开销）
  let authToken: string;
  try {
    authToken = await getToken('query');
    console.log('✅ 从共享模块获取到 QUERY Token');
  } catch (error) {
    // 如果获取失败，尝试使用环境变量（降级方案）
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    authToken = Deno.env.get('TRACKING_AUTH_SESSION') || "";
    if (!authToken) {
      throw new Error(`无法获取 Token：共享模块调用失败且未配置环境变量。错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn('⚠️ 使用环境变量 Token（共享模块调用失败）');
  }

  const apiBaseUrl = CONFIG.baseUrl;

  try {
    // 2. 请求第三方接口查询车辆ID
    const params = new URLSearchParams({ keyword: licensePlate, shab: "y" });
    const url = `${apiBaseUrl}/rest/entity/search?${params.toString()}`;

    // 设置 30秒 超时，防止查询请求无限等待
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      
      // 🔴 处理认证错误（401/403）- 自动重试
      if (response.status === 401 || response.status === 403) {
        console.warn("⚠️ Token 过期，重新获取 Token 并重试...");
        try {
          // 重新从共享模块获取 Token
          const newToken = await getToken('query');
          // 使用新 Token 重试
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

    // 3. 获取 ID (external_tracking_id)
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

    // 4. 连接 Supabase 数据库（使用 Service Role Key 以绕过 RLS）
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. 执行入库到 vehicle_tracking_id_mappings 表（更新或插入）
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
      console.error("❌ 查询车辆ID请求超时（30秒）");
      return { 
        success: false, 
        message: "查询车辆ID请求超时，请稍后重试" 
      };
    }
    console.error("❌ 发生异常:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "未知错误" 
    };
  }
}

// Edge Function 主处理函数
serve(async (req) => {
  // 设置 CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // 处理 OPTIONS 请求（CORS 预检）
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求体（改进错误处理）
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('收到请求体（原始）:', bodyText);
      
      if (!bodyText || bodyText.trim() === '') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: '请求体为空，请提供 licensePlate 和 loadWeight 参数' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `请求体格式错误（Invalid JSON）: ${parseError instanceof Error ? parseError.message : '未知错误'}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 支持大小写不敏感的字段名（兼容前端可能发送的不同格式）
    const licensePlate = requestBody.licensePlate || requestBody.LicensePlate || requestBody.license_plate;
    const loadWeight = requestBody.loadWeight || requestBody.LoadWeight || requestBody.load_weight;
    const syncId = requestBody.syncId || requestBody.SyncId;
    const onlySyncId = requestBody.onlySyncId || requestBody.OnlySyncId;

    // 验证必要参数
    if (!licensePlate || typeof licensePlate !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '缺少必要参数：licensePlate（车牌号）。请检查请求体中的字段名是否正确（支持 licensePlate、LicensePlate、license_plate）' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 模式1：只查询ID并同步到数据库（不添加车辆）
    if (onlySyncId === true || onlySyncId === 'true') {
      const syncIdResult = await syncVehicleIdToDatabase(licensePlate.trim());
      
      return new Response(
        JSON.stringify(syncIdResult),
        { 
          status: syncIdResult.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 模式2：添加车辆到第三方平台（内部调用 add-vehicle Edge Function）
    const addResult = await addVehicleViaEdgeFunction(
      licensePlate.trim(), 
      loadWeight ? String(loadWeight).trim() : "0"
    );

    // 如果添加失败，直接返回
    if (!addResult.success) {
      return new Response(
        JSON.stringify(addResult),
        { 
          status: addResult.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 模式3：添加车辆 + 查询ID并同步到数据库
    if (syncId === true || syncId === 'true') {
      // 等待1秒，确保第三方平台已处理完添加请求
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const syncIdResult = await syncVehicleIdToDatabase(licensePlate.trim());
      
      // 合并结果
      return new Response(
        JSON.stringify({
          success: addResult.success && syncIdResult.success,
          addStatus: addResult.status, // "created" 或 "existed"
          syncIdStatus: syncIdResult.success ? 'synced' : 'failed',
          message: syncIdResult.success 
            ? `${addResult.message}；${syncIdResult.message}`
            : `${addResult.message}；但ID同步失败：${syncIdResult.message}`,
          data: {
            add: addResult.data,
            syncId: syncIdResult.data
          }
        }),
        { 
          status: (addResult.success && syncIdResult.success) ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 模式4：只添加车辆（默认模式，不查询ID）
    return new Response(
      JSON.stringify(addResult),
      { 
        status: addResult.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Edge Function 错误:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : '服务器内部错误' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

