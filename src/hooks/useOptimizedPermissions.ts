import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

// 优化的权限管理 Hook
export function useOptimizedPermissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, any>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 使用 useMemo 优化计算
  const optimizedUserPermissions = useMemo(() => {
    // 去重逻辑：每个用户每个项目只保留最新的权限记录
    const uniquePermissions = new Map();
    
    userPermissions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(perm => {
        const key = `${perm.user_id}_${perm.project_id || 'global'}`;
        if (!uniquePermissions.has(key)) {
          uniquePermissions.set(key, perm);
        }
      });
    
    return Array.from(uniquePermissions.values());
  }, [userPermissions]);

  // 初始化默认角色权限模板
  const initializeDefaultRoleTemplates = async () => {
    try {
      const { DEFAULT_ROLE_PERMISSIONS } = await import('@/config/permissions');
      
      const templatePromises = Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, permissions]) =>
        supabase
          .from('role_permission_templates')
          .upsert({
            role,
            menu_permissions: permissions.menu_permissions,
            function_permissions: permissions.function_permissions,
            project_permissions: permissions.project_permissions,
            data_permissions: permissions.data_permissions,
            is_system: true,
            name: role === 'admin' ? '系统管理员' : 
                  role === 'finance' ? '财务人员' :
                  role === 'business' ? '业务人员' :
                  role === 'operator' ? '操作员' :
                  role === 'partner' ? '合作伙伴' : '查看者',
            description: `默认${role}角色权限模板`,
            color: role === 'admin' ? 'bg-red-500' : 
                   role === 'finance' ? 'bg-green-500' :
                   role === 'business' ? 'bg-blue-500' :
                   role === 'operator' ? 'bg-yellow-500' :
                   role === 'partner' ? 'bg-purple-500' : 'bg-gray-500'
          }, { onConflict: 'role' })
      );
      
      await Promise.all(templatePromises);
    } catch (error) {
      console.error('初始化默认角色权限模板失败:', error);
    }
  };

  // 批量加载数据
  const loadAllData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // 只在首次加载时初始化默认模板，避免覆盖用户修改
      if (!forceRefresh) {
        await initializeDefaultRoleTemplates();
      }
      
      // 并行加载所有必需的数据
      const [templatesRes, usersRes, permissionsRes] = await Promise.all([
        supabase.from('role_permission_templates').select('role, menu_permissions, function_permissions, project_permissions, data_permissions, name, description').order('updated_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, role, is_active, work_wechat_userid, work_wechat_name, phone'),
        supabase.from('user_permissions').select('id, user_id, project_id, menu_permissions, function_permissions, project_permissions, data_permissions, created_at').order('created_at', { ascending: false })
      ]);

      if (templatesRes.data) {
        const templateMap = templatesRes.data.reduce((acc, template) => {
          acc[template.role] = template;
          return acc;
        }, {});
        setRoleTemplates(templateMap);
        
        // 强制刷新时输出调试信息
        if (forceRefresh) {
          console.log('强制刷新角色模板数据:', templateMap);
          const operatorTemplate = templateMap['operator'];
          if (operatorTemplate) {
            const totalCount = (operatorTemplate.menu_permissions?.length || 0) + 
                             (operatorTemplate.function_permissions?.length || 0) + 
                             (operatorTemplate.project_permissions?.length || 0) + 
                             (operatorTemplate.data_permissions?.length || 0);
            console.log('operator角色权限数量:', totalCount);
          }
        }
      }

      if (usersRes.data) {
        setUsers(usersRes.data);
      }

      if (permissionsRes.data) {
        setUserPermissions(permissionsRes.data);
      }

    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载权限数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 优化的保存逻辑 - 避免不必要的重新加载
  const savePermissions = async (templates: Record<string, any>, permissions: any[]) => {
    try {
      setLoading(true);

      // 1. 保存角色模板（使用 upsert 避免重复）
      const templatePromises = Object.entries(templates).map(([roleKey, template]) =>
        supabase
          .from('role_permission_templates')
          .upsert({
            role: roleKey as 'admin' | 'finance' | 'business' | 'partner' | 'operator' | 'viewer',
            menu_permissions: template.menu_permissions,
            function_permissions: template.function_permissions
          }, { onConflict: 'role' })
      );

      await Promise.all(templatePromises);

      // 2. 保存用户权限（只保存有变化的）
      const validPermissions = permissions.filter(perm => 
        perm.user_id && (
          (perm.menu_permissions && perm.menu_permissions.length > 0) ||
          (perm.function_permissions && perm.function_permissions.length > 0)
        )
      );

      if (validPermissions.length > 0) {
        const currentUser = await supabase.auth.getUser();
        await supabase
          .from('user_permissions')
          .upsert(validPermissions.map(perm => ({
            user_id: perm.user_id,
            project_id: perm.project_id,
            menu_permissions: perm.menu_permissions,
            function_permissions: perm.function_permissions,
            created_by: currentUser.data.user?.id
          })), { onConflict: 'user_id,project_id' });
      }

      // 3. 更新本地状态而不是重新加载所有数据
      setRoleTemplates(templates);
      setUserPermissions(validPermissions);

      toast({
        title: "保存成功",
        description: "权限配置已更新",
      });
      setHasChanges(false);
      
    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: "保存失败",
        description: "无法保存权限配置",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 清理重复权限数据
  const cleanupDuplicatePermissions = async () => {
    try {
      // 获取所有权限记录
      const { data: allPermissions } = await supabase
        .from('user_permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!allPermissions || allPermissions.length === 0) return;

      // 找出重复记录
      const seen = new Set();
      const duplicates = [];
      
      for (const perm of allPermissions) {
        const key = `${perm.user_id}_${perm.project_id || 'global'}`;
        if (seen.has(key)) {
          duplicates.push(perm.id);
        } else {
          seen.add(key);
        }
      }

      // 删除重复记录
      if (duplicates.length > 0) {
        await supabase
          .from('user_permissions')
          .delete()
          .in('id', duplicates);
        
        console.log(`清理了 ${duplicates.length} 条重复权限记录`);
      }
    } catch (error) {
      console.error('清理重复权限失败:', error);
    }
  };

  // 强制刷新数据
  const forceRefresh = async () => {
    console.log('强制刷新权限数据...');
    await loadAllData(true);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return {
    loading,
    roleTemplates,
    users,
    userPermissions: optimizedUserPermissions,
    hasChanges,
    setHasChanges,
    setRoleTemplates,
    setUserPermissions,
    savePermissions,
    cleanupDuplicatePermissions,
    loadAllData,
    forceRefresh
  };
}