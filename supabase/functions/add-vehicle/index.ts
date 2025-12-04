// 添加车辆到轨迹查询库
// @ts-expect-error - Edge Function运行在Deno环境，Deno类型在运行时可用
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// === 全局配置 ===
const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/137.0.0.0 Safari/537.36"
};

/**
 * 添加车辆到 ZKZY 平台
 * @param licensePlate 车牌号 (例如: "冀EX9795")
 * @param loadWeight 核定载质量 (可选，默认 "0")
 */
async function addVehicleToThirdParty(licensePlate: string, loadWeight: string = "0") {
  const url = `${CONFIG.baseUrl}/rest/equip`;

  // 🔴 专门用于【添加车辆】的 Token
  // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
  const authToken = Deno.env.get('TRACKING_ADD_TOKEN') || "#13:4972-7fa3403f25a8eabd9edba1b8-carquery-ZKZY"; 

  if (!authToken) throw new Error('缺少 TRACKING_ADD_TOKEN 环境变量');

  // 生成 UID
  const now = new Date();
  const timeStr = now.toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const uid = `100${timeStr}${Math.floor(Math.random() * 10000000000)}`;

  // 🔴 构造 payload（严格按照第三方网站真实请求的字段顺序）
  // ⚠️ 注意：exFields[1].value 必须是对象，不能是 JSON 字符串
  // 因为 format: "json" 表示该字段的值应该是 JSON 对象，而不是字符串化的 JSON
  const payload = {
    lastDeptId: "#16:171",
    deptId: "#16:5043",
    desc: String(licensePlate).trim(),
    serialno: String(licensePlate).trim(),
    backup: false,
    equipModelId: "#20:81",
    uid: String(uid),
    exFields: [{
      exFieldId: "#157:277",
      field: "核定载质量",
      value: String(loadWeight || "0").trim(),
      format: "json"
    }, {
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
    }],
    relations: []
  };

  const bodyString = JSON.stringify(payload);
  console.log(`📤 [Add] 发送 Payload (${licensePlate}):`, bodyString);

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

    if (!response.ok) {
      console.error(`❌ [Add] 失败 [${response.status}]:`, text);
      // 409 处理
      if (response.status === 409) {
        if (text.includes("Invalid JSON")) {
             return { success: false, message: `格式错误 (Invalid JSON): ${text}` };
        }
        // 视为已存在
        return { success: true, status: "existed", message: "车辆已存在" };
      }
      return { success: false, message: `添加失败 [${response.status}]: ${text}` };
    }

    const data = text ? JSON.parse(text) : {};
    console.log("✅ [Add] 成功:", data);
    return { success: true, status: "created", data };

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

    const { licensePlate, loadWeight } = requestBody;

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

    // 添加车辆到第三方平台
    const addResult = await addVehicleToThirdParty(
      licensePlate.trim(), 
      loadWeight ? String(loadWeight).trim() : "0"
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

