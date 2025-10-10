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
import { Shield, Save, RefreshCw, Settings, Building2, Database } from 'lucide-react';
import { 
  MENU_PERMISSIONS, 
  FUNCTION_PERMISSIONS, 
  PROJECT_PERMISSIONS, 
  DATA_PERMISSIONS,
  ROLES
} from '@/config/permissions';
import { PermissionGroup } from '@/types/permission';
import { supabase } from '@/integrations/supabase/client';

interface RoleTemplate {
  role: string;
  name: string;
  description: string;
  color: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  is_system: boolean;
}

interface RoleManagementProps {
  roleTemplates: RoleTemplate[];
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
      // 数据库中没有该角色的权限，使用默认权限
      if (selectedRole === 'admin') {
        console.info(`Admin角色使用默认全权限`);
        setCurrentPermissions({
          menu_permissions: ['projects', 'business-entry', 'drivers', 'partners', 'locations', 'reports', 'finance-management', 'user-management', 'role-management', 'system-settings', 'all'],
          function_permissions: ['create', 'edit', 'delete', 'view', 'export', 'import', 'approve', 'reject', 'assign', 'unassign', 'all'],
          project_permissions: ['all', 'create', 'edit', 'delete', 'view', 'assign', 'approve'],
          data_permissions: ['all', 'own', 'team', 'department', 'company']
        });
      } else {
        console.info(`角色 ${selectedRole} 使用默认权限配置`);
        setCurrentPermissions({
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: []
        });
      }
    }
  }, [selectedRole]); // 移除 roleTemplates 依赖，避免覆盖用户修改

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
    permissions: PermissionGroup[],
    currentPerms: string[],
    type: string
  ) => {
    const totalPermissions = permissions.reduce((total: number, group) => total + (group.children?.length || 0), 0);
    const selectedPermissions = currentPerms.length;
    
    return (
      <div className="space-y-4">
        {/* 权限统计 */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium">权限概览</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            已选择 {selectedPermissions} / {totalPermissions} 个权限
          </Badge>
        </div>
        
        {/* 权限分组 */}
        {permissions.map((group) => {
          const selectedCount = group.children?.filter((child) => currentPerms.includes(child.key)).length || 0;
          const totalCount = group.children?.length || 0;
          
          return (
            <Card key={group.key} className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    {group.label}
                  </CardTitle>
                  <Badge variant={selectedCount === totalCount ? "default" : selectedCount > 0 ? "secondary" : "outline"}>
                    {selectedCount} / {totalCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.children?.map((permission) => (
                  <div key={permission.key} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
                    <Checkbox
                      id={permission.key}
                      checked={currentPerms.includes(permission.key)}
                      onCheckedChange={() => togglePermission(type, permission.key)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={permission.key} className="text-sm font-medium cursor-pointer">
                        {permission.label}
                      </Label>
                      {permission.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {permission.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
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
            <TabsTrigger value="menu" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              菜单权限 ({currentPermissions.menu_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="function" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              功能权限 ({currentPermissions.function_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              项目权限 ({currentPermissions.project_permissions.length})
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              数据权限 ({currentPermissions.data_permissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>配置 {selectedRole} 角色的菜单访问权限</span>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
              {renderPermissionList(
                MENU_PERMISSIONS,
                currentPermissions.menu_permissions,
                'menu'
              )}
            </div>
          </TabsContent>

          <TabsContent value="function" className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>配置 {selectedRole} 角色的功能操作权限</span>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
              {renderPermissionList(
                FUNCTION_PERMISSIONS,
                currentPermissions.function_permissions,
                'function'
              )}
            </div>
          </TabsContent>

          <TabsContent value="project" className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>配置 {selectedRole} 角色的项目访问权限</span>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
              {renderPermissionList(
                PROJECT_PERMISSIONS,
                currentPermissions.project_permissions,
                'project'
              )}
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>配置 {selectedRole} 角色的数据操作权限</span>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4">
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