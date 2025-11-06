import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Save, X, Settings } from 'lucide-react';

interface ContractNumberingRule {
  id: string;
  category: '行政合同' | '内部合同' | '业务合同';
  prefix: string;
  format: string;
  current_sequence: number;
  year: number;
  month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ContractNumberingManagerProps {
  onRuleUpdate?: () => void;
}

export function ContractNumberingManager({ onRuleUpdate }: ContractNumberingManagerProps) {
  const [rules, setRules] = useState<ContractNumberingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ContractNumberingRule | null>(null);
  const [formData, setFormData] = useState({
    category: '业务合同' as '行政合同' | '内部合同' | '业务合同',
    prefix: '',
    format: '{prefix}-{year}-{month}-{sequence}',
    current_sequence: 0
  });

  const { toast } = useToast();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_numbering_rules')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        console.error('Database error:', error);
        // 如果表不存在，返回空数组而不是抛出错误
        if (error.message.includes('relation "contract_numbering_rules" does not exist')) {
          setRules([]);
          return;
        }
        throw error;
      }
      setRules(data || []);
    } catch (error) {
      console.error('Error loading numbering rules:', error);
      toast({
        title: "错误",
        description: "加载编号规则失败，请检查数据库连接",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.prefix) {
      toast({
        title: "错误",
        description: "请输入前缀",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingRule) {
        // 更新现有规则
        const { error } = await supabase
          .from('contract_numbering_rules')
          .update({
            prefix: formData.prefix,
            format: formData.format,
            current_sequence: formData.current_sequence,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', editingRule.id);

        if (error) throw error;

        toast({
          title: "成功",
          description: "编号规则更新成功",
        });
      } else {
        // 创建新规则
        const { error } = await supabase
          .from('contract_numbering_rules')
          .insert([{
            category: formData.category,
            prefix: formData.prefix,
            format: formData.format,
            current_sequence: formData.current_sequence,
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1
          }] as any);

        if (error) throw error;

        toast({
          title: "成功",
          description: "编号规则创建成功",
        });
      }

      setShowForm(false);
      setEditingRule(null);
      setFormData({
        category: '业务合同',
        prefix: '',
        format: '{prefix}-{year}-{month}-{sequence}',
        current_sequence: 0
      });
      loadRules();
      onRuleUpdate?.();
    } catch (error) {
      console.error('Error saving numbering rule:', error);
      toast({
        title: "错误",
        description: "保存编号规则失败",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (rule: ContractNumberingRule) => {
    setEditingRule(rule);
    setFormData({
      category: rule.category,
      prefix: rule.prefix,
      format: rule.format,
      current_sequence: rule.current_sequence
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRule(null);
    setFormData({
      category: '业务合同',
      prefix: '',
      format: '{prefix}-{year}-{month}-{sequence}',
      current_sequence: 0
    });
  };

  const generateSampleNumber = (rule: ContractNumberingRule) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const nextSequence = rule.current_sequence + 1;
    
    let sample = rule.format;
    sample = sample.replace('{prefix}', rule.prefix);
    sample = sample.replace('{year}', currentYear.toString().padStart(4, '0'));
    sample = sample.replace('{month}', currentMonth.toString().padStart(2, '0'));
    sample = sample.replace('{sequence}', nextSequence.toString().padStart(3, '0'));
    
    return sample;
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case '行政合同': return 'secondary';
      case '内部合同': return 'outline';
      case '业务合同': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">合同编号管理</h2>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增规则
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? '编辑编号规则' : '新增编号规则'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="category">合同分类</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: '行政合同' | '内部合同' | '业务合同') =>
                    setFormData(prev => ({ ...prev, category: value }))
                  }
                  disabled={!!editingRule}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="行政合同">行政合同</SelectItem>
                    <SelectItem value="内部合同">内部合同</SelectItem>
                    <SelectItem value="业务合同">业务合同</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prefix">前缀 *</Label>
                <Input
                  id="prefix"
                  placeholder="输入前缀，如 XZ、NB、YW"
                  value={formData.prefix}
                  onChange={(e) => setFormData(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="format">编号格式</Label>
                <Input
                  id="format"
                  placeholder="{prefix}-{year}-{month}-{sequence}"
                  value={formData.format}
                  onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  可用变量: {'{prefix}'}, {'{year}'}, {'{month}'}, {'{sequence}'}
                </p>
              </div>

              <div>
                <Label htmlFor="current_sequence">当前序号</Label>
                <Input
                  id="current_sequence"
                  type="number"
                  min="0"
                  value={formData.current_sequence}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_sequence: parseInt(e.target.value) || 0 }))}
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
            <Settings className="h-5 w-5 mr-2" />
            编号规则列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无编号规则
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同分类</TableHead>
                  <TableHead>前缀</TableHead>
                  <TableHead>编号格式</TableHead>
                  <TableHead>当前序号</TableHead>
                  <TableHead>示例编号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(rule.category)}>
                        {rule.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{rule.prefix}</TableCell>
                    <TableCell className="font-mono text-sm">{rule.format}</TableCell>
                    <TableCell>{rule.current_sequence}</TableCell>
                    <TableCell className="font-mono text-sm text-blue-600">
                      {generateSampleNumber(rule)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
