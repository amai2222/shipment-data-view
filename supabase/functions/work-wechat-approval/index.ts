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

interface ApprovalRequest {
  payment_request_id: string;
  applicant_userid: string;
  approver_userid: string;
  amount: number;
  description: string;
  apply_data: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'submit') {
      // 提交审批申请
      return await submitApproval(req);
    } else if (action === 'callback') {
      // 处理审批回调
      return await handleApprovalCallback(req);
    } else {
      throw new Error('无效的操作');
    }

  } catch (error) {
    console.error('企业微信审批错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message || '操作失败' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function submitApproval(req: Request) {
  const { 
    payment_request_id, 
    applicant_userid, 
    approver_userid, 
    amount, 
    description,
    corpId,
    agentId 
  }: ApprovalRequest & { corpId: string; agentId: string } = await req.json();

  console.log('提交企业微信审批:', { payment_request_id, amount, description });

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
    creator_userid: applicant_userid,
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
          title: [
            {
              text: "付款申请",
              lang: "zh_CN"
            }
          ],
          value: {
            text: description
          }
        },
        {
          control: "Money", 
          id: "Money-1640779380785",
          title: [
            {
              text: "付款金额",
              lang: "zh_CN"
            }
          ],
          value: {
            new_money: amount * 100 // 转换为分
          }
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
    console.error('提交审批失败:', approvalResult);
    throw new Error(`提交审批失败: ${approvalResult.errmsg}`);
  }

  // 4. 更新付款申请状态
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
    throw new Error('更新付款申请状态失败');
  }

  console.log('企业微信审批提交成功:', approvalResult.sp_no);

  return new Response(JSON.stringify({
    success: true,
    sp_no: approvalResult.sp_no,
    message: '审批申请已提交'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleApprovalCallback(req: Request) {
  // 处理企业微信审批结果回调
  const body = await req.text();
  console.log('收到审批回调:', body);

  // 解析XML格式的回调数据
  // 这里需要根据企业微信的回调格式来解析
  // 通常包含审批单号(sp_no)和审批结果(approve_status)
  
  // 简化处理，实际应用中需要完整的XML解析
  const approvalData = JSON.parse(body); // 假设已经解析为JSON
  
  const { sp_no, approve_status } = approvalData;
  
  // 更新付款申请状态
  let newStatus = 'pending_approval';
  if (approve_status === 1) {
    newStatus = 'approved';
  } else if (approve_status === 2) {
    newStatus = 'rejected';
  }

  const { error: updateError } = await supabase
    .from('payment_requests')
    .update({
      status: newStatus,
      approval_result: approvalData,
      updated_at: new Date().toISOString()
    })
    .eq('work_wechat_sp_no', sp_no);

  if (updateError) {
    console.error('更新审批结果失败:', updateError);
    throw new Error('更新审批结果失败');
  }

  console.log('审批结果处理成功:', { sp_no, approve_status, newStatus });

  return new Response(JSON.stringify({
    success: true,
    message: '审批结果处理成功'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
