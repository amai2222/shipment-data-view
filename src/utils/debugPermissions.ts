// 权限调试工具
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_PERMISSIONS } from '@/config/permissions';

export async function debugUserPermissions(userId: string) {
  console.log('=== 权限调试信息 ===');
  
  // 1. 获取用户基本信息
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  console.log('用户信息:', profile);
  
  // 2. 获取用户特定权限
  const { data: userPerms } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId)
    .is('project_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  console.log('用户特定权限:', userPerms);
  
  // 3. 获取角色模板权限
  const { data: roleTemplate } = await supabase
    .from('role_permission_templates')
    .select('*')
    .eq('role', profile?.role)
    .single();
  
  console.log('角色模板权限:', roleTemplate);
  
  // 4. 显示默认权限
  const defaultPerms = DEFAULT_PERMISSIONS[profile?.role as keyof typeof DEFAULT_PERMISSIONS];
  console.log('默认权限配置:', defaultPerms);
  
  // 5. 检查数据维护权限
  const hasDataMaintenance = defaultPerms?.menu_permissions?.includes('data_maintenance.waybill');
  console.log('是否有数据维护权限:', hasDataMaintenance);
  
  return {
    profile,
    userPerms,
    roleTemplate,
    defaultPerms,
    hasDataMaintenance
  };
}
