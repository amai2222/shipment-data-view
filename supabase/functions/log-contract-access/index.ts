import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { contract_id, action, details } = await req.json()

    if (!contract_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 获取用户信息
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 获取客户端IP地址
    const ip_address = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown'

    // 获取User-Agent
    const user_agent = req.headers.get('user-agent') || 'unknown'

    // 记录访问日志
    const { error: logError } = await supabaseClient
      .from('contract_access_logs')
      .insert({
        contract_id,
        user_id: user.id,
        action,
        details: details || {},
        ip_address,
        user_agent
      })

    if (logError) {
      console.error('Error logging contract access:', logError)
      return new Response(
        JSON.stringify({ error: 'Failed to log access' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 更新合同的访问统计
    if (action === 'view') {
      const { error: updateError } = await supabaseClient
        .from('contracts')
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: supabaseClient.sql`access_count + 1`
        })
        .eq('id', contract_id)

      if (updateError) {
        console.error('Error updating contract access count:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in log-contract-access function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
