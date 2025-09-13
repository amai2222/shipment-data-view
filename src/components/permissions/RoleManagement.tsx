// 角色管理组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, Save } from 'lucide-react';
import { ROLES } from '@/config/permissions';
import { supabase } from '@/integrations/supabase/client';

interface RoleManagementProps {
  roleTemplates: any[];
  onDataChange: () => void;
}

export function RoleManagement({ roleTemplates, onDataChange }: RoleManagementProps) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [saving, setSaving] = useState(false);

  // 保存角色权限
  const handleSaveRolePermissions = async () => {
    try {
      setSaving(true);
      
      const existingTemplate = roleTemplates.find(t => t.role === selectedRole);
      
      const permissionData = {
        name: ROLES[selectedRole as keyof typeof ROLES]?.label || selectedRole,
        description: ROLES[selectedRole as keyof typeof ROLES]?.description || '',
        color: ROLES[selectedRole as keyof typeof ROLES]?.color || 'bg-gray-500',
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: [],
        is_system: true,
        role: selectedRole as 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer'
      };

      if (existingTemplate) {
        // 更新现有模板
        const { error } = await supabase
          .from('role_permission_templates')
          .update(permissionData)
          .eq('id', existingTemplate.id);

        if (error) throw error;
      } else {
        // 创建新模板
        const { error } = await supabase
          .from('role_permission_templates')
          .insert(permissionData);

        if (error) throw error;
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