// 角色管理组件 - 简化版本

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Settings, Building2, Database } from 'lucide-react';
import { PermissionSelector } from './PermissionSelector';
import { 
  RoleTemplate, 
  AppRole, 
  PermissionGroup 
} from '@/types/permission';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS } from '@/config/permissionsNew';

interface RoleManagementProps {
  roleTemplates: Record<AppRole, RoleTemplate>;
  onSaveRoleTemplate: (template: Partial<RoleTemplate>) => Promise<any>;
  loading?: boolean;
}

export function RoleManagement({ 
  roleTemplates, 
  onSaveRoleTemplate, 
  loading = false 
}: RoleManagementProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [currentTemplate, setCurrentTemplate] = useState<Partial<RoleTemplate>>({});
  const [saving, setSaving] = useState(false);

  // 角色选项
  const roleOptions: { value: AppRole; label: string }[] = [
    { value: 'admin', label: '系统管理员' },
    { value: 'finance', label: '财务人员' },
    { value: 'business', label: '业务人员' },
    { value: 'operator', label: '操作员' },
    { value: 'partner', label: '合作伙伴' },
    { value: 'viewer', label: '查看者' }
  ];

  // 当选择角色时，加载对应的模板
  useEffect(() => {
    if (selectedRole && roleTemplates[selectedRole]) {
      const template = roleTemplates[selectedRole];
      setCurrentTemplate({
        role: template.role,
        name: template.name,
        description: template.description,
        color: template.color,
        menu_permissions: [...template.menu_permissions],
        function_permissions: [...template.function_permissions],
        project_permissions: [...template.project_permissions],
        data_permissions: [...template.data_permissions]
      });
    } else if (selectedRole) {
      // 创建新模板
      setCurrentTemplate({
        role: selectedRole,
        name: roleOptions.find(r => r.value === selectedRole)?.label || selectedRole,
        description: '',
        color: 'bg-blue-500',
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: []
      });
    }
  }, [selectedRole, roleTemplates]);

  // 保存角色模板
  const handleSave = async () => {
    if (!selectedRole || !currentTemplate) {
      toast({
        title: "错误",
        description: "请选择角色",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const result = await onSaveRoleTemplate(currentTemplate);
      
      if (result.success) {
        toast({
          title: "成功",
          description: result.message
        });
      } else {
        toast({
          title: "错误",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "错误",
        description: `保存失败: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // 更新权限
  const updatePermissions = (type: 'menu' | 'function' | 'project' | 'data', permissions: string[]) => {
    setCurrentTemplate(prev => ({
      ...prev,
      [`${type}_permissions`]: permissions
    }));
  };

  // 计算总权限数
  const getTotalPermissions = () => {
    if (!currentTemplate) return 0;
    return (currentTemplate.menu_permissions?.length || 0) +
           (currentTemplate.function_permissions?.length || 0) +
           (currentTemplate.project_permissions?.length || 0) +
           (currentTemplate.data_permissions?.length || 0);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 角色选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            角色权限管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="text-sm font-medium">选择角色</label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要管理的角色" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedRole && (
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  总权限: {getTotalPermissions()}
                </Badge>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="min-w-[100px]"
                >
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 权限配置 */}
      {selectedRole && currentTemplate && (
        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="menu" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              菜单权限
            </TabsTrigger>
            <TabsTrigger value="function" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              功能权限
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center">
              <Building2 className="h-4 w-4 mr-2" />
              项目权限
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center">
              <Database className="h-4 w-4 mr-2" />
              数据权限
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu">
            <PermissionSelector
              title="菜单权限"
              permissions={MENU_PERMISSIONS}
              selectedPermissions={currentTemplate.menu_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('menu', permissions)}
            />
          </TabsContent>

          <TabsContent value="function">
            <PermissionSelector
              title="功能权限"
              permissions={FUNCTION_PERMISSIONS}
              selectedPermissions={currentTemplate.function_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('function', permissions)}
            />
          </TabsContent>

          <TabsContent value="project">
            <PermissionSelector
              title="项目权限"
              permissions={PROJECT_PERMISSIONS}
              selectedPermissions={currentTemplate.project_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('project', permissions)}
            />
          </TabsContent>

          <TabsContent value="data">
            <PermissionSelector
              title="数据权限"
              permissions={DATA_PERMISSIONS}
              selectedPermissions={currentTemplate.data_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('data', permissions)}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
