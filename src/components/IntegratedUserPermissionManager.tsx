import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Settings, 
  Shield, 
  Building2,
  RefreshCw,
  Save
} from 'lucide-react';
import { UserManagement } from './permissions/UserManagement';
import { PermissionConfiguration } from './permissions/PermissionConfiguration';
import { RoleTemplateManager } from './permissions/RoleTemplateManager';
import { ContractPermissionManager } from './contracts/ContractPermissionManagerEnhanced';
import { PermissionQuickActions } from './PermissionQuickActions';
import { UserWithPermissions } from '@/types/index';
import { RoleTemplate } from '@/types/permission';

export function IntegratedUserPermissionManager() {
  const { toast } = useToast();
  const {
    loading,
    roleTemplates,
    users,
    userPermissions,
    hasChanges,
    setHasChanges,
    setRoleTemplates,
    setUserPermissions,
    savePermissions,
    loadAllData
  } = useOptimizedPermissions();
  
  // 状态管理
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // 合并用户和权限数据
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      const userPerms = userPermissions[user.id] || {};
      const roleTemplate = roleTemplates[user.role] || {};
      
      return {
        ...user,
        permissions: {
          menu: userPerms.menu_permissions || roleTemplate.menu_permissions || [],
          function: userPerms.function_permissions || roleTemplate.function_permissions || [],
          project: userPerms.project_permissions || roleTemplate.project_permissions || [],
          data: userPerms.data_permissions || roleTemplate.data_permissions || []
        }
      };
    });
  }, [users, userPermissions, roleTemplates]);

  // 保存权限
  const handleSavePermissions = async () => {
    try {
      await savePermissions(roleTemplates, Object.values(userPermissions).flat());
      toast({
        title: "保存成功",
        description: "权限配置已保存",
      });
      await loadAllData();
    } catch (error) {
      console.error('保存权限失败:', error);
      toast({
        title: "保存失败",
        description: "保存权限配置失败",
        variant: "destructive"
      });
    }
  };

  // 重新加载数据
  const handleLoadData = async () => {
    try {
      await loadAllData();
      toast({
        title: "重新加载成功",
        description: "数据已重新加载",
      });
    } catch (error) {
      console.error('重新加载失败:', error);
      toast({
        title: "重新加载失败",
        description: "重新加载数据失败",
        variant: "destructive"
      });
    }
  };

  // 更新用户权限
  const handleSetUserPermissions = (permissions: Record<string, any>) => {
    setUserPermissions(permissions);
    setHasChanges(true);
  };

  // 更新角色模板
  const handleUpdateRoleTemplates = async () => {
    await loadAllData();
  };

  // 更新用户数据
  const handleUserUpdate = async () => {
    await loadAllData();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载权限数据中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 快速操作面板 */}
      <PermissionQuickActions
        hasChanges={hasChanges}
        onSave={handleSavePermissions}
        onReload={handleLoadData}
        users={usersWithPermissions}
        selectedUsers={selectedUsers}
        onBulkPermissionUpdate={() => {}}
        onCopyPermissions={() => {}}
        onResetToRole={() => {}}
      />

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-gray-100">
          <TabsTrigger 
            value="users" 
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'users' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-200'
            }`}
          >
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger 
            value="permissions" 
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'permissions' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-200'
            }`}
          >
            <Shield className="h-4 w-4" />
            权限配置
          </TabsTrigger>
          <TabsTrigger 
            value="contracts" 
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'contracts' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-200'
            }`}
          >
            <Building2 className="h-4 w-4" />
            合同权限
          </TabsTrigger>
          <TabsTrigger 
            value="templates" 
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'templates' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-200'
            }`}
          >
            <Settings className="h-4 w-4" />
            角色模板
          </TabsTrigger>
        </TabsList>

        {/* 用户管理标签页 */}
        <TabsContent value="users" className="space-y-4">
          <UserManagement
            users={usersWithPermissions}
            loading={loading}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onUserUpdate={handleUserUpdate}
          />
        </TabsContent>

        {/* 权限配置标签页 */}
        <TabsContent value="permissions" className="space-y-4">
          <PermissionConfiguration
            users={usersWithPermissions}
            roleTemplates={roleTemplates}
            userPermissions={userPermissions}
            hasChanges={hasChanges}
            onSave={handleSavePermissions}
            onLoadData={handleLoadData}
            onSetHasChanges={setHasChanges}
            onSetUserPermissions={handleSetUserPermissions}
          />
        </TabsContent>

        {/* 合同权限管理标签页 */}
        <TabsContent value="contracts" className="space-y-4">
          <ContractPermissionManager 
            mode="global"
            onPermissionUpdate={() => {
              toast({
                title: "权限更新",
                description: "合同权限已更新",
              });
            }}
          />
        </TabsContent>

        {/* 角色模板标签页 */}
        <TabsContent value="templates" className="space-y-6">
          <RoleTemplateManager
            roleTemplates={roleTemplates}
            onUpdate={handleUpdateRoleTemplates}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}