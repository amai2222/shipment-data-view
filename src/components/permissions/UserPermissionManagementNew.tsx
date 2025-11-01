// 新用户权限管理组件
// 文件: src/components/permissions/UserPermissionManagementNew.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { User, Shield, Save, RefreshCw, Settings, Building2, Database } from 'lucide-react';
import { 
  MENU_PERMISSIONS_NEW, 
  FUNCTION_PERMISSIONS_NEW, 
  PROJECT_PERMISSIONS_NEW, 
  DATA_PERMISSIONS_NEW,
  ROLES_NEW
} from '@/config/permissionsNew';
import { PermissionGroupNew } from '@/config/permissionsNew';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissionNew {
  id: string;
  user_id: string;
  project_id?: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  inherit_role: boolean;
  custom_settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface UserPermissionManagementNewProps {
  users: any[];
  projects: any[];
  userPermissions: UserPermissionNew[];
  onDataChange: () => void;
}

export function UserPermissionManagementNew({ 
  users, 
  projects, 
  userPermissions, 
  onDataChange 
}: UserPermissionManagementNewProps) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [currentPermissions, setCurrentPermissions] = useState({
    menu_permissions: [] as string[],
    function_permissions: [] as string[],
    project_permissions: [] as string[],
    data_permissions: [] as string[]
  });
  const [inheritRole, setInheritRole] = useState(true);

  // 获取当前用户的权限配置
  useEffect(() => {
    if (!selectedUser) return;

    const userPermission = userPermissions.find(
      up => up.user_id === selectedUser && 
      (selectedProject === 'all' ? !up.project_id : up.project_id === selectedProject)
    );

    if (userPermission) {
      setCurrentPermissions({
        menu_permissions: userPermission.menu_permissions || [],
        function_permissions: userPermission.function_permissions || [],
        project_permissions: userPermission.project_permissions || [],
        data_permissions: userPermission.data_permissions || []
      });
      setInheritRole(userPermission.inherit_role);
    } else {
      // 如果没有自定义权限，使用角色默认权限
      const user = users.find(u => u.id === selectedUser);
      if (user) {
        const roleTemplate = ROLES_NEW[user.role as keyof typeof ROLES_NEW];
        if (roleTemplate) {
          setCurrentPermissions({
            menu_permissions: [],
            function_permissions: [],
            project_permissions: [],
            data_permissions: []
          });
        }
      }
      setInheritRole(true);
    }
  }, [selectedUser, selectedProject, userPermissions, users]);

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

  // 保存用户权限
  const handleSaveUserPermissions = async () => {
    if (!selectedUser) {
      toast({
        title: "错误",
        description: "请先选择用户",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      const permissionData = {
        user_id: selectedUser,
        project_id: selectedProject === 'all' ? null : selectedProject,
        menu_permissions: currentPermissions.menu_permissions,
        function_permissions: currentPermissions.function_permissions,
        project_permissions: currentPermissions.project_permissions,
        data_permissions: currentPermissions.data_permissions,
        inherit_role: inheritRole,
        custom_settings: {}
      };

      // 使用 upsert 操作
      const { error } = await supabase
        .from('user_permissions')
        .upsert([permissionData], {
          onConflict: 'user_id,project_id'
        });

      if (error) {
        console.error('数据库错误详情:', error);
        throw new Error(`数据库操作失败: ${error.message}`);
      }

      toast({
        title: "成功",
        description: "用户权限已保存",
      });

      onDataChange();
    } catch (error) {
      console.error('保存用户权限失败:', error);
      toast({
        title: "错误",
        description: "保存用户权限失败",
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
          <User className="h-5 w-5" />
          <span>用户权限管理</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 用户和项目选择 */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="user-select">选择用户:</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user-select" className="w-48">
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center space-x-2">
                      <span>{user.full_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {ROLES_NEW[user.role as keyof typeof ROLES_NEW]?.label || user.role}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="project-select">项目范围:</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger id="project-select" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有项目</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleSaveUserPermissions} 
            disabled={saving || !selectedUser}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? '保存中...' : '保存权限'}</span>
          </Button>
        </div>

        {/* 继承角色权限选项 */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="inherit-role"
            checked={inheritRole}
            onCheckedChange={setInheritRole}
          />
          <Label htmlFor="inherit-role">
            继承角色默认权限
          </Label>
        </div>

        {/* 权限配置 */}
        {selectedUser && (
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
        )}
      </CardContent>
    </Card>
  );
}