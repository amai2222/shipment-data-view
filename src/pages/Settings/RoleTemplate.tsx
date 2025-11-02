import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  RefreshCw, 
  Plus,
  Users,
  Shield,
  FileText
} from 'lucide-react';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { RoleTemplateManager } from '@/components/permissions/RoleTemplateManager';
import { PermissionResetService } from '@/services/PermissionResetService';
import { PageHeader } from '@/components/PageHeader';

export default function RoleTemplatePage() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const {
    loading,
    roleTemplates,
    loadAllData
  } = useOptimizedPermissions();

  // 将roleTemplates对象转换为数组用于统计，但保持对象格式用于组件
  const roleTemplatesArray = Array.isArray(roleTemplates) 
    ? roleTemplates 
    : Object.values(roleTemplates || {});
  
  // 确保roleTemplates是对象格式（RoleTemplateManager需要的格式）
  const roleTemplatesObject = Array.isArray(roleTemplates) 
    ? roleTemplates.reduce((acc, template, index) => {
        acc[template.role || `template_${index}`] = template;
        return acc;
      }, {} as Record<string, any>)
    : roleTemplates || {};

  // 处理更新角色模板
  const handleUpdateRoleTemplates = async () => {
    try {
      console.log('开始更新角色模板...');
      setHasChanges(true);
      // 强制刷新数据以显示最新状态
      await loadAllData(true);
      console.log('角色模板数据已强制刷新');
      toast({
        title: "模板更新",
        description: "角色模板已更新",
      });
    } catch (error) {
      console.error('更新角色模板失败:', error);
      toast({
        title: "更新失败",
        description: "无法更新角色模板",
        variant: "destructive",
      });
    }
  };

  // 处理刷新数据
  const handleRefresh = async () => {
    try {
      await loadAllData();
      toast({
        title: "刷新成功",
        description: "角色模板数据已刷新",
      });
    } catch (error) {
      toast({
        title: "刷新失败",
        description: "无法刷新角色模板数据",
        variant: "destructive",
      });
    }
  };

  // 重置所有角色模板为默认权限
  const handleResetAllToDefault = async () => {
    try {
      const roles = ['admin', 'finance', 'business', 'operator', 'partner', 'viewer'] as const;
      
      for (const role of roles) {
        await PermissionResetService.resetRoleTemplateToDefault(role);
      }
      
      toast({
        title: "重置成功",
        description: "所有角色模板已重置为默认权限",
      });
      
      // 刷新数据
      await loadAllData(true);
    } catch (error) {
      console.error('重置角色模板失败:', error);
      toast({
        title: "重置失败",
        description: "无法重置角色模板",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="角色模板"
        description="管理角色模板和权限预设"
        icon={Settings}
        iconColor="text-blue-600"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleResetAllToDefault}
            disabled={loading}
          >
          <Shield className="h-4 w-4 mr-2" />
          重置为默认
        </Button>
        <Button
          size="sm"
          onClick={() => setHasChanges(false)}
          disabled={!hasChanges}
        >
          <Plus className="h-4 w-4 mr-2" />
          保存更改
        </Button>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">模板总数</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleTemplatesArray.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">默认角色</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roleTemplatesArray.filter(template => template.is_default).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">自定义模板</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roleTemplatesArray.filter(template => !template.is_default).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">状态</CardTitle>
            <Badge variant={hasChanges ? "destructive" : "default"}>
              {hasChanges ? "有未保存更改" : "已保存"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {hasChanges ? "请保存更改" : "所有更改已保存"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 角色模板管理组件 */}
      <Card>
        <CardContent>
          <RoleTemplateManager
            roleTemplates={roleTemplatesObject}
            onUpdate={handleUpdateRoleTemplates}
          />
        </CardContent>
      </Card>
    </div>
  );
}
