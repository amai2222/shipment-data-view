// supabase/functions/delete-user/index.ts
// 用于安全删除用户的 Edge Function

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
  hardDelete?: boolean; // true: 完全删除, false: 软删除（设置 is_active = false）
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
    const requestData: DeleteUserRequest = await req.json();

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

    // 防止删除自己
    if (currentUser.id === requestData.userId) {
      return new Response(
        JSON.stringify({ error: '不能删除自己的账号' }),
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
    // 1. system_admin 可以硬删除和软删除
    // 2. admin 只能软删除
    const isSystemAdmin = currentUserProfile.role === 'system_admin';
    const isAdmin = currentUserProfile.role === 'admin';

    if (!isSystemAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ error: '您没有权限删除用户。需要管理员权限。' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 如果要硬删除，必须是 system_admin
    if (requestData.hardDelete && !isSystemAdmin) {
      return new Response(
        JSON.stringify({ error: '只有系统管理员可以永久删除用户。普通管理员只能停用用户。' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取要删除的用户信息
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, role')
      .eq('id', requestData.userId)
      .single();

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: '找不到要删除的用户' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('开始删除用户，用户ID:', requestData.userId, '硬删除:', requestData.hardDelete);

    if (requestData.hardDelete) {
      // 硬删除：完全删除用户
      // 先删除 profiles 表中的记录（会触发级联删除相关数据）
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', requestData.userId);

      if (deleteProfileError) {
        console.error('删除用户档案失败:', deleteProfileError);
        return new Response(
          JSON.stringify({ 
            error: '删除用户档案失败',
            details: deleteProfileError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 再删除 auth 用户
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        requestData.userId
      );

      if (deleteAuthError) {
        console.error('删除认证用户失败:', deleteAuthError);
        return new Response(
          JSON.stringify({ 
            error: '删除认证用户失败',
            details: deleteAuthError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('用户已永久删除');

      return new Response(
        JSON.stringify({
          success: true,
          message: '用户已永久删除',
          data: {
            userId: requestData.userId,
            email: targetUser.email,
            deleted_at: new Date().toISOString(),
            type: 'hard_delete'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } else {
      // 软删除：只设置 is_active = false
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestData.userId)
        .select()
        .single();

      if (updateError) {
        console.error('停用用户失败:', updateError);
        return new Response(
          JSON.stringify({ 
            error: '停用用户失败',
            details: updateError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('用户已停用');

      return new Response(
        JSON.stringify({
          success: true,
          message: '用户已停用',
          data: {
            userId: requestData.userId,
            email: targetUser.email,
            is_active: false,
            updated_at: updateData.updated_at,
            type: 'soft_delete'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error: any) {
    console.error('删除用户异常:', error);
    return new Response(
      JSON.stringify({ 
        error: '删除用户时发生异常',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

