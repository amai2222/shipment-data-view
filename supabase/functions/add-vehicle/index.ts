// 添加车辆到轨迹查询库（集成自动登录功能）
// @ts-expect-error - Edge Function运行在Deno环境，Deno类型在运行时可用
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// === 全局配置 ===
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
};

// 直接导入共享模块，避免 HTTP 调用开销
import { getToken } from '../_shared/token-cache.ts';

/**
 * 添加车辆到 ZKZY 平台
 * @param licensePlate 车牌号 (例如: "冀EX9795")
 * @param loadWeight 核定载质量 (可选，默认 "0")
 */
async function addVehicleToThirdParty(licensePlate: string, loadWeight: string = "0") {
  const url = `${CONFIG.baseUrl}/rest/equip`;

  // 🔴 从共享模块获取 Token（直接调用，无 HTTP 开销）
  let authToken: string;
  try {
    authToken = await getToken('add');
    console.log('✅ 从共享模块获取到 Token');
  } catch (error) {
    // 如果获取失败，尝试使用环境变量（降级方案）
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    authToken = Deno.env.get('TRACKING_ADD_TOKEN') || "";
    if (!authToken) {
      throw new Error(`无法获取 Token：共享模块调用失败且未配置环境变量。错误: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.warn('⚠️ 使用环境变量 Token（共享模块调用失败）');
  }

  // 生成 UID
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const uid = `100${timeStr}${Math.floor(Math.random() * 10000000000)}`;

  // 🔴 构造 payload（严格按照第三方网站真实请求的字段顺序和格式）
  // 参考实际请求：{lastDeptId, deptId, desc, serialno, backup, equipModelId, uid, exFields, relations}
  // ⚠️ 注意：
  // 1. exFields[0].value 必须是字符串（如 "0"），不是数字
  // 2. exFields[1].value 必须是对象，不能是 JSON 字符串
  // 3. 因为 format: "json" 表示该字段的值应该是 JSON 对象，而不是字符串化的 JSON
  const payload = {
    lastDeptId: "#16:171",
    deptId: "#16:5043",
    desc: String(licensePlate).trim(),
    serialno: String(licensePlate).trim(),
    backup: false,
    equipModelId: "#20:81",
    uid: String(uid),
    exFields: [
      {
        exFieldId: "#157:277",
        field: "核定载质量",
        // 🔴 确保 value 是有效的数字字符串，不能是 "e" 或其他无效值
        value: (() => {
          const weightStr = String(loadWeight || "0").trim();
          // 验证是否是有效的数字字符串
          if (weightStr && !isNaN(parseFloat(weightStr)) && isFinite(parseFloat(weightStr))) {
            return weightStr;
          }
          // 如果无效，返回 "0"
          console.warn(`⚠️ [Add] 无效的 loadWeight 值: "${weightStr}"，使用默认值 "0"`);
          return "0";
        })(),
        format: "json"
      },
      {
        exFieldId: "#157:590",
        field: "车牌颜色",
        // 🔴 关键修复：第三方API期望 value 是 JSON 字符串，而不是对象
        // 从实际请求中确认：value 应该是字符串化的 JSON
        value: JSON.stringify({
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
        }),
        format: "json",
        valueRefId: "#183:51",
        codefId: "#182:14"
      }
    ],
    relations: []
  };

  // 🔴 验证 payload 是否可以正确序列化
  let bodyString: string;
  try {
    bodyString = JSON.stringify(payload);
    // 🔴 验证序列化后的 JSON 是否可以正确解析
    const parsedTest = JSON.parse(bodyString);
    // 🔴 输出完整的 payload 用于调试
    console.log(`📤 [Add] 发送 Payload (${licensePlate}):`, bodyString);
    console.log(`📤 [Add] Payload 完整内容:`, JSON.stringify(parsedTest, null, 2));
    console.log(`📤 [Add] Payload 验证: 序列化成功，字段类型检查:`, {
      uid: typeof parsedTest.uid,
      uidValue: parsedTest.uid,
      serialno: typeof parsedTest.serialno,
      serialnoValue: parsedTest.serialno,
      desc: typeof parsedTest.desc,
      descValue: parsedTest.desc,
      backup: typeof parsedTest.backup,
      equipModelId: parsedTest.equipModelId,
      exFields0Value: typeof parsedTest.exFields?.[0]?.value,
      exFields0ValueValue: parsedTest.exFields?.[0]?.value,
      exFields1Value: typeof parsedTest.exFields?.[1]?.value,
      exFields1ValueIsObject: parsedTest.exFields?.[1]?.value && typeof parsedTest.exFields[1].value === 'object',
      exFieldsLength: parsedTest.exFields?.length,
      relationsLength: parsedTest.relations?.length
    });
  } catch (stringifyError) {
    console.error('❌ [Add] Payload 序列化失败:', stringifyError);
    throw new Error(`Payload 序列化失败: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}`);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json, text/plain, */*",
        "auth-session": authToken,  // 🔴 小写 header（与真实请求一致）
        "content-type": "application/json;charset=UTF-8",
        "Cookie": `Auth-Session=${encodeURIComponent(authToken)}`,
        "origin": "https://zkzy.zkzy1688.com",
        "priority": "u=1, i",
        "referer": `${CONFIG.baseUrl}/console/`,
        "sec-ch-ua": '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": CONFIG.userAgent,
        "x-auth-session": authToken  // 🔴 额外添加（与真实请求一致）
      },
      body: bodyString
    });

    const text = await response.text();
    console.log(`📥 [Add] 响应 [${response.status}]:`, text.substring(0, 500)); // 只记录前500字符

    // 🔴 处理认证错误（401/403）- 自动重试
    if (response.status === 401 || response.status === 403) {
      console.warn("⚠️ Token 过期，重新获取 Token 并重试...");
      try {
        // 重新从共享模块获取 Token
        const newToken = await getToken('add');
        // 使用新 Token 重试
        return addVehicleToThirdParty(licensePlate, loadWeight);
      } catch (retryError) {
        return { 
          success: false, 
          message: `认证失败：Token 已过期，重新获取 Token 也失败。错误: ${retryError instanceof Error ? retryError.message : String(retryError)}` 
        };
      }
    }

    // 🔴 处理各种响应状态码
    if (!response.ok) {
      console.error(`❌ [Add] 失败 [${response.status}]:`, text);
      
      // 409 处理（冲突 - 需要区分"已存在"和"格式错误"）
      if (response.status === 409) {
        // 🔴 先尝试解析 JSON，判断错误类型
        // 第三方 API 可能返回：
        // 1. 数组格式: [{"code":"ConflictError", "message":"『货车:冀EX9795』已存在!"}]
        // 2. 对象格式: {"code":"InvalidArgument","message":"Invalid JSON."}
        // 3. 其他格式
        let errorObj: { code?: string; message?: string } | null = null;
        let responseData: unknown = null;
        
        try {
          responseData = text ? JSON.parse(text) : null;
          
          // 检查是否为数组格式
          if (Array.isArray(responseData) && responseData.length > 0) {
            errorObj = responseData[0];
          } 
          // 如果是单个对象
          else if (responseData && typeof responseData === 'object' && 'code' in responseData) {
            errorObj = responseData as { code?: string; message?: string };
          }
        } catch (parseError) {
          // JSON 解析失败，使用原始文本
          console.warn("⚠️ 解析 409 响应失败:", parseError);
        }

        // 🔴 判断是否是格式错误
        const isFormatError = 
          text.includes("Invalid JSON") ||
          (errorObj?.code === "InvalidArgument" && errorObj?.message && errorObj.message.includes("Invalid JSON"));

        if (isFormatError) {
          // 格式错误，返回错误，不继续执行
          console.error('❌ [Add] 第三方API返回格式错误 (409 Invalid JSON)');
          console.error('请求URL:', url);
          console.error('请求体:', bodyString);
          console.error('错误响应:', text);
          
          return { 
            success: false, 
            message: `格式错误 (409 Invalid JSON): 服务端返回 "${errorObj?.message || text}"。请检查：1) 字段类型是否正确 2) 字符串值是否包含特殊字符 3) 数值是否正确转换为字符串`
          };
        }

        // 🔴 判断是否是真正的"已存在"
        const isReallyExisted = 
          text.includes("已存在") ||
          text.includes("ConflictError") ||
          (errorObj?.code === "ConflictError") ||
          (errorObj?.message && errorObj.message.includes("已存在"));

        if (isReallyExisted) {
          // 真的已存在，视为成功
          const errorMessage = errorObj?.message || `车辆 ${licensePlate} 已存在于轨迹查询库`;
          console.log("✅ [Add] 车辆已存在（409），视为成功:", errorMessage);
          return { 
            success: true, 
            status: "existed", 
            message: errorMessage,
            data: responseData
          };
        }

        // 其他409错误，返回错误
        return { 
          success: false, 
          message: `添加失败 (409): ${errorObj?.message || text}` 
        };
      }
      
      // 400 处理（可能是格式错误或其他验证错误）
      if (response.status === 400) {
        // 尝试解析错误信息
        let errorMessage = text;
        try {
          const errorData = text ? JSON.parse(text) : {};
          errorMessage = errorData.message || errorData.error || errorData.details || text;
        } catch (e) {
          // 如果解析失败，使用原始文本
        }
        return { success: false, message: `请求错误: ${errorMessage}` };
      }
      
      // 其他错误状态码
      return { success: false, message: `添加失败 [${response.status}]: ${text.substring(0, 200)}` };
    }

    // 🔴 处理成功响应（200/201/204等）
    // 尝试解析响应体
    let responseData: unknown = {};
    let parseError: Error | null = null;
    
    if (text && text.trim()) {
      try {
        responseData = JSON.parse(text);
      } catch (e) {
        parseError = e instanceof Error ? e : new Error(String(e));
        console.warn("⚠️ 响应体不是有效的 JSON，使用原始文本:", text.substring(0, 200));
        // 如果响应体不是 JSON，但状态码是成功的，仍然视为成功
        responseData = { raw: text };
      }
    }

    // 🔴 检查响应数据中是否包含错误信息
    if (responseData && typeof responseData === 'object' && 'error' in responseData) {
      const errorObj = responseData as { error?: string; message?: string };
      console.error("❌ 响应中包含错误信息:", errorObj);
      return { 
        success: false, 
        message: errorObj.message || errorObj.error || '添加失败' 
      };
    }

    // 🔴 检查响应数据中是否包含成功标识
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
      const resultObj = responseData as { success?: boolean; message?: string; data?: unknown };
      if (resultObj.success === false) {
        return { 
          success: false, 
          message: resultObj.message || '添加失败' 
        };
      }
    }

    // ✅ 成功情况
    console.log("✅ [Add] 成功:", responseData);
    return { 
      success: true, 
      status: "created", 
      data: responseData,
      message: "车辆已成功添加到轨迹查询库"
    };

  } catch (error) {
    console.error("❌ [Add] 异常:", error);
    return { success: false, message: error instanceof Error ? error.message : "未知错误" };
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
    // 解析请求体
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

    // 🔴 验证和清理 loadWeight 参数
    let safeLoadWeight = "0";
    if (loadWeight !== undefined && loadWeight !== null) {
      const weightStr = String(loadWeight).trim();
      // 检查是否是有效的数字字符串
      if (weightStr && !isNaN(parseFloat(weightStr)) && isFinite(parseFloat(weightStr))) {
        safeLoadWeight = weightStr;
      } else if (weightStr === "" || weightStr === "0") {
        safeLoadWeight = "0";
      } else {
        // 如果传入的是无效值（如 "e"），使用默认值 "0"
        console.warn(`⚠️ [Add] 无效的 loadWeight 值: "${weightStr}"，使用默认值 "0"`);
        safeLoadWeight = "0";
      }
    }

    // 添加车辆到第三方平台
    const addResult = await addVehicleToThirdParty(
      licensePlate.trim(), 
      safeLoadWeight
    );

    // 返回结果
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

