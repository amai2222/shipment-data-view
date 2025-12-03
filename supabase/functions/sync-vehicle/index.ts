// 同步车辆到第三方平台（ZKZY）
// @ts-expect-error - Edge Function运行在Deno环境，Deno类型在运行时可用
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * 同步添加车辆到 ZKZY 平台
 * @param licensePlate 车牌号 (例如: "冀EX9795")
 * @param loadWeight 核定载质量 (可选，默认 "0")
 */
async function syncVehicleToThirdParty(licensePlate: string, loadWeight: string = "0") {
  // 1. 修正后的准确 API 地址
  const url = "https://zkzy.zkzy1688.com/rest/equip";

  // 2. 从环境变量获取身份令牌
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const authToken = Deno.env.get('TRACKING_AUTH_SESSION') || "#13:4972-7fa3403f25a8eabd9edba1b8-carquery-ZKZY";
  
  if (!authToken) {
    throw new Error('Missing TRACKING_AUTH_SESSION: 请在 Supabase Dashboard 的 Edge Functions 设置中添加 TRACKING_AUTH_SESSION 环境变量');
  }

  // 3. 生成动态 UID (模拟格式: 100 + 年月日时分秒 + 随机数)
  // 必须生成新的，否则会报 "主键冲突" 错误
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14); // 结果如 20251203123000
  const randomStr = Math.floor(Math.random() * 10000000000).toString();
  const uid = `100${timeStr}${randomStr}`;

  // 4. 构造请求体
  const payload = {
    uid: uid,
    serialno: licensePlate,
    desc: licensePlate,
    // 以下 ID 根据您的账号环境固定
    deptId: "#16:5043",      
    lastDeptId: "#16:171",
    equipModelId: "#20:81",  // 对应车型 WO_YS_TR
    backup: false,
    relations: [],
    exFields: [
      {
        exFieldId: "#157:277",
        field: "核定载质量",
        value: loadWeight,
        format: "json"
      }
    ]
  };

  try {
    console.log(`正在同步车辆 ${licensePlate} 到第三方平台...`);
    console.log(`请求体:`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        // 🔴 关键修改：使用自定义鉴权头
        "Auth-Session": authToken, 
        // 伪装来源，防止被拦截
        "Referer": "https://zkzy.zkzy1688.com/console/",
        "Origin": "https://zkzy.zkzy1688.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "x-requested-with": "XMLHttpRequest"
      },
      body: JSON.stringify(payload)
    });

    // 获取返回的文本内容
    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // 如果不是JSON，可能是其他错误
      result = { message: responseText };
    }

    // 🔴 核心优化：专门拦截"已存在"的错误，视为成功
    if (result && (result.code === "ConflictError" || 
                   (result.message && result.message.includes("已存在")) ||
                   (result.message && result.message.includes("already exists")) ||
                   (result.message && result.message.includes("duplicate")))) {
      console.log(`⚠️ 车辆 ${licensePlate} 已存在，跳过添加（视为成功）。`);
      return { 
        success: true, 
        status: "existed", 
        message: `车辆 ${licensePlate} 已存在于轨迹查询库`,
        data: result 
      };
    }

    // 处理其他真正的 HTTP 错误
    if (!response.ok) {
      console.error(`❌ 同步失败 [HTTP ${response.status}]:`, responseText);
      
      if (response.status === 401 || response.status === 403) {
        return { 
          success: false, 
          message: "Token 已过期，请重新抓取 Auth-Session" 
        };
      }
      
      return { 
        success: false, 
        message: result.message || responseText,
        status: response.status 
      };
    }

    // 成功添加新车辆
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
    const { licensePlate, loadWeight } = await req.json();

    // 验证必要参数
    if (!licensePlate || typeof licensePlate !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '缺少必要参数：licensePlate（车牌号）' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 调用同步函数
    const result = await syncVehicleToThirdParty(
      licensePlate.trim(), 
      loadWeight ? String(loadWeight).trim() : "0"
    );

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
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

