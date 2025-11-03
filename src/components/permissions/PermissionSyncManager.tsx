// 权限同步管理组件
// 同步菜单配置到权限选项

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SyncStatus {
  menuItems: string[];
  permissionKeys: Set<string>;
  onlyInMenu: string[];
  onlyInPermissions: string[];
  inBoth: string[];
  keyToTitleMap?: Map<string, string>;
}

export function PermissionSyncManager() {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const { toast } = useToast();

  // 检查同步状态
  const checkSyncStatus = async () => {
    try {
      setLoading(true);

      // 1. 从 menu_config 获取所有菜单项的权限键和标题
      const { data: menuData, error: menuError } = await supabase
        .from('menu_config')
        .select('key, title, required_permissions')
        .eq('is_active', true)
        .eq('is_group', false);

      if (menuError) throw menuError;

      const menuKeys = menuData?.map(m => m.key) || [];
      
      // 创建 key -> title 的映射
      const keyToTitleMap = new Map<string, string>();
      menuData?.forEach(m => {
        keyToTitleMap.set(m.key, m.title);
      });

      // 2. 从 role_permission_templates 获取所有已使用的权限键（排除管理员）
      const { data: roleData, error: roleError } = await supabase
        .from('role_permission_templates')
        .select('role, menu_permissions')
        .neq('role', 'admin');  // 排除管理员（自动同步）

      if (roleError) throw roleError;

      const allPermissionKeys = new Set<string>();
      roleData?.forEach(role => {
        role.menu_permissions?.forEach((key: string) => allPermissionKeys.add(key));
      });

      // 3. 对比分析
      const onlyInMenu = menuKeys.filter(k => !allPermissionKeys.has(k));
      const onlyInPermissions = Array.from(allPermissionKeys).filter(k => !menuKeys.includes(k));
      const inBoth = menuKeys.filter(k => allPermissionKeys.has(k));

      setSyncStatus({
        menuItems: menuKeys,
        permissionKeys: allPermissionKeys,
        onlyInMenu,
        onlyInPermissions,
        inBoth,
        keyToTitleMap  // 添加映射
      } as any);

      toast({
        title: '检查完成',
        description: `找到 ${onlyInMenu.length} 个新菜单（需配置），${onlyInPermissions.length} 个过期权限`,
      });

    } catch (error: any) {
      toast({
        title: '检查失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 清理过期权限（仅非管理员角色）
  const cleanupObsoletePermissions = async () => {
    if (!syncStatus || syncStatus.onlyInPermissions.length === 0) {
      toast({
        title: '无需清理',
        description: '没有过期的权限需要清理',
      });
      return;
    }

    if (!confirm(`确定要从非管理员角色中移除 ${syncStatus.onlyInPermissions.length} 个过期权限吗？\n\n注意：管理员权限由系统自动管理，不受影响。`)) {
      return;
    }

    try {
      setLoading(true);

      // 获取所有角色模板（排除管理员）
      const { data: roles, error: fetchError } = await supabase
        .from('role_permission_templates')
        .select('*')
        .neq('role', 'admin');

      if (fetchError) throw fetchError;

      // 更新每个角色，移除过期权限
      const updates = roles?.map(role => {
        const cleanedPermissions = (role.menu_permissions || []).filter(
          (key: string) => !syncStatus.onlyInPermissions.includes(key)
        );

        return supabase
          .from('role_permission_templates')
          .update({ menu_permissions: cleanedPermissions })
          .eq('id', role.id);
      });

      await Promise.all(updates || []);

      toast({
        title: '清理成功',
        description: `已从非管理员角色中移除 ${syncStatus.onlyInPermissions.length} 个过期权限`,
      });

      // 重新检查状态
      checkSyncStatus();

    } catch (error: any) {
      toast({
        title: '清理失败',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          菜单权限同步管理
        </CardTitle>
        <CardDescription>
          检查非管理员角色的菜单权限同步状态
          <br />
          <span className="text-xs text-muted-foreground">
            💡 管理员权限由系统自动同步，始终拥有所有菜单访问权限
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button 
            onClick={checkSyncStatus} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            检查同步状态
          </Button>
          
          {syncStatus && syncStatus.onlyInPermissions.length > 0 && (
            <Button 
              onClick={cleanupObsoletePermissions}
              disabled={loading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              清理过期权限
            </Button>
          )}
        </div>

        {/* 同步状态显示 */}
        {syncStatus && (
          <div className="space-y-4 mt-6">
            {/* 统计摘要 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">菜单项总数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{syncStatus.menuItems.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">权限键总数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{syncStatus.permissionKeys.size}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">已同步</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{syncStatus.inBoth.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* 新菜单（未添加到权限）*/}
            {syncStatus.onlyInMenu.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">
                    发现 {syncStatus.onlyInMenu.length} 个新菜单尚未被非管理员角色使用
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {syncStatus.onlyInMenu.map(key => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {syncStatus.keyToTitleMap?.get(key) || key}
                        <span className="ml-1 text-muted-foreground">({key})</span>
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-3 w-3 inline mr-1" />
                    您需要在角色模板管理中为相应角色（finance、business等）添加这些权限
                  </div>
                  <div className="mt-1 text-xs text-green-600">
                    ✅ 管理员已自动拥有这些菜单的访问权限
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 过期权限（菜单已删除）*/}
            {syncStatus.onlyInPermissions.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">
                    发现 {syncStatus.onlyInPermissions.length} 个过期权限（对应菜单已删除或禁用）
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {syncStatus.onlyInPermissions.map(key => (
                      <Badge key={key} variant="destructive" className="text-xs">
                        {key}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-2 text-sm">
                    <ArrowRight className="h-3 w-3 inline mr-1" />
                    点击"清理过期权限"按钮自动移除这些权限
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* 完美同步状态 */}
            {syncStatus.onlyInMenu.length === 0 && syncStatus.onlyInPermissions.length === 0 && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="font-semibold">
                    ✅ 菜单配置与权限设置完全同步
                  </div>
                  <div className="text-sm mt-1">
                    所有菜单项都已正确配置，没有发现不一致的情况
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">使用说明：</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>管理员权限</strong>：系统自动同步，始终拥有所有菜单访问权限</li>
            <li><strong>其他角色</strong>：需要在"角色模板管理"中手动配置权限</li>
            <li>新增菜单后，点击"检查同步状态"查看哪些角色需要添加权限</li>
            <li>删除菜单后，使用"清理过期权限"从非管理员角色中自动移除</li>
            <li>建议定期（如每周）检查一次同步状态</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

