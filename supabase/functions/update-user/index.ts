// supabase/functions/update-user/index.ts
// 用于安全更新用户信息的 Edge Function

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateUserRequest {
  userId: string;
  email?: string;
  full_name?: string;
  role?: string;
  phone?: string;
  work_wechat_userid?: string;
  is_active?: boolean;
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
    const requestData: UpdateUserRequest = await req.json();

    // 验证必填字段
    if (!requestData.userId) {
      return new Response(
        JSON.stringify({ error: '缺少必填字段：userId' }),
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
    // 1. 用户可以修改自己的基本信息（除了 role 和 is_active）
    // 2. 管理员和系统管理员可以修改任何用户的所有信息
    const isModifyingSelf = currentUser.id === requestData.userId;
    const isAdmin = ['admin', 'system_admin'].includes(currentUserProfile.role);

    // 如果不是管理员，且修改的是敏感字段
    if (!isAdmin) {
      if (requestData.role || requestData.is_active !== undefined) {
        return new Response(
          JSON.stringify({ error: '您没有权限修改用户角色或状态。需要管理员权限。' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      if (!isModifyingSelf) {
        return new Response(
          JSON.stringify({ error: '您没有权限修改其他用户的信息。只能修改自己的信息。' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // 验证邮箱格式（如果提供了）
    if (requestData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(requestData.email)) {
        return new Response(
          JSON.stringify({ error: '邮箱格式不正确' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 检查邮箱是否已被其他用户使用
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', requestData.email)
        .neq('id', requestData.userId)
        .maybeSingle();

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: '该邮箱已被其他用户使用' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // 验证角色（如果提供了）
    if (requestData.role) {
      const validRoles = ['admin', 'system_admin', 'business', 'finance', 'operator', 'viewer'];
      if (!validRoles.includes(requestData.role)) {
        return new Response(
          JSON.stringify({ error: `无效的角色。有效角色：${validRoles.join(', ')}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    console.log('开始更新用户信息，用户ID:', requestData.userId);

    // 更新邮箱（如果提供了）
    if (requestData.email) {
      const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(
        requestData.userId,
        { email: requestData.email }
      );

      if (emailError) {
        console.error('更新邮箱失败:', emailError);
        return new Response(
          JSON.stringify({ 
            error: '更新邮箱失败',
            details: emailError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // 准备更新 profiles 表的数据
    const profileUpdates: any = {
      updated_at: new Date().toISOString()
    };

    if (requestData.email) profileUpdates.email = requestData.email;
    if (requestData.full_name) profileUpdates.full_name = requestData.full_name;
    if (requestData.role) profileUpdates.role = requestData.role;
    if (requestData.phone !== undefined) profileUpdates.phone = requestData.phone;
    if (requestData.work_wechat_userid !== undefined) profileUpdates.work_wechat_userid = requestData.work_wechat_userid;
    if (requestData.is_active !== undefined) profileUpdates.is_active = requestData.is_active;

    // 更新用户档案
    const { data: profileData, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', requestData.userId)
      .select()
      .single();

    if (updateError) {
      console.error('更新用户档案失败:', updateError);
      return new Response(
        JSON.stringify({ 
          error: '更新用户档案失败',
          details: updateError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('用户信息更新成功');

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        message: '用户信息更新成功',
        data: {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          role: profileData.role,
          phone: profileData.phone,
          work_wechat_userid: profileData.work_wechat_userid,
          is_active: profileData.is_active,
          updated_at: profileData.updated_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('更新用户信息异常:', error);
    return new Response(
      JSON.stringify({ 
        error: '更新用户信息时发生异常',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

