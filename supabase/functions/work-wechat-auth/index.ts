import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const workWechatSecret = Deno.env.get('WORK_WECHAT_SECRET')!;

// 使用 Service Key 初始化 Supabase Admin 客户端
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface WorkWechatUserInfo {
  UserId: string;
  name: string;
  department: number[];
  email?: string;
  mobile?: string;
  avatar?: string;
}

interface WorkWechatTokenResponse {
  access_token: string;
  expires_in: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, corpId, agentId } = await req.json();
    console.log('企业微信认证请求:', { code, corpId, agentId });

    // 1. 获取企业微信访问令牌
    const tokenResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${workWechatSecret}`
    );
    const tokenData: WorkWechatTokenResponse = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(`获取企业微信访问令牌失败: ${JSON.stringify(tokenData)}`);
    }
    console.log('企业微信令牌获取成功');

    // 2. 获取用户 UserId
    const userResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`
    );
    const userData = await userResponse.json();
    if (!userData.UserId) {
      throw new Error(`获取用户信息失败: ${JSON.stringify(userData)}`);
    }
    console.log('获取用户ID成功:', userData.UserId);

    // 3. 获取用户详细信息
    const userDetailResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/user/get?access_token=${tokenData.access_token}&userid=${userData.UserId}`
    );
    const userDetail: WorkWechatUserInfo = await userDetailResponse.json();
    console.log('用户详细信息:', userDetail);

    // ==================== 使用 profiles 表查找用户的优化逻辑 ====================

    const email = userDetail.email || `${userData.UserId}@company.local`;

    // 4. 先尝试创建用户，如果失败则从 profiles 表查找现有用户
    console.log(`处理用户邮箱: ${email}`);
    console.log(`企业微信用户ID: ${userData.UserId}`);
    let authUserId: string;
    let isNewUser = false;

    try {
      // 直接尝试创建用户
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: Math.random().toString(36).slice(-12),
        user_metadata: {
          full_name: userDetail.name,
          avatar_url: userDetail.avatar,
          work_wechat_userid: userData.UserId
        }
      });

      if (createAuthError) {
        // 如果创建失败且错误是用户已存在，这是正常情况
        if (createAuthError.message && createAuthError.message.includes('already been registered')) {
          console.log(`用户 ${email} 已存在，从 profiles 表查找用户ID`);
          
          // 从 profiles 表查找用户ID
          const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();
          
          if (profileError || !profile) {
            console.error('无法从 profiles 表找到用户:', profileError);
            throw new Error(`用户已存在但无法获取用户档案: ${profileError?.message || '未找到档案'}`);
          }
          
          authUserId = profile.id;
          isNewUser = false;
          console.log(`从 profiles 表找到用户ID: ${authUserId}`);
        } else {
          // 其他创建错误
          console.error('创建用户时发生未知错误:', createAuthError);
          throw createAuthError;
        }
      } else {
        // 用户创建成功
        authUserId = newAuthUser.user.id;
        isNewUser = true;
        console.log(`新用户 ${email} 创建成功: ${authUserId}`);
      }
    } catch (error) {
      console.error('处理用户时发生错误:', error);
      throw error;
    }

    // 5. 使用 upsert 来创建或更新用户的公开信息 (profiles 表)
    const { data: profile, error: upsertProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUserId,
        email: email,
        full_name: userDetail.name,
        avatar_url: userDetail.avatar,
        work_wechat_userid: userData.UserId,
        work_wechat_department: userDetail.department,
        role: isNewUser ? 'viewer' : undefined,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (upsertProfileError) {
      console.error('Upsert 用户档案失败:', upsertProfileError);
      throw new Error('创建或更新用户档案失败');
    }
    
    console.log('用户档案同步成功:', profile);

    // ==================== 最终修复逻辑结束 ====================

    // 6. 直接生成访问令牌，避免重定向
    const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email
    });

    if (tokenError) {
      console.error('生成令牌失败:', tokenError);
      throw new Error('生成令牌失败');
    }

    console.log('企业微信认证成功');

    return new Response(JSON.stringify({
      success: true,
      user: profile,
      auth_url: tokenData.properties.action_link,
      access_token: tokenData.session?.access_token,
      refresh_token: tokenData.session?.refresh_token
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('企业微信认证完整错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '企业微信认证失败',
      error_details: error,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
