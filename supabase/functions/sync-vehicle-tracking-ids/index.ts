// 同步车辆轨迹ID映射函数
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS配置（参考 Gemini 代码）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONFIG = {
  baseUrl: "https://zkzy.zkzy1688.com",
};

// 直接导入共享模块，避免 HTTP 调用开销
import { getToken } from '../_shared/token-cache.ts';

serve(async (req) => {
  // 处理CORS预检请求（参考 Gemini 代码）
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 从请求头获取用户的 JWT token（用于权限检查）
    const authHeader = req.headers.get('Authorization');
    
    // 初始化 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // 创建两个客户端：
    // 1. 使用 anon key + Authorization header 的客户端（用于权限检查，auth.uid() 可以正确识别用户）
    // 2. 使用服务角色密钥的客户端（用于需要绕过 RLS 的操作）
    const supabaseUser = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {}
        }
      }
    );
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 从共享模块获取 Token（直接调用，无 HTTP 开销）
    let SESSION_TOKEN: string;
    try {
      SESSION_TOKEN = await getToken('query');
      console.log('✅ 从共享模块获取到 Token');
    } catch (error) {
      // 如果获取失败，尝试使用环境变量（降级方案）
      // @ts-expect-error - Deno 全局对象在 Edge Function 运行时环境中可用
      SESSION_TOKEN = Deno.env.get('TRACKING_AUTH_SESSION') || "";
      if (!SESSION_TOKEN) {
        throw new Error(`无法获取 Token：共享模块调用失败且未配置环境变量。错误: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.warn('⚠️ 使用环境变量 Token（共享模块调用失败）');
    }
    
    const DEPT_ID = '#16:5043'; // 默认部门ID

    // 从请求中获取部门ID（可选）
    let finalDeptId = DEPT_ID;
    try {
      const body = await req.json();
      if (body && body.deptId) {
        finalDeptId = body.deptId;
      }
    } catch {
      // 如果没有请求体，使用默认值
    }

    console.log('正在连接第三方平台同步车辆...');
    const targetUrl = `${CONFIG.baseUrl}/rest/monitor/department/equipments?deptId=${encodeURIComponent(finalDeptId)}`;

    // 调用第三方接口获取车辆列表（参考 Gemini 代码的请求头格式）
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cookie': `Auth-Session=${encodeURIComponent(SESSION_TOKEN)}`,
        'x-auth-session': SESSION_TOKEN,
        'x-requested-with': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', // 参考 Gemini，使用移动端 User-Agent
      },
    });

    // 🔴 处理认证错误（401/403）- 自动重试
    if (response.status === 401 || response.status === 403) {
      console.warn("⚠️ Token 过期，重新获取 Token 并重试...");
      try {
        // 重新从共享模块获取 Token
        const newToken = await getToken('query');
        // 使用新 Token 重新发起请求
        const retryResponse = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cookie': `Auth-Session=${encodeURIComponent(newToken)}`,
            'x-auth-session': newToken,
            'x-requested-with': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
          },
        });
        
        if (retryResponse.ok) {
          // 使用重试的响应继续处理
          const rawData = await retryResponse.json();
          // 继续后续处理...
          const vehicleList = Array.isArray(rawData) ? rawData : (rawData.children || []);
          console.log(`获取到 ${vehicleList.length} 辆车的数据`);

          interface VehicleItem {
            id?: string;
            serialno?: string;
            desc?: string;
          }

          const vehicleMappings = vehicleList
            .filter((v: VehicleItem) => {
              const plateNumber = v.serialno;
              const remoteId = v.id;
              return remoteId && plateNumber;
            })
            .map((v: VehicleItem) => {
              const plateNumber = v.serialno || '';
              return {
                id: v.id!,
                serialno: plateNumber.trim(),
                desc: (v.desc || plateNumber).trim(),
              };
            });

          console.log(`找到 ${vehicleMappings.length} 个有效车辆映射（共 ${vehicleList.length} 条数据）`);

          if (vehicleMappings.length === 0) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: '未找到有效的车辆数据',
                stats: {
                  total_remote: vehicleList.length,
                  synced_local: 0
                }
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          const { data: syncResult, error: syncError } = await supabaseUser.rpc(
            'sync_vehicle_tracking_ids',
            { 
              p_vehicle_mappings: vehicleMappings,
              p_dept_id: finalDeptId
            }
          );

          if (syncError) {
            console.error('同步车辆ID失败:', syncError);
            throw new Error(`同步失败: ${syncError.message}`);
          }

          const syncedCount = (syncResult?.updated || 0) + (syncResult?.inserted || 0);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: '同步完成',
              stats: {
                total_remote: vehicleList.length,
                synced_local: syncedCount
              },
              details: syncResult
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          throw new Error(`重试后仍然失败: ${retryResponse.status}`);
        }
      } catch (retryError) {
        throw new Error(`认证失败：Token 已过期，自动登录重试也失败。错误: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
      }
    }

    if (!response.ok) {
      // 参考 Gemini 代码，包含状态码和状态文本
      throw new Error(`第三方接口报错: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();

    // 兼容处理：有些接口直接返回数组，有些返回 { children: [] }（参考 Gemini 代码）
    const vehicleList = Array.isArray(rawData) ? rawData : (rawData.children || []);
    console.log(`获取到 ${vehicleList.length} 辆车的数据`);

    // 根据实际 API 返回的数据结构定义接口
    // 实际数据结构：{ id: "#26:4140", serialno: "吉AP4359", desc: "吉AP4359" }
    interface VehicleItem {
      id?: string;           // 车辆ID，格式：#26:4140
      serialno?: string;     // 车牌号，例如：吉AP4359
      desc?: string;         // 车辆描述
    }

    // 提取车辆ID和车牌号映射（参考 Gemini 代码，使用 serialno 作为车牌号，id 作为追踪ID）
    const vehicleMappings = vehicleList
      .filter((v: VehicleItem) => {
        // 关键修正：使用 'serialno' 作为车牌号，'id' 作为追踪ID（参考 Gemini 代码）
        const plateNumber = v.serialno; // 例如 "吉AP4359"
        const remoteId = v.id;          // 例如 "#26:4140"
        return remoteId && plateNumber;
      })
      .map((v: VehicleItem) => {
        // 根据实际数据结构，车牌号在 serialno 字段
        const plateNumber = v.serialno || '';
        return {
          id: v.id!,
          serialno: plateNumber.trim(),  // 统一使用 serialno 字段名传递给数据库函数
          desc: (v.desc || plateNumber).trim(),  // 使用 desc 字段或车牌号作为描述
        };
      });

    console.log(`找到 ${vehicleMappings.length} 个有效车辆映射（共 ${vehicleList.length} 条数据）`);

    if (vehicleMappings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: '未找到有效的车辆数据',
          stats: {
            total_remote: vehicleList.length,
            synced_local: 0
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 调用数据库函数同步映射关系到 vehicle_tracking_id_mappings 表
    // 注意：与 Gemini 代码不同，我们使用独立的映射表，而不是直接更新 internal_vehicles
    // 使用用户 token 的客户端，这样 auth.uid() 可以正确识别用户，权限检查才能正常工作
    const { data: syncResult, error: syncError } = await supabaseUser.rpc(
      'sync_vehicle_tracking_ids',
      { 
        p_vehicle_mappings: vehicleMappings,
        p_dept_id: finalDeptId
      }
    );

    if (syncError) {
      console.error('同步车辆ID失败:', syncError);
      throw new Error(`同步失败: ${syncError.message}`);
    }

    // 计算同步数量
    const syncedCount = (syncResult?.updated || 0) + (syncResult?.inserted || 0);

    // 参考 Gemini 代码，返回简化格式
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '同步完成',
        stats: {
          total_remote: vehicleList.length,
          synced_local: syncedCount
        },
        details: syncResult // 包含详细的更新/插入/错误信息
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('同步发生错误:', error);
    // 参考 Gemini 代码，简化错误处理
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

