// 文件路径: supabase/functions/work-wechat-approval/index.ts
// 完整代码，可以直接替换

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 从环境变量中获取配置
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!; // 需要用到 anon key 来创建用户客户端
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const workWechatSecret = Deno.env.get('WORK_WECHAT_SECRET')!;

/**
 * 主服务函数，处理所有进入的请求
 */
serve(async (req) => {
  // 预检请求（CORS）
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =================================================================================
    // 核心安全逻辑：验证用户身份并从数据库获取真实的企业微信ID
    // =================================================================================

    // 1. 基于请求头中的 Authorization 创建一个代表当前登录用户的 Supabase 客户端
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. 获取当前登录的用户信息
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("用户认证失败:", userError);
      return new Response(JSON.stringify({ error: '用户未认证，请重新登录' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`请求来自已认证用户: ${user.id} (${user.email})`);

    // 3. 从 'profiles' 表中安全地获取该用户的企业微信 ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('work_wechat_userid')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.work_wechat_userid) {
      console.error(`无法获取用户 ${user.id} 的企业微信ID:`, profileError);
      // 这个错误信息会直接显示给前端，是解决问题的关键
      throw new Error('无法获取您的企业微信用户ID。请确保您的账户已在系统中正确绑定企业微信。');
    }

    // 这是从数据库中获取到的、100%可信的企业微信用户ID
    const verified_applicant_userid = profile.work_wechat_userid;
    console.log(`成功从数据库获取到用户的企业微信ID: ${verified_applicant_userid}`);

    // =================================================================================
    // 请求处理逻辑
    // =================================================================================
    
    const body = await req.json();
    const action = body.action;

    // 强制使用从数据库中验证过的ID，覆盖掉前端可能传来的任何值
    body.applicant_userid = verified_applicant_userid;

    if (action === 'submit') {
      // 提交审批申请
      // 注意：传入的是 supabaseClient，它代表了当前用户的权限
      return await submitApproval(body, supabaseClient);
    } else if (action === 'callback') {
      // 处理审批回调，这部分是企业微信服务器调用的，没有用户上下文，需要用管理员权限
      const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);
      return await handleApprovalCallback(body, supabaseAdminClient);
    } else {
      throw new Error('无效的操作');
    }

  } catch (error) {
    console.error('企业微信审批流程发生顶级错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '操作失败，发生未知错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * 提交审批申请到企业微信
 * @param body - 请求体，其中 applicant_userid 是经过后端验证的
 * @param supabase - 代表当前用户的Supabase客户端实例
 */
async function submitApproval(body: any, supabase: SupabaseClient) {
  const { 
    payment_request_id, 
    applicant_userid, // 这个ID现在是安全可信的
    approver_userid, 
    amount, 
    description,
    corpId,
    agentId 
  } = body;

  console.log('正在提交企业微信审批:', { payment_request_id, applicant_userid, approver_userid, amount, description });

  // 1. 获取访问令牌
  const tokenResponse = await fetch(
    `http://129.226.191.86:3000/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${workWechatSecret}`
  );
  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    throw new Error('获取企业微信访问令牌失败');
  }

  // 2. 构造审批申请数据
  const approvalData = {
    creator_userid: applicant_userid, // 使用安全可靠的ID
    template_id: "3TkaZ8E3kYYUJDKYPJ1bN4ZZzYuKASv9P", // 需要在企业微信管理后台配置审批模板
    use_template_approver: 0,
    approver: [
      {
        attr: 2,
        userid: [approver_userid]
      }
    ],
    apply_data: {
      contents: [
        {
          control: "Text",
          id: "Text-1640779368957",
          title: [{ text: "付款申请", lang: "zh_CN" }],
          value: { text: description }
        },
        {
          control: "Money", 
          id: "Money-1640779380785",
          title: [{ text: "付款金额", lang: "zh_CN" }],
          value: { new_money: Math.round(amount * 100) } // 转换为分，并确保是整数
        }
      ]
    }
  };

  // 3. 提交审批申请
  const approvalResponse = await fetch(
    `http://129.226.191.86:3000/cgi-bin/oa/applyevent?access_token=${tokenData.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(approvalData)
    }
  );

  const approvalResult = await approvalResponse.json();
  
  if (approvalResult.errcode !== 0) {
    console.error('提交审批至企业微信失败:', approvalResult);
    throw new Error(`提交审批失败: ${approvalResult.errmsg}`);
  }

  // 4. 更新系统内的付款申请状态
  const { error: updateError } = await supabase
    .from('payment_requests')
    .update({
      work_wechat_sp_no: approvalResult.sp_no,
      status: 'pending_approval',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment_request_id);

  if (updateError) {
    console.error('更新付款申请状态失败:', updateError);
    throw new Error('更新系统内付款申请状态失败');
  }

  console.log('企业微信审批提交成功，审批号:', approvalResult.sp_no);

  return new Response(JSON.stringify({
    success: true,
    sp_no: approvalResult.sp_no,
    message: '审批申请已成功提交至企业微信'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * 处理来自企业微信的审批结果回调
 * @param body - 企业微信回调的请求体
 * @param supabaseAdmin - 拥有管理员权限的Supabase客户端实例
 */
async function handleApprovalCallback(body: any, supabaseAdmin: SupabaseClient) {
  console.log('收到企业微信审批回调:', body);

  const { sp_no, approve_status } = body;
  
  let newStatus: 'approved' | 'rejected' | 'pending_approval' = 'pending_approval';
  if (approve_status === 1) { // 审批通过
    newStatus = 'approved';
  } else if (approve_status === 2) { // 审批驳回
    newStatus = 'rejected';
  }
  // 其他状态（如撤销等）暂时不改变系统内状态

  const { error: updateError } = await supabaseAdmin
    .from('payment_requests')
    .update({
      status: newStatus,
      approval_result: body, // 保存完整的企业微信回调数据
      updated_at: new Date().toISOString()
    })
    .eq('work_wechat_sp_no', sp_no);

  if (updateError) {
    console.error('处理审批回调，更新数据库失败:', updateError);
    throw new Error('更新审批结果失败');
  }

  console.log('审批回调处理成功:', { sp_no, approve_status, newStatus });

  return new Response(JSON.stringify({
    success: true,
    message: '审批结果处理成功'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
