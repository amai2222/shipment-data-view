import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionDatabaseService } from '@/services/PermissionDatabaseService';
import { PermissionResetService } from '@/services/PermissionResetService';
import { supabase } from '@/integrations/supabase/client';

interface PermissionDebugInfo {
  userPermissions: any;
  roleTemplate: any;
  effectivePermissions: any;
  databaseStatus: {
    hasUserPermissions: boolean;
    hasRoleTemplate: boolean;
    templatePermissions: any;
  };
}

export function PermissionDebugger() {
  const [debugInfo, setDebugInfo] = useState<PermissionDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');

  const loadDebugInfo = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // 获取用户信息
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single();

      if (!userData) {
        alert('用户不存在');
        return;
      }

      // 获取用户特定权限
      const userPermissions = await PermissionDatabaseService.getUserPermissions(userId);
      
      // 获取角色模板
      const roleTemplate = await PermissionDatabaseService.getRoleTemplate(userData.role);
      
      // 获取有效权限
      const effectivePermissions = await PermissionDatabaseService.getUserEffectivePermissions(
        userId, 
        userData.role
      );

      // 检查数据库状态
      const { data: templateData } = await supabase
        .from('role_permission_templates')
        .select('*')
        .eq('role', userData.role)
        .maybeSingle();

      setDebugInfo({
        userPermissions,
        roleTemplate,
        effectivePermissions,
        databaseStatus: {
          hasUserPermissions: !!userPermissions,
          hasRoleTemplate: !!roleTemplate,
          templatePermissions: templateData
        }
      });

    } catch (error) {
      console.error('加载调试信息失败:', error);
      alert('加载调试信息失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createAdminTemplate = async () => {
    try {
      // 使用重置服务创建管理员模板，而不是硬编码权限
      await PermissionResetService.resetRoleTemplateToSystemDefault('admin');
      
      alert('已创建admin角色模板（使用默认权限）');
      loadDebugInfo();
    } catch (error) {
      console.error('创建admin模板失败:', error);
      alert('创建admin模板失败: ' + (error as Error).message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>权限调试工具</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入用户ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Button onClick={loadDebugInfo} disabled={loading}>
              {loading ? '加载中...' : '加载调试信息'}
            </Button>
          </div>
          
          <Button onClick={createAdminTemplate} variant="outline">
            创建Admin角色模板
          </Button>
        </CardContent>
      </Card>

      {debugInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>用户特定权限</CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo.userPermissions ? (
                <div className="space-y-2">
                  <p><strong>菜单权限:</strong> {JSON.stringify(debugInfo.userPermissions.menu_permissions)}</p>
                  <p><strong>功能权限:</strong> {JSON.stringify(debugInfo.userPermissions.function_permissions)}</p>
                  <p><strong>项目权限:</strong> {JSON.stringify(debugInfo.userPermissions.project_permissions)}</p>
                  <p><strong>数据权限:</strong> {JSON.stringify(debugInfo.userPermissions.data_permissions)}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">无用户特定权限</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>角色模板</CardTitle>
            </CardHeader>
            <CardContent>
              {debugInfo.roleTemplate ? (
                <div className="space-y-2">
                  <p><strong>角色:</strong> {debugInfo.roleTemplate.role}</p>
                  <p><strong>名称:</strong> {debugInfo.roleTemplate.name}</p>
                  <p><strong>描述:</strong> {debugInfo.roleTemplate.description}</p>
                  <p><strong>菜单权限:</strong> {JSON.stringify(debugInfo.roleTemplate.menu_permissions)}</p>
                  <p><strong>功能权限:</strong> {JSON.stringify(debugInfo.roleTemplate.function_permissions)}</p>
                  <p><strong>项目权限:</strong> {JSON.stringify(debugInfo.roleTemplate.project_permissions)}</p>
                  <p><strong>数据权限:</strong> {JSON.stringify(debugInfo.roleTemplate.data_permissions)}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">无角色模板</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>有效权限</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>权限来源:</strong> 
                  <Badge variant={debugInfo.effectivePermissions.source === 'user' ? 'default' : 
                                 debugInfo.effectivePermissions.source === 'role' ? 'secondary' : 'outline'}>
                    {debugInfo.effectivePermissions.source}
                  </Badge>
                </p>
                <p><strong>菜单权限:</strong> {JSON.stringify(debugInfo.effectivePermissions.menu_permissions)}</p>
                <p><strong>功能权限:</strong> {JSON.stringify(debugInfo.effectivePermissions.function_permissions)}</p>
                <p><strong>项目权限:</strong> {JSON.stringify(debugInfo.effectivePermissions.project_permissions)}</p>
                <p><strong>数据权限:</strong> {JSON.stringify(debugInfo.effectivePermissions.data_permissions)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>数据库状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>有用户权限:</strong> 
                  <Badge variant={debugInfo.databaseStatus.hasUserPermissions ? 'default' : 'outline'}>
                    {debugInfo.databaseStatus.hasUserPermissions ? '是' : '否'}
                  </Badge>
                </p>
                <p><strong>有角色模板:</strong> 
                  <Badge variant={debugInfo.databaseStatus.hasRoleTemplate ? 'default' : 'outline'}>
                    {debugInfo.databaseStatus.hasRoleTemplate ? '是' : '否'}
                  </Badge>
                </p>
                {debugInfo.databaseStatus.templatePermissions && (
                  <div>
                    <p><strong>模板权限详情:</strong></p>
                    <pre className="text-xs bg-muted p-2 rounded">
                      {JSON.stringify(debugInfo.databaseStatus.templatePermissions, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
