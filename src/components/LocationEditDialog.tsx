import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { SupabaseStorage } from '@/utils/supabase';

interface LocationEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (locationId: string) => void;
  projectId: string; // 当前项目ID，用于自动关联
  initialName?: string; // 初始名称（从搜索框输入）
}

export function LocationEditDialog({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  initialName = ''
}: LocationEditDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  // 当对话框打开或初始名称变化时，更新表单
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName,
        nickname: '',
        address: ''
      });
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "请填写地点名称",
        description: "地点名称是必填的",
        variant: "destructive",
      });
      return;
    }

    if (!projectId) {
      toast({
        title: "错误",
        description: "请先选择项目",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 1. 创建地点
      const newLocation = await SupabaseStorage.addLocation({
        name: formData.name.trim(),
        nickname: formData.nickname?.trim() || undefined,
        projectIds: [projectId] // 自动关联到当前项目
      });

      // 2. 如果有地址，更新地址字段（但不进行地理编码，因为这是简化版本）
      if (formData.address.trim()) {
        const { error: updateError } = await supabase
          .from('locations')
          .update({ address: formData.address.trim() })
          .eq('id', newLocation.id);

        if (updateError) {
          console.error('更新地址失败:', updateError);
        }
      }

      toast({
        title: "创建成功",
        description: "地点已创建并关联到项目",
      });

      onSuccess(newLocation.id);
      onClose();
    } catch (error) {
      console.error('创建地点失败:', error);
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : "无法创建地点",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>创建新地点</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">地点名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入地点名称"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">昵称 (可选)</Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder="请输入地点昵称"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">详细地址 (可选)</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="请输入详细地址（用于地理编码）"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '创建中...' : '确定'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

