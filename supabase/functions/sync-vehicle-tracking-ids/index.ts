// 同步车辆轨迹ID映射函数
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS配置
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// 车辆列表API配置
const VEHICLE_LIST_API_BASE = 'https://zkzy.zkzy1688.com';
const VEHICLE_LIST_API_PATH = '/rest/monitor/department/equipments';

serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 获取Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // 验证用户身份
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: '未授权，请先登录' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 从请求中获取部门ID（可选，如果没有提供则使用默认值）
    const { deptId } = await req.json().catch(() => ({ deptId: '#16:5043' }));
    const finalDeptId = deptId || '#16:5043';

    // 从环境变量获取认证信息
    const authSession = Deno.env.get('TRACKING_AUTH_SESSION') || '#13:206-dde3b628224190a02a6908b5-cladmin-ZKZY';
    const encodedAuthSession = encodeURIComponent(authSession);

    // 构建查询URL
    const url = new URL(VEHICLE_LIST_API_PATH, VEHICLE_LIST_API_BASE);
    url.searchParams.set('deptId', encodeURIComponent(finalDeptId));

    // 调用外部API获取车辆列表
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'x-auth-session': authSession,
        'x-requested-with': 'XMLHttpRequest',
        'referer': 'https://zkzy.zkzy1688.com/monitor/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'cookie': `Auth-Session=${encodedAuthSession}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('获取车辆列表API错误:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `获取车辆列表失败: ${response.status} ${response.statusText}`,
          details: errorText 
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const vehicles = await response.json();

    // 验证返回数据格式
    if (!Array.isArray(vehicles)) {
      return new Response(
        JSON.stringify({ error: '返回数据格式错误：期望数组' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 提取车辆ID和车牌号映射
    const vehicleMappings = vehicles
      .filter((v: { id?: string; serialno?: string }) => v.id && v.serialno)
      .map((v: { id: string; serialno: string; desc?: string }) => ({
        id: v.id,
        serialno: v.serialno,
        desc: v.desc || v.serialno,
      }));

    if (vehicleMappings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: '未找到有效的车辆数据',
          total: 0,
          synced: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 调用数据库函数同步映射关系
    const { data: syncResult, error: syncError } = await supabaseClient.rpc(
      'sync_vehicle_tracking_ids',
      { 
        p_vehicle_mappings: vehicleMappings,
        p_dept_id: finalDeptId
      }
    );

    if (syncError) {
      console.error('同步车辆ID失败:', syncError);
      return new Response(
        JSON.stringify({ 
          error: '同步车辆ID失败',
          details: syncError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: '同步完成',
        total: vehicleMappings.length,
        synced: syncResult?.updated || 0,
        errors: syncResult?.errors || 0,
        error_messages: syncResult?.error_messages || [],
        details: syncResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('同步车辆ID代理错误:', error);
    return new Response(
      JSON.stringify({ 
        error: '同步车辆ID失败',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

