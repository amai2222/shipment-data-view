// 权限模板和预设组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  BookTemplate, 
  Plus, 
  Edit, 
  Copy, 
  Trash2, 
  Download,
  Upload,
  Save,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROLES, MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';

interface PermissionTemplatesProps {
  roleTemplates: any[];
  onDataChange: () => void;
}

export function PermissionTemplates({ roleTemplates, onDataChange }: PermissionTemplatesProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // 新模板表单
  const [newTemplate, setNewTemplate] = useState({
    role: '',
    name: '',
    description: '',
    color: 'bg-blue-500',
    menu_permissions: [] as string[],
    function_permissions: [] as string[]
  });

  // 创建新模板
  const handleCreateTemplate = async () => {
    if (!newTemplate.role || !newTemplate.name) {
      toast({
        title: "错误",
        description: "请填写角色和名称",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('role_permission_templates')
        .insert({
          name: newTemplate.name,
          description: newTemplate.description,
          color: newTemplate.color,
          menu_permissions: newTemplate.menu_permissions,
          function_permissions: newTemplate.function_permissions,
          project_permissions: [],
          data_permissions: [],
          is_system: false,
          role: 'operator' as const
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限模板创建成功",
      });

      setCreateDialogOpen(false);
      setNewTemplate({
        role: '',
        name: '',
        description: '',
        color: 'bg-blue-500',
        menu_permissions: [],
        function_permissions: []
      });
      onDataChange();
    } catch (error) {
      console.error('创建模板失败:', error);
      toast({
        title: "错误",
        description: "创建模板失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 操作面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookTemplate className="h-5 w-5 mr-2" />
            权限模板管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建模板
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建权限模板</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">模板名称</Label>
                    <Input
                      id="name"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                      placeholder="输入模板名称"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">描述</Label>
                    <Input
                      id="description"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                      placeholder="输入模板描述"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateTemplate} disabled={loading}>
                      <Save className="h-4 w-4 mr-2" />
                      保存
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 模板列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roleTemplates.map(template => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${template.color || 'bg-gray-500'} mr-2`} />
                  <CardTitle className="text-lg">{template.name || template.role}</CardTitle>
                </div>
                <Badge variant={template.is_system ? "default" : "secondary"}>
                  {template.is_system ? "系统" : "自定义"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {template.description || '无描述'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>菜单权限:</span>
                  <Badge variant="outline">
                    {template.menu_permissions?.length || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>功能权限:</span>
                  <Badge variant="outline">
                    {template.function_permissions?.length || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}