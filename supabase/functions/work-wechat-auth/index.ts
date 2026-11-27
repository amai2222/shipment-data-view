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
  phone?: string;
  avatar?: string;
  position?: string;
  gender?: string;
  status?: number;
  alias?: string;  // 企业微信昵称
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

    // 企微成员状态校验：1=已激活，2=已禁用，4=未激活，5=退出企业
    // 离职/禁用成员即使拿到旧 code 也不允许登录
    if (userDetail.status !== undefined && userDetail.status !== 1) {
      console.warn(`企微成员状态异常: ${userData.UserId} status=${userDetail.status}`);
      throw new Error('该企业微信账号已禁用或已离职，请联系管理员');
    }

    // 提取手机号（企业微信API可能返回mobile或phone字段）
    const phoneNumber = userDetail.mobile || userDetail.phone || '';
    const wechatName = userDetail.alias || userDetail.name || '';
    console.log('提取的手机号:', phoneNumber);
    console.log('提取的企业微信昵称:', wechatName);

    // ==================== 使用 profiles 表查找用户的优化逻辑 ====================

    // 邮箱统一小写：GoTrue 的 auth.users.email 为小写存储，generateLink 按精确匹配查用户
    // 若传大小写混合（如企微 userid "LaoShen" 拼出的邮箱）会查不到用户导致 500
    const email = (userDetail.email || `${userData.UserId}@company.local`).toLowerCase();

    // 4. 先查 profiles 决定复用还是创建（幂等，避开 GoTrue 错误文案变更）
    console.log(`处理用户邮箱: ${email}`);
    console.log(`企业微信用户ID: ${userData.UserId}`);
    let authUserId: string;
    let isNewUser = false;

    // 4. 先查 profiles：已存在用户直接复用，避免依赖会变化的 GoTrue 错误文案
    //    （历史上因 "already been registered" 文案变更为 "User already registered" 导致登录 500）
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active')
      .ilike('email', email)
      .maybeSingle();

    if (lookupError) {
      console.error('查询 profiles 失败:', lookupError);
      throw new Error(`查询用户档案失败: ${lookupError.message}`);
    }

    if (existingProfile) {
      // 禁用校验：管理员停用的账号不允许通过企微登录绕过
      // （原逻辑在 upsert 里强制 is_active:true，等于每次登录自动解禁）
      if (existingProfile.is_active === false) {
        console.warn(`已禁用用户尝试登录: ${email}`);
        throw new Error('账号已被禁用，请联系管理员');
      }
      authUserId = existingProfile.id;
      isNewUser = false;
      console.log(`用户 ${email} 已存在，复用档案 ID: ${authUserId}`);
    } else {
      // 用户不存在，创建
      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: Math.random().toString(36).slice(-12),
        user_metadata: {
          full_name: userDetail.name,
          avatar_url: userDetail.avatar,
          work_wechat_userid: userData.UserId,
          phone: phoneNumber,
          work_wechat_name: wechatName,
          department: userDetail.department
        }
      });

      if (createAuthError) {
        console.error('创建用户时发生错误:', createAuthError);
        throw createAuthError;
      }
      authUserId = newAuthUser.user.id;
      isNewUser = true;
      console.log(`新用户 ${email} 创建成功: ${authUserId}`);
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
        phone: phoneNumber,
        work_wechat_name: wechatName,
        role: isNewUser ? 'viewer' : undefined,
        // 不覆盖 is_active：新用户由数据库默认值(true)激活，已存在用户保持管理员设置
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

    // 6. 签发登录会话
    // 说明：Supabase 项目暂停恢复后，GoTrue 的 admin.generateLink(recovery/magiclink)
    //       对所有用户全局返回 500（unexpected_failure），已实测确认。
    //       改用「admin 重置密码 + signInWithPassword」直接签发 session，绕过 generateLink。
    //       已实测 service_role 可同时完成 updateUserById 与 token?grant_type=password。
    const loginPassword = `Wx@${userData.UserId}_${Date.now()}`;
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password: loginPassword
    });
    if (resetError) {
      console.error('重置登录密码失败:', resetError);
      throw new Error(`重置登录密码失败: ${resetError.message}`);
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email,
      password: loginPassword
    });
    if (signInError || !signInData?.session) {
      console.error('密码登录失败:', signInError);
      throw new Error(`签发会话失败: ${signInError?.message || '未返回 session'}`);
    }

    console.log('企业微信认证成功，会话已签发');

    return new Response(JSON.stringify({
      success: true,
      user: profile,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
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
