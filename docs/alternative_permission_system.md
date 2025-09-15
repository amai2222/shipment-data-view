// 替代方案：完全基于数据库的权限系统

// 1. 移除硬编码的 DEFAULT_ROLE_PERMISSIONS
// 2. 所有权限都从数据库读取
// 3. 只在数据库为空时才初始化

// 修改后的 useSimplePermissions.ts
export function useSimplePermissions() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dbPermissions, setDbPermissions] = useState<RolePermissions | null>(null);

  const userRole = useMemo(() => {
    const role = profile?.role as UserRole || 'viewer';
    return role;
  }, [profile?.role]);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!userRole) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('role_permission_templates')
          .select('menu_permissions, function_permissions, project_permissions, data_permissions')
          .eq('role', userRole)
          .single();

        if (error) {
          console.warn('从数据库加载权限失败:', error);
          setDbPermissions(null);
        } else {
          setDbPermissions(data);
        }
      } catch (error) {
        console.error('加载权限失败:', error);
        setDbPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [userRole]);

  const rolePermissions = useMemo(() => {
    if (dbPermissions) {
      return dbPermissions;
    } else {
      // 如果数据库中没有权限，返回空权限而不是硬编码权限
      return {
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      };
    }
  }, [dbPermissions]);

  // ... 其他函数保持不变
}
