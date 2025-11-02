// 新角色管理组件
// 文件: src/components/permissions/RoleManagementNew.tsx

import { useState } from 'react';
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
  MENU_PERMISSIONS_NEW, 
  FUNCTION_PERMISSIONS_NEW, 
  PROJECT_PERMISSIONS_NEW, 
  DATA_PERMISSIONS_NEW,
  ROLES_NEW
} from '@/config/permissionsNew';
import { PermissionGroupNew } from '@/config/permissionsNew';
import { supabase } from '@/integrations/supabase/client';

interface RoleTemplateNew {
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

interface RoleManagementNewProps {
  roleTemplates: RoleTemplateNew[];
  onDataChange: () => void;
}

export function RoleManagementNew({ roleTemplates, onDataChange }: RoleManagementNewProps) {
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
          menu_permissions: ['dashboard', 'contracts', 'maintenance', 'business', 'finance', 'settings'],
          function_permissions: ['data.create', 'data.edit', 'data.delete', 'data.export', 'data.import'],
          project_permissions: ['project.view_all', 'project.create', 'project.edit', 'project.delete'],
          data_permissions: ['data.view_all', 'data.export_all']
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
  }, [selectedRole]);

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
      
      const permissionData = {
        role: selectedRole,
        name: ROLES_NEW[selectedRole as keyof typeof ROLES_NEW]?.label || selectedRole,
        description: ROLES_NEW[selectedRole as keyof typeof ROLES_NEW]?.description || '',
        color: ROLES_NEW[selectedRole as keyof typeof ROLES_NEW]?.color || 'bg-gray-500',
        menu_permissions: currentPermissions.menu_permissions,
        function_permissions: currentPermissions.function_permissions,
        project_permissions: currentPermissions.project_permissions,
        data_permissions: currentPermissions.data_permissions,
        is_system: true
      };

      // 使用 upsert 操作，避免更新失败
      const { error } = await supabase
        .from('role_permission_templates')
        .upsert([permissionData], {
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
    permissions: PermissionGroupNew[],
    type: string,
    title: string,
    icon: React.ReactNode
  ) => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        {icon}
        <h3 className="text-lg font-medium">{title}</h3>
        <Badge variant="outline">
          {permissions.reduce((acc, group) => acc + group.children.length, 0)} 项权限
        </Badge>
      </div>
      
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {permissions.map(group => (
            <Card key={group.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.children.map(item => (
                  <div key={item.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${type}-${item.key}`}
                      checked={currentPermissions[`${type}_permissions` as keyof typeof currentPermissions].includes(item.key)}
                      onCheckedChange={() => togglePermission(type, item.key)}
                    />
                    <Label htmlFor={`${type}-${item.key}`} className="text-sm">
                      {item.label}
                    </Label>
                    {item.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {item.description}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5" />
          <span>角色权限管理</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 角色选择 */}
        <div className="flex items-center space-x-4">
          <Label htmlFor="role-select">选择角色:</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger id="role-select" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLES_NEW).map(([key, role]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${role.color}`} />
                    <span>{role.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleSaveRolePermissions} 
            disabled={saving}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? '保存中...' : '保存权限'}</span>
          </Button>
        </div>

        {/* 权限配置 */}
        <Tabs defaultValue="menu" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="menu" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>菜单权限</span>
            </TabsTrigger>
            <TabsTrigger value="function" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>功能权限</span>
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>项目权限</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>数据权限</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="menu">
            {renderPermissionList(MENU_PERMISSIONS_NEW, 'menu', '菜单权限', <Settings className="h-5 w-5" />)}
          </TabsContent>
          
          <TabsContent value="function">
            {renderPermissionList(FUNCTION_PERMISSIONS_NEW, 'function', '功能权限', <Shield className="h-5 w-5" />)}
          </TabsContent>
          
          <TabsContent value="project">
            {renderPermissionList(PROJECT_PERMISSIONS_NEW, 'project', '项目权限', <Building2 className="h-5 w-5" />)}
          </TabsContent>
          
          <TabsContent value="data">
            {renderPermissionList(DATA_PERMISSIONS_NEW, 'data', '数据权限', <Database className="h-5 w-5" />)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}