import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const workWechatSecret = Deno.env.get('WORK_WECHAT_SECRET')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.log('准备获取企业微信令牌，参数:', { corpId, secretLength: workWechatSecret?.length });
    
    const tokenResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${workWechatSecret}`
    );
    const tokenData: WorkWechatTokenResponse = await tokenResponse.json();
    
    console.log('企业微信令牌响应:', tokenData);
    
    if (!tokenData.access_token) {
      console.error('获取企业微信令牌失败:', tokenData);
      throw new Error(`获取企业微信访问令牌失败: ${JSON.stringify(tokenData)}`);
    }

    console.log('企业微信令牌获取成功');

    // 2. 通过code获取用户信息
    const userResponse = await fetch(
      `http://129.226.191.86:3000/cgi-bin/user/getuserinfo?access_token=${tokenData.access_token}&code=${code}`
    );
    const userData = await userResponse.json();
    
    console.log('企业微信用户信息响应:', userData);
    
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

    // 4. 检查用户是否已存在
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('work_wechat_userid', userData.UserId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('查询用户档案失败:', profileError);
      throw new Error('查询用户档案失败');
    }

    let profile;
    
    if (existingProfile) {
      // 用户已存在，更新信息
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: userDetail.name,
          avatar_url: userDetail.avatar,
          work_wechat_department: userDetail.department,
          updated_at: new Date().toISOString()
        })
        .eq('work_wechat_userid', userData.UserId)
        .select()
        .single();

      if (updateError) {
        console.error('更新用户档案失败:', updateError);
        throw new Error('更新用户档案失败');
      }
      
      profile = updatedProfile;
      console.log('用户档案更新成功');
    } else {
      // 新用户，创建档案
      const email = userDetail.email || `${userData.UserId}@company.local`;
      
      // 首先创建认证用户
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: userDetail.name,
          work_wechat_userid: userData.UserId
        }
      });

      if (authError) {
        console.error('创建认证用户失败:', authError);
        throw new Error('创建认证用户失败');
      }

      // 创建用户档案
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id,
          email,
          full_name: userDetail.name,
          work_wechat_userid: userData.UserId,
          avatar_url: userDetail.avatar,
          work_wechat_department: userDetail.department,
          role: 'viewer', // 默认角色
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('创建用户档案失败:', insertError);
        throw new Error('创建用户档案失败');
      }
      
      profile = newProfile;
      console.log('新用户档案创建成功');
    }

    // 5. 生成会话令牌
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/v1/callback`
      }
    });

    if (sessionError) {
      console.error('生成会话失败:', sessionError);
      throw new Error('生成会话失败');
    }

    console.log('企业微信认证成功');

    return new Response(JSON.stringify({
      success: true,
      user: profile,
      auth_url: sessionData.properties?.action_link
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('企业微信认证错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '企业微信认证失败' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
