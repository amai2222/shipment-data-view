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
 * 同步添加车辆到 ZKZY 平台
 * @param licensePlate 车牌号 (例如: "冀EX9795")
 * @param loadWeight 核定载质量 (可选，默认 "0")
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
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14); // 结果如 20251203123000
  const uid = `100${timeStr}${Math.floor(Math.random() * 10000000000)}`;

  // 4. 构造 Payload (强制转换类型，防止 undefined)
  // ⚠️ 注意：后端要求 value 必须是字符串，例如 "30" 而不是 30
  const safeLoadWeight = String(loadWeight || "0").trim();

  // 🔴 确保所有字符串字段都不包含控制字符或特殊字符
  const cleanLicensePlate = licensePlate.trim();

  // 🔴 验证车牌号不为空
  if (!cleanLicensePlate || cleanLicensePlate.length === 0) {
    throw new Error('车牌号不能为空');
  }

  // 🔴 构造 payload，确保所有字段类型正确
  // ⚠️ 注意：exFields[1].value 必须是对象，不能是 JSON 字符串
  // 因为 format: "json" 表示该字段的值应该是 JSON 对象，而不是字符串化的 JSON
  const payload = {
    lastDeptId: "#16:171",
    deptId: "#16:5043",
    desc: String(cleanLicensePlate),     // 确保是字符串
    serialno: String(cleanLicensePlate), // 确保是字符串
    backup: false,                       // Boolean 类型
    equipModelId: "#20:81",              // 对应 WO_YS_TR
    uid: String(uid),                    // 确保是字符串
    exFields: [
      {
        exFieldId: "#157:277",
        field: "核定载质量",
        value: String(safeLoadWeight),   // 🔴 关键修复：这里必须是 String
        format: "json"
      },
      {
        exFieldId: "#157:590",
        field: "车牌颜色",
        // 🔴 修复：value 应该是对象，而不是 JSON 字符串
        // 当整个 payload 被 JSON.stringify 序列化时，这个对象会被正确序列化
        value: {
          "rid": "#183:51",
          "value": "黄色",
          "display": "黄色",
          "selector": "黄色",
          "values": [
            {
              "key": "Name",
              "name": "名称",
              "value": "黄色"
            },
            {
              "key": "Code",
              "name": "代码",
              "value": "2"
            }
          ]
        },
        format: "json",
        valueRefId: "#183:51",
        codefId: "#182:14"
      }
    ],
    relations: []                        // 空数组
  };

  // 🔴 验证 payload 的每个字段
  if (!payload.uid || typeof payload.uid !== 'string') {
    throw new Error('UID 生成失败');
  }
  if (!payload.serialno || typeof payload.serialno !== 'string') {
    throw new Error('车牌号无效');
  }
  if (!Array.isArray(payload.exFields) || payload.exFields.length === 0) {
    throw new Error('exFields 数组无效');
  }
  if (typeof payload.exFields[0].value !== 'string') {
    throw new Error('exFields[0].value 必须是字符串');
  }

  // 🔴 验证 payload 的每个字段（双重检查）
  if (!payload.uid || typeof payload.uid !== 'string') {
    throw new Error('UID 生成失败');
  }
  if (!payload.serialno || typeof payload.serialno !== 'string') {
    throw new Error('车牌号无效');
  }

  // 🔴 调试：打印即将发送的最终 JSON，检查是否有格式错误
  const bodyString = JSON.stringify(payload);
  console.log(`📤 正在发送 Payload (车辆: ${licensePlate}):`, bodyString);

  try {
    console.log(`正在同步车辆 ${licensePlate} 到第三方平台...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "auth-session": authToken,  // 🔴 小写 header（与真实请求一致）
        "content-type": "application/json;charset=UTF-8",
        "Cookie": `Auth-Session=${encodeURIComponent(authToken)}`,
        "origin": "https://zkzy.zkzy1688.com",
        "priority": "u=1, i",
        "referer": "https://zkzy.zkzy1688.com/console/",
        "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "x-auth-session": authToken  // 🔴 额外添加（与真实请求一致）
      },
      body: bodyString
    });

    // 获取返回的文本内容
    const responseText = await response.text();
    
    if (!response.ok) {
      // 🔴 处理 HTTP 错误（包括 409）
      console.error(`❌ 同步失败 [HTTP ${response.status}]:`, responseText);
      
      // 🔴 处理认证错误（401/403）- 自动重试
      if (response.status === 401 || response.status === 403) {
        console.warn("⚠️ Token 过期，重新获取 Token 并重试...");
        try {
          // 重新从共享模块获取 Token
          const newToken = await getToken('add');
          // 使用新 Token 重试
          return syncVehicleToThirdParty(licensePlate, loadWeight);
        } catch (retryError) {
          return { 
            success: false, 
            message: `认证失败：Token 已过期，重新获取 Token 也失败。错误: ${retryError instanceof Error ? retryError.message : String(retryError)}` 
          };
        }
      }
      
      // 🔴 特殊处理 409 错误
      // 409 可能表示"已存在"或"格式错误"，需要根据响应内容判断
      if (response.status === 409) {
        // 尝试解析错误响应 JSON
        let errorObj: { code?: string; message?: string } | null = null;
        try {
          const parsed = JSON.parse(responseText);
          // 处理数组格式: [{"code":"ConflictError", "message":"..."}]
          if (Array.isArray(parsed) && parsed.length > 0) {
            errorObj = parsed[0];
          } 
          // 处理对象格式: {"code":"InvalidArgument","message":"Invalid JSON."}
          else if (parsed && typeof parsed === 'object') {
            errorObj = parsed;
          }
        } catch (e) {
          // JSON 解析失败，使用原始文本
        }

        // 🔴 判断是否是真正的"已存在"
        const isReallyExisted = 
          responseText.includes("已存在") ||
          responseText.includes("ConflictError") ||
          (errorObj?.code === "ConflictError") ||
          (errorObj?.message && errorObj.message.includes("已存在"));

        // 🔴 判断是否是格式错误
        const isFormatError = 
          responseText.includes("Invalid JSON") ||
          (errorObj?.code === "InvalidArgument" && errorObj?.message && errorObj.message.includes("Invalid JSON"));

        if (isFormatError) {
          // 格式错误，返回错误，不继续执行
          console.error('❌ 第三方API返回格式错误 (409 Invalid JSON)');
          console.error('请求URL:', url);
          console.error('请求体:', bodyString);
          console.error('错误响应:', responseText);
          
          return { 
            success: false, 
            message: `格式错误 (409 Invalid JSON): 服务端返回 "${errorObj?.message || responseText}"。请检查：1) 字段类型是否正确 2) 字符串值是否包含特殊字符 3) 数值是否正确转换为字符串`
          };
        }

        if (isReallyExisted) {
          // 真的已存在，视为成功，继续执行后续步骤
          const errorMessage = errorObj?.message || `车辆 ${licensePlate} 已存在于轨迹查询库`;
          console.log(`✅ 车辆 ${licensePlate} 已存在（409），视为成功`);
          return { 
            success: true, 
            status: "existed", 
            message: errorMessage
          };
        }

        // 其他409错误，返回错误
        return { 
          success: false, 
          message: `添加失败 (409): ${errorObj?.message || responseText}` 
        };
      }
      
      // 其他 HTTP 错误
      return { 
        success: false, 
        message: `添加失败 [${response.status}]: ${responseText}`,
        status: response.status 
      };
    }

    // 成功添加新车辆
    const result = responseText ? JSON.parse(responseText) : null;
    console.log("✅ 车辆添加成功:", result);
    return { 
      success: true, 
      status: "created", 
      message: `车辆 ${licensePlate} 已成功添加到轨迹查询库`,
      data: result 
    };

  } catch (error) {
    console.error("❌ 网络请求异常:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "未知错误" 
    };
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
    console.log(`\n🔍 开始查询车辆ID: ${licensePlate}`);

    // 2. 请求第三方接口查询车辆ID
    const params = new URLSearchParams({ keyword: licensePlate, shab: "y" });
    const url = `${apiBaseUrl}/rest/entity/search?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Auth-Session": authToken,
        "X-Auth-Session": authToken,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://zkzy.zkzy1688.com/monitor/",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
      }
    });

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
      console.log('解析后的请求体:', requestBody);
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
      console.log('🔍 只查询车辆ID并同步到数据库（不添加车辆）...');
      const syncIdResult = await syncVehicleIdToDatabase(licensePlate.trim());
      
      return new Response(
        JSON.stringify(syncIdResult),
        { 
          status: syncIdResult.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 🔴 模式2：添加车辆到第三方平台
    const addResult = await syncVehicleToThirdParty(
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
      console.log('🔄 开始查询车辆ID并同步到数据库...');
      
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

