// 混合方案：数据库优先 + 智能回退

// 1. 保留 DEFAULT_ROLE_PERMISSIONS 作为最后回退
// 2. 优先从数据库读取
// 3. 只在数据库完全为空时才使用硬编码权限
// 4. 添加权限验证和修复机制

// 修改后的权限加载逻辑
const loadPermissionsWithFallback = async (userRole: UserRole) => {
  try {
    // 1. 尝试从数据库加载
    const { data, error } = await supabase
      .from('role_permission_templates')
      .select('menu_permissions, function_permissions, project_permissions, data_permissions')
      .eq('role', userRole)
      .single();

    if (data && !error) {
      // 验证权限数据完整性
      if (isValidPermissions(data)) {
        return data;
      } else {
        console.warn(`角色 ${userRole} 的权限数据不完整，尝试修复...`);
        await repairRolePermissions(userRole);
        return data; // 返回修复后的数据
      }
    }

    // 2. 数据库中没有数据，检查是否需要初始化
    const { count } = await supabase
      .from('role_permission_templates')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      // 3. 数据库完全为空，使用硬编码权限初始化
      console.log('数据库为空，使用默认权限初始化...');
      await initializeDefaultRoleTemplates();
      return DEFAULT_ROLE_PERMISSIONS[userRole];
    } else {
      // 4. 数据库有数据但当前角色没有，返回空权限
      console.warn(`角色 ${userRole} 在数据库中不存在`);
      return {
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      };
    }
  } catch (error) {
    console.error('加载权限失败:', error);
    // 5. 最后回退到硬编码权限
    return DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.viewer;
  }
};

// 权限数据验证函数
const isValidPermissions = (permissions: any): boolean => {
  return permissions &&
    Array.isArray(permissions.menu_permissions) &&
    Array.isArray(permissions.function_permissions) &&
    Array.isArray(permissions.project_permissions) &&
    Array.isArray(permissions.data_permissions);
};

// 权限修复函数
const repairRolePermissions = async (userRole: UserRole) => {
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole];
  if (!defaultPerms) return;

  await supabase
    .from('role_permission_templates')
    .upsert({
      role: userRole,
      menu_permissions: defaultPerms.menu_permissions,
      function_permissions: defaultPerms.function_permissions,
      project_permissions: defaultPerms.project_permissions,
      data_permissions: defaultPerms.data_permissions,
      updated_at: new Date().toISOString()
    }, { onConflict: 'role' });
};
