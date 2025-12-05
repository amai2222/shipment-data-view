// 添加车辆到轨迹查询库（使用 replacer 函数优化版）
// @ts-expect-error - Edge Function运行在Deno环境
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// === 全局配置 ===
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
};

// 直接导入共享模块
import { getToken } from '../_shared/token-cache.ts';

async function addVehicleToThirdParty(licensePlate: string, loadWeight: string = "0") {
  const url = `${CONFIG.baseUrl}/rest/equip`;

  // 1. 获取 Token
  let authToken: string;
  try {
    authToken = await getToken('add');
    console.log('✅ [Add] 获取 Token 成功');
  } catch (error) {
    // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
    authToken = Deno.env.get('TRACKING_ADD_TOKEN') || "";
    if (!authToken) throw new Error(`无法获取 Token: ${error}`);
  }

  // 2. 生成 UID
  // 🔴 修复：成功案例的 UID 格式是 100 + 14位时间戳 + 13位随机数 = 30 字符
  // 例如：100202512051150527582458941931
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  // 生成 13 位随机数（0-9999999999999）
  const random13 = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
  const uid = `100${timeStr}${random13}`;

  // 3. 准备数据
  const safeLoadWeight = (() => {
    const weightStr = String(loadWeight || "0").trim();
    if (weightStr && !isNaN(parseFloat(weightStr)) && isFinite(parseFloat(weightStr))) {
      return weightStr;
    }
    console.warn(`⚠️ [Add] 无效的 loadWeight 值: "${weightStr}"，使用默认值 "0"`);
    return "0";
  })();
  const cleanLicensePlate = String(licensePlate).trim();

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

  // ✅ 构建 payload 对象（严格按照成功案例的字段顺序）
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
        value: colorValueString, // 已经是 JSON 字符串，会被正确转义
        format: "json",
        valueRefId: "#183:51",
        codefId: "#182:14"
      }
    ],
    relations: []
  };
  
  // ✅ 使用 JSON.stringify 序列化（确保格式一致）
  const bodyString = JSON.stringify(payloadObject);

  // 构建请求头
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
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
        console.warn("⚠️ Token 过期，重试一次...");
        return { success: false, message: "Token 已刷新，请重试操作" };
      }

      let errorData: { code?: string; message?: string } = {};
      try {
        errorData = text ? JSON.parse(text) : {};
      } catch (e) {
        console.warn("无法解析错误响应为 JSON:", text);
      }
      
      const errorMessage = errorData.message || errorData.code || text;
      
      if (response.status === 409 && (errorMessage.includes("已存在") || errorMessage.includes("Conflict"))) {
        return { success: true, status: "existed", message: "车辆已存在" };
      }

      console.error(`❌ [Add] API 返回错误 [${response.status}]:`, errorMessage);
      return { 
        success: false, 
        message: `添加失败 [${response.status}]: ${errorMessage}`,
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
    console.error("❌ [Add] 网络异常:", error);
    return { success: false, message: error instanceof Error ? error.message : "请求超时或网络错误" };
  }
}

// 主入口
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { licensePlate, loadWeight } = await req.json();

    if (!licensePlate) {
      return new Response(JSON.stringify({ success: false, message: 'Missing licensePlate' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const result = await addVehicleToThirdParty(licensePlate, loadWeight);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
