// 同步前端菜单权限到数据库
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // 获取前端传递的菜单列表
    const { menuKeys, functionKeys } = await req.json()

    if (!menuKeys || !Array.isArray(menuKeys)) {
      return new Response(
        JSON.stringify({ error: '缺少 menuKeys 参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('收到菜单同步请求:', { menuCount: menuKeys.length, functionCount: functionKeys?.length || 0 })

    // 获取当前 admin 角色模板
    const { data: currentTemplate } = await supabaseAdmin
      .from('role_permission_templates')
      .select('menu_permissions, function_permissions')
      .eq('role', 'admin')
      .single()

    const oldMenuCount = currentTemplate?.menu_permissions?.length || 0
    const oldFunctionCount = currentTemplate?.function_permissions?.length || 0

    // 完全替换模式：前端传来的就是完整的菜单列表
    // 这样菜单减少时也能正确同步
    const allMenuPermissions = Array.from(new Set(menuKeys)).sort()
    const allFunctionPermissions = functionKeys 
      ? Array.from(new Set(functionKeys)).sort()
      : (currentTemplate?.function_permissions || [])

    // 更新 admin 角色模板
    const { error: updateError } = await supabaseAdmin
      .from('role_permission_templates')
      .update({
        menu_permissions: allMenuPermissions,
        function_permissions: allFunctionPermissions,
        updated_at: new Date().toISOString()
      })
      .eq('role', 'admin')

    if (updateError) {
      console.error('更新角色模板失败:', updateError)
      return new Response(
        JSON.stringify({ 
          error: '更新角色模板失败',
          details: updateError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newMenuCount = allMenuPermissions.length
    const newFunctionCount = allFunctionPermissions.length
    const addedMenuCount = newMenuCount - oldMenuCount
    const addedFunctionCount = newFunctionCount - oldFunctionCount

    console.log('菜单权限同步成功:', {
      oldMenuCount,
      newMenuCount,
      addedMenuCount,
      oldFunctionCount,
      newFunctionCount,
      addedFunctionCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `admin 权限已自动同步`,
        data: {
          menu: {
            old: oldMenuCount,
            new: newMenuCount,
            added: addedMenuCount
          },
          function: {
            old: oldFunctionCount,
            new: newFunctionCount,
            added: addedFunctionCount
          }
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('同步菜单权限失败:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || '同步菜单权限失败',
        details: error 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

