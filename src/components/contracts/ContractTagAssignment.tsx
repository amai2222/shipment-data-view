import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, X, Edit } from 'lucide-react';

interface ContractTag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_system: boolean;
}

interface ContractTagAssignmentProps {
  contractId: string;
  contractNumber?: string;
  onTagUpdate?: () => void;
}

export function ContractTagAssignment({ contractId, contractNumber, onTagUpdate }: ContractTagAssignmentProps) {
  const [availableTags, setAvailableTags] = useState<ContractTag[]>([]);
  const [assignedTags, setAssignedTags] = useState<ContractTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  useEffect(() => {
    if (contractId) {
      loadTags();
      loadAssignedTags();
    }
  }, [contractId]);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('Error loading tags:', error);
      toast({
        title: "错误",
        description: "加载标签失败",
        variant: "destructive",
      });
    }
  };

  const loadAssignedTags = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_tag_relations')
        .select(`
          contract_tags(*)
        `)
        .eq('contract_id', contractId);

      if (error) throw error;
      
      const tags = (data || []).map((relation: any) => relation.contract_tags);
      setAssignedTags(tags);
    } catch (error) {
      console.error('Error loading assigned tags:', error);
      toast({
        title: "错误",
        description: "加载已分配标签失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    const assignedTagIds = new Set(assignedTags.map(tag => tag.id));
    setSelectedTags(assignedTagIds);
    setShowDialog(true);
  };

  const handleTagToggle = (tagId: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTags(newSelected);
  };

  const handleSaveTags = async () => {
    try {
      // 删除所有现有标签关联
      const { error: deleteError } = await supabase
        .from('contract_tag_relations')
        .delete()
        .eq('contract_id', contractId);

      if (deleteError) throw deleteError;

      // 添加新选择的标签关联
      if (selectedTags.size > 0) {
        const relations = Array.from(selectedTags).map(tagId => ({
          contract_id: contractId,
          tag_id: tagId
        }));

        const { error: insertError } = await supabase
          .from('contract_tag_relations')
          .insert(relations);

        if (insertError) throw insertError;
      }

      toast({
        title: "成功",
        description: "标签分配已更新",
      });

      setShowDialog(false);
      loadAssignedTags();
      onTagUpdate?.();
    } catch (error) {
      console.error('Error saving tags:', error);
      toast({
        title: "错误",
        description: "保存标签失败",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const { error } = await supabase
        .from('contract_tag_relations')
        .delete()
        .eq('contract_id', contractId)
        .eq('tag_id', tagId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "标签已移除",
      });

      loadAssignedTags();
      onTagUpdate?.();
    } catch (error) {
      console.error('Error removing tag:', error);
      toast({
        title: "错误",
        description: "移除标签失败",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            合同标签
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleOpenDialog}>
                <Plus className="h-4 w-4 mr-2" />
                管理标签
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>分配标签</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {availableTags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag.id}
                        checked={selectedTags.has(tag.id)}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                      />
                      <label
                        htmlFor={tag.id}
                        className="flex items-center space-x-2 cursor-pointer flex-1"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                        {tag.description && (
                          <span className="text-xs text-muted-foreground">
                            - {tag.description}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleSaveTags}>
                    保存
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {assignedTags.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            暂无标签
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedTags.map(tag => (
              <div key={tag.id} className="flex items-center space-x-1">
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveTag(tag.id)}
                  className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
