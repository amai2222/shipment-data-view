// 用户删除函数 V2 - 支持智能数据转移
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 创建 Supabase 管理客户端
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 获取请求数据
    const requestData = await req.json()
    const { userId, hardDelete = false, transferToUserId } = requestData

    if (!userId) {
      return new Response(
        JSON.stringify({ error: '缺少 userId 参数' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('删除用户请求:', { userId, hardDelete, transferToUserId })

    // 检查目标用户是否存在
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (targetUserError || !targetUser) {
      return new Response(
        JSON.stringify({ error: '找不到要删除的用户' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (hardDelete) {
      // 硬删除：需要先处理关联数据
      let adminId = transferToUserId

      // 如果没有指定转移目标，自动查找管理员
      if (!adminId) {
        const { data: adminUser } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', 'admin@example.com')
          .single()
        
        adminId = adminUser?.id
      }

      if (!adminId) {
        return new Response(
          JSON.stringify({ error: '找不到数据接管的管理员账户' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('开始转移用户数据到管理员:', adminId)

      // 转移所有关联数据（使用智能查询）
      const tables = [
        { table: 'drivers', column: 'user_id' },
        { table: 'location_projects', column: 'user_id' },
        { table: 'logistics_records', column: 'created_by_user_id' },
        { table: 'logistics_records', column: 'user_id' },
        { table: 'logistics_partner_costs', column: 'user_id' },
        { table: 'payment_requests', column: 'created_by' },
        { table: 'payment_requests', column: 'user_id' },
        { table: 'invoice_requests', column: 'created_by' },
        { table: 'invoice_requests', column: 'approved_by' },
        { table: 'invoice_requests', column: 'applicant_id' },
        { table: 'invoice_requests', column: 'voided_by' },
        { table: 'scale_records', column: 'user_id' },
        { table: 'scale_records', column: 'created_by_user_id' },
        { table: 'notifications', column: 'user_id' },
        { table: 'operation_logs', column: 'operated_by' },
      ]

      // 转移数据
      for (const { table, column } of tables) {
        const { error: updateError } = await supabaseAdmin
          .from(table)
          .update({ [column]: adminId })
          .eq(column, userId)

        if (updateError && !updateError.message.includes('No rows')) {
          console.error(`转移 ${table}.${column} 失败:`, updateError)
        }
      }

      // 删除有唯一约束的表
      await supabaseAdmin.from('user_permissions').delete().eq('user_id', userId)
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)

      console.log('数据转移完成，开始删除用户')

      // 删除 profiles
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (deleteProfileError) {
        console.error('删除用户档案失败:', deleteProfileError)
        return new Response(
          JSON.stringify({ 
            error: '删除用户档案失败',
            details: deleteProfileError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // 删除 auth 用户
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteAuthError) {
        console.error('删除认证用户失败:', deleteAuthError)
        return new Response(
          JSON.stringify({ 
            error: '删除认证用户失败',
            details: deleteAuthError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('用户已永久删除')

      return new Response(
        JSON.stringify({
          success: true,
          message: '用户已永久删除，关联数据已转移给管理员',
          data: {
            userId: userId,
            email: targetUser.email,
            transferredTo: adminId,
            deleted_at: new Date().toISOString(),
            type: 'hard_delete'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      // 软删除：仅停用用户
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: false })
        .eq('id', userId)

      if (updateError) {
        return new Response(
          JSON.stringify({ 
            error: '停用用户失败',
            details: updateError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: '用户已停用',
          data: {
            userId: userId,
            email: targetUser.email,
            type: 'soft_delete'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('删除用户失败:', error)
    return new Response(
      JSON.stringify({ 
        error: (error instanceof Error ? error.message : String(error)) || '删除用户失败',
        details: error 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

