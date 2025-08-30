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

    // ==================== 优化的用户处理逻辑 ====================

    const email = userDetail.email || `${userData.UserId}@company.local`;

    // 4. 优化用户处理逻辑：先查找现有用户，然后决定是否创建
    console.log(`处理用户邮箱: ${email}`);
    console.log(`企业微信用户ID: ${userData.UserId}`);
    let authUserId: string;
    let isNewUser = false;

    try {
      // 首先尝试通过邮箱查找现有用户
      console.log('尝试查找现有用户...');
      const { data: existingUserId, error: rpcError } = await supabaseAdmin.rpc(
        'get_user_id_by_email', 
        { p_email: email }
      );
      
      if (rpcError) {
        console.error('查找用户时发生错误:', rpcError);
        throw new Error(`查找用户失败: ${rpcError.message}`);
      }

      if (existingUserId) {
        // 用户已存在
        console.log(`找到现有用户: ${existingUserId}`);
        authUserId = existingUserId;
        isNewUser = false;
      } else {
        // 用户不存在，创建新用户
        console.log('用户不存在，创建新用户...');
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
          console.error('创建用户时发生错误:', createAuthError);
          throw new Error(`用户创建失败: ${createAuthError.message}`);
        }

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
