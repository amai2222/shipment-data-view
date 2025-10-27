// supabase/functions/update-user-password/index.ts
// 用于安全更新用户密码的 Edge Function

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePasswordRequest {
  userId: string;
  newPassword: string;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 从环境变量获取配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 使用 Service Role Key 创建管理员客户端
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 验证当前用户是否登录
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '未授权访问' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 从 Authorization header 获取当前用户的 token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !currentUser) {
      return new Response(
        JSON.stringify({ error: '身份验证失败' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 解析请求体
    const requestData: UpdatePasswordRequest = await req.json();

    // 验证必填字段
    if (!requestData.userId || !requestData.newPassword) {
      return new Response(
        JSON.stringify({ error: '缺少必填字段：userId、newPassword' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 验证密码强度
    if (requestData.newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: '密码长度至少为 6 位' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取当前用户的角色
    const { data: currentUserProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single();

    if (profileError || !currentUserProfile) {
      return new Response(
        JSON.stringify({ error: '无法获取用户信息' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 权限检查：
    // 1. 用户可以修改自己的密码
    // 2. 管理员和系统管理员可以修改任何用户的密码
    const isModifyingSelf = currentUser.id === requestData.userId;
    const isAdmin = ['admin', 'system_admin'].includes(currentUserProfile.role);

    if (!isModifyingSelf && !isAdmin) {
      return new Response(
        JSON.stringify({ error: '您没有权限修改该用户的密码。只能修改自己的密码或需要管理员权限。' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('开始更新密码，用户ID:', requestData.userId);

    // 更新密码
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      requestData.userId,
      { password: requestData.newPassword }
    );

    if (updateError) {
      console.error('更新密码失败:', updateError);
      return new Response(
        JSON.stringify({ 
          error: '更新密码失败',
          details: updateError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('密码更新成功');

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        message: '密码更新成功',
        data: {
          userId: requestData.userId,
          updated_at: new Date().toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('更新密码异常:', error);
    return new Response(
      JSON.stringify({ 
        error: '更新密码时发生异常',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

