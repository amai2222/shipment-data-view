// 自动同步菜单权限组件
// 在应用启动时自动同步前端菜单到数据库
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { smartSyncMenuPermissions } from '@/utils/autoSyncMenuPermissions';

export function AutoMenuSync() {
  const { user, profile } = useAuth();

  useEffect(() => {
    // 只在用户登录且是管理员时执行同步
    if (user && profile?.role === 'admin') {
      // 延迟执行，避免阻塞页面加载
      const timer = setTimeout(() => {
        smartSyncMenuPermissions();
      }, 2000); // 2秒后执行

      return () => clearTimeout(timer);
    }
  }, [user, profile?.role]);

  // 这个组件不渲染任何内容
  return null;
}

