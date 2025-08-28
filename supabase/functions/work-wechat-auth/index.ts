import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

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
    console.log('准备获取企业微信令牌...');
    
    const tokenResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${workWechatSecret}`
    );
    const tokenData: WorkWechatTokenResponse = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('获取企业微信令牌失败:', tokenData);
      throw new Error(`获取企业微信访问令牌失败: ${JSON.stringify(tokenData)}`);
    }

    console.log('企业微信令牌获取成功');

    // 2. 通过code获取用户 UserId
    const userResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`
    );
    const userData = await userResponse.json();
    
    if (!userData.UserId) {
      console.error('获取用户信息失败:', userData);
      throw new Error(`获取用户信息失败: ${JSON.stringify(userData)}`);
    }

    console.log('获取用户ID成功:', userData.UserId);

    // 3. 获取用户详细信息
    const userDetailResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/user/get?access_token=${tokenData.access_token}&userid=${userData.UserId}`
    );
    const userDetail: WorkWechatUserInfo = await userDetailResponse.json();
    
    console.log('用户详细信息:', userDetail);

    // ==================== 核心修改逻辑开始 ====================

    // 确保用户有邮箱，如果没有则使用企业微信ID创建一个占位邮箱
    const email = userDetail.email || `${userData.UserId}@company.local`;
    let authUserId: string;
    let isNewUser = false;

    // 4. 首先通过邮箱检查认证用户 (auth.users) 是否存在
    const { data: existingAuthUser, error: getAuthUserError } = await supabaseAdmin.auth.admin.getUserByEmail(email);

    if (getAuthUserError && getAuthUserError.name !== 'UserNotFoundError') {
      console.error('通过邮箱查找认证用户失败:', getAuthUserError);
      throw getAuthUserError; // 抛出未知错误
    }

    if (existingAuthUser?.user) {
      // 4a. 如果认证用户已存在，直接使用其 ID
      console.log(`认证用户 ${email} 已存在.`);
      authUserId = existingAuthUser.user.id;
    } else {
      // 4b. 如果认证用户不存在，则创建新的认证用户
      console.log(`认证用户 ${email} 不存在，准备创建...`);
      isNewUser = true;
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true, // 邮箱来自可信源，直接确认为已验证
        password: Math.random().toString(36).slice(-12), // 设置一个安全的随机密码
        user_metadata: {
          full_name: userDetail.name,
          avatar_url: userDetail.avatar,
          work_wechat_userid: userData.UserId // 在元数据中也存一份企微ID
        }
      });

      if (createAuthError) {
        console.error('创建认证用户失败:', createAuthError);
        // 直接抛出原始的 AuthApiError，这样前端可以获得更详细的错误信息
        throw createAuthError;
      }
      
      authUserId = newAuthUser.user.id;
      console.log(`新认证用户 ${email} 创建成功.`);
    }

    // 5. 使用 upsert 来创建或更新用户的公开信息 (profiles 表)
    // 无论用户是新是旧，都确保 profiles 表中的数据是最新的
    const { data: profile, error: upsertProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUserId, // 关键：使用 auth user 的 ID 作为主键
        email: email,
        full_name: userDetail.name,
        avatar_url: userDetail.avatar,
        work_wechat_userid: userData.UserId,
        work_wechat_department: userDetail.department,
        role: isNewUser ? 'viewer' : undefined, // 只有新用户才设置默认角色
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id', // 如果 ID 冲突，则执行更新
      })
      .select()
      .single();

    if (upsertProfileError) {
      console.error('Upsert 用户档案失败:', upsertProfileError);
      throw new Error('创建或更新用户档案失败');
    }
    
    console.log('用户档案同步成功:', profile);

    // ==================== 核心修改逻辑结束 ====================

    // 6. 为用户生成会话令牌 (Magic Link)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    });

    if (sessionError) {
      console.error('生成会话失败:', sessionError);
      throw new Error('生成会话失败');
    }

    console.log('企业微信认证成功');

    return new Response(JSON.stringify({
      success: true,
      user: profile,
      ...sessionData.properties,
      session: sessionData.session,
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
