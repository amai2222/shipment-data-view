import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Save, X, Tag, Trash2 } from 'lucide-react';

interface ContractTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

interface ContractTagManagerProps {
  onTagUpdate?: () => void;
}

export function ContractTagManager({ onTagUpdate }: ContractTagManagerProps) {
  const [tags, setTags] = useState<ContractTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ContractTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    description: ''
  });

  const { toast } = useToast();

  const predefinedColors = [
    '#EF4444', // 红色
    '#F59E0B', // 橙色
    '#EAB308', // 黄色
    '#10B981', // 绿色
    '#3B82F6', // 蓝色
    '#8B5CF6', // 紫色
    '#EC4899', // 粉色
    '#6B7280', // 灰色
    '#F97316', // 橙红色
    '#84CC16', // 青绿色
  ];

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_tags')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast({
        title: "错误",
        description: "加载标签失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "错误",
        description: "请输入标签名称",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTag) {
        // 更新现有标签
        const { error } = await supabase
          .from('contract_tags')
          .update({
            name: formData.name.trim(),
            color: formData.color,
            description: formData.description.trim() || null
          } as any)
          .eq('id', editingTag.id);

        if (error) throw error;

        toast({
          title: "成功",
          description: "标签更新成功",
        });
      } else {
        // 创建新标签
        const { error } = await supabase
          .from('contract_tags')
          .insert([{
            name: formData.name.trim(),
            color: formData.color,
            description: formData.description.trim() || null,
            is_system: false
          }] as any);

        if (error) throw error;

        toast({
          title: "成功",
          description: "标签创建成功",
        });
      }

      setShowForm(false);
      setEditingTag(null);
      setFormData({
        name: '',
        color: '#3B82F6',
        description: ''
      });
      loadTags();
      onTagUpdate?.();
    } catch (error) {
      console.error('Error saving tag:', error);
      toast({
        title: "错误",
        description: "保存标签失败",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (tag: ContractTag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (tag: ContractTag) => {
    if (tag.is_system) {
      toast({
        title: "错误",
        description: "系统标签不能删除",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`确定要删除标签 "${tag.name}" 吗？`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_tags')
        .delete()
        .eq('id', tag.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "标签删除成功",
      });

      loadTags();
      onTagUpdate?.();
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({
        title: "错误",
        description: "删除标签失败",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTag(null);
    setFormData({
      name: '',
      color: '#3B82F6',
      description: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">合同标签管理</h2>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增标签
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTag ? '编辑标签' : '新增标签'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">标签名称 *</Label>
                <Input
                  id="name"
                  placeholder="输入标签名称"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label>标签颜色</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="mt-2 w-20 h-10"
                />
              </div>

              <div>
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="输入标签描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            标签列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无标签
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          style={{ 
                            backgroundColor: tag.color + '20',
                            borderColor: tag.color,
                            color: tag.color
                          }}
                        >
                          {tag.name}
                        </Badge>
                        {tag.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            系统
                          </Badge>
                        )}
                      </div>
                      {tag.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {tag.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(tag)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {!tag.is_system && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(tag)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
