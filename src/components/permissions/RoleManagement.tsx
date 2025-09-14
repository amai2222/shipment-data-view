// 角色管理组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save, RefreshCw } from 'lucide-react';
import { 
  MENU_PERMISSIONS, 
  FUNCTION_PERMISSIONS, 
  PROJECT_PERMISSIONS, 
  DATA_PERMISSIONS,
  ROLES,
  DEFAULT_ROLE_PERMISSIONS
} from '@/config/permissions';
import { supabase } from '@/integrations/supabase/client';

interface RoleManagementProps {
  roleTemplates: any[];
  onDataChange: () => void;
}

export function RoleManagement({ roleTemplates, onDataChange }: RoleManagementProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [saving, setSaving] = useState(false);
  const [currentPermissions, setCurrentPermissions] = useState({
    menu_permissions: [] as string[],
    function_permissions: [] as string[],
    project_permissions: [] as string[],
    data_permissions: [] as string[]
  });

  // 获取当前角色的权限配置
  React.useEffect(() => {
    const template = roleTemplates.find(t => t.role === selectedRole);
    if (template) {
      setCurrentPermissions({
        menu_permissions: template.menu_permissions || [],
        function_permissions: template.function_permissions || [],
        project_permissions: template.project_permissions || [],
        data_permissions: template.data_permissions || []
      });
    } else {
      // 使用默认权限
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[selectedRole as keyof typeof DEFAULT_ROLE_PERMISSIONS];
      if (defaultPerms) {
        setCurrentPermissions({
          menu_permissions: defaultPerms.menu_permissions || [],
          function_permissions: defaultPerms.function_permissions || [],
          project_permissions: defaultPerms.project_permissions || [],
          data_permissions: defaultPerms.data_permissions || []
        });
      }
    }
  }, [selectedRole, roleTemplates]);

  // 切换权限
  const togglePermission = (type: string, key: string) => {
    setCurrentPermissions(prev => {
      const field = `${type}_permissions` as keyof typeof prev;
      const current = prev[field] || [];
      const updated = current.includes(key)
        ? current.filter(p => p !== key)
        : [...current, key];
      
      return {
        ...prev,
        [field]: updated
      };
    });
  };

  // 保存角色权限
  const handleSaveRolePermissions = async () => {
    try {
      setSaving(true);
      
      const existingTemplate = roleTemplates.find(t => t.role === selectedRole);
      
      const permissionData = {
        role: selectedRole,
        name: ROLES[selectedRole as keyof typeof ROLES]?.label || selectedRole,
        description: ROLES[selectedRole as keyof typeof ROLES]?.description || '',
        color: ROLES[selectedRole as keyof typeof ROLES]?.color || 'bg-gray-500',
        menu_permissions: currentPermissions.menu_permissions,
        function_permissions: currentPermissions.function_permissions,
        project_permissions: currentPermissions.project_permissions,
        data_permissions: currentPermissions.data_permissions,
        is_system: true
      };

      // 使用 upsert 操作，避免更新失败
      const { error } = await supabase
        .from('role_permission_templates')
        .upsert(permissionData, {
          onConflict: 'role'
        });

      if (error) {
        console.error('数据库错误详情:', error);
        throw new Error(`数据库操作失败: ${error.message}`);
      }

      toast({
        title: "成功",
        description: "角色权限已保存",
      });

      onDataChange();
    } catch (error) {
      console.error('保存角色权限失败:', error);
      toast({
        title: "错误",
        description: "保存角色权限失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 渲染权限列表
  const renderPermissionList = (
    permissions: any,
    currentPerms: string[],
    type: string
  ) => {
    return (
      <div className="space-y-4">
        {Object.entries(permissions).map(([key, group]: [string, any]) => (
          <Card key={key} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{group.label}</CardTitle>
                <Badge variant="outline">
                  {group.children?.filter((child: any) => currentPerms.includes(child.key)).length || 0} / {group.children?.length || 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.children?.map((permission: any) => (
                <div key={permission.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.key}
                    checked={currentPerms.includes(permission.key)}
                    onCheckedChange={() => togglePermission(type, permission.key)}
                  />
                  <Label htmlFor={permission.key} className="text-sm flex-1">
                    {permission.label}
                  </Label>
                  {permission.description && (
                    <span className="text-xs text-muted-foreground">
                      {permission.description}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          角色权限管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 角色选择 */}
        <div className="flex items-center space-x-4">
          <div>
            <Label htmlFor="role-select">选择角色</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([key, role]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${role.color} mr-2`} />
                      {role.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className={ROLES[selectedRole as keyof typeof ROLES]?.color}>
            {ROLES[selectedRole as keyof typeof ROLES]?.label}
          </Badge>
        </div>

        {/* 权限配置标签页 */}
        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="menu">
              菜单权限 ({currentPermissions.menu_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="function">
              功能权限 ({currentPermissions.function_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="project">
              项目权限 ({currentPermissions.project_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="data">
              数据权限 ({currentPermissions.data_permissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu">
            <div className="max-h-96 overflow-y-auto scroll-smooth">
              {renderPermissionList(
                MENU_PERMISSIONS,
                currentPermissions.menu_permissions,
                'menu'
              )}
            </div>
          </TabsContent>

          <TabsContent value="function">
            <div className="max-h-96 overflow-y-auto scroll-smooth">
              {renderPermissionList(
                FUNCTION_PERMISSIONS,
                currentPermissions.function_permissions,
                'function'
              )}
            </div>
          </TabsContent>

          <TabsContent value="project">
            <div className="max-h-96 overflow-y-auto scroll-smooth">
              {renderPermissionList(
                PROJECT_PERMISSIONS,
                currentPermissions.project_permissions,
                'project'
              )}
            </div>
          </TabsContent>

          <TabsContent value="data">
            <div className="max-h-96 overflow-y-auto scroll-smooth">
              {renderPermissionList(
                DATA_PERMISSIONS,
                currentPermissions.data_permissions,
                'data'
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button onClick={handleSaveRolePermissions} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存角色权限'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}