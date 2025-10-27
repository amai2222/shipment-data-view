// supabase/functions/create-user/index.ts
// 用于安全创建用户的 Edge Function

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone?: string;
  work_wechat_userid?: string;
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

    // 验证当前用户是否有创建用户的权限
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

    // 检查当前用户的角色权限
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

    // 只有管理员和系统管理员可以创建用户
    const allowedRoles = ['admin', 'system_admin'];
    if (!allowedRoles.includes(currentUserProfile.role)) {
      return new Response(
        JSON.stringify({ error: '您没有权限创建用户。只有管理员和系统管理员可以创建用户。' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 解析请求体
    const requestData: CreateUserRequest = await req.json();

    // 验证必填字段
    if (!requestData.email || !requestData.password || !requestData.full_name || !requestData.role) {
      return new Response(
        JSON.stringify({ error: '缺少必填字段：email、password、full_name、role' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 验证邮箱格式
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

    // 验证密码强度
    if (requestData.password.length < 6) {
      return new Response(
        JSON.stringify({ error: '密码长度至少为 6 位' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 验证角色
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

    // 检查邮箱是否已存在
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', requestData.email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: '该邮箱已被注册' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('开始创建用户:', requestData.email);

    // 创建认证用户
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        full_name: requestData.full_name,
        role: requestData.role
      }
    });

    if (createAuthError) {
      console.error('创建认证用户失败:', createAuthError);
      return new Response(
        JSON.stringify({ 
          error: '创建认证用户失败',
          details: createAuthError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('认证用户创建成功，ID:', authData.user.id);

    // 创建用户档案
    const { data: profileData, error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: requestData.email,
        full_name: requestData.full_name,
        role: requestData.role,
        phone: requestData.phone || null,
        work_wechat_userid: requestData.work_wechat_userid || null,
        is_active: true
      })
      .select()
      .single();

    if (createProfileError) {
      console.error('创建用户档案失败:', createProfileError);
      
      // 如果档案创建失败，删除已创建的认证用户
      console.log('正在回滚认证用户...');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ 
          error: '创建用户档案失败',
          details: createProfileError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('用户创建完成:', profileData);

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        message: '用户创建成功',
        data: {
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          role: profileData.role,
          is_active: profileData.is_active,
          created_at: profileData.created_at
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('创建用户异常:', error);
    return new Response(
      JSON.stringify({ 
        error: '创建用户时发生异常',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

