// PC端 - 月度收入录入
// 功能：为车辆录入月度运费收入

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import {
  DollarSign,
  Plus,
  Truck,
  Calendar,
  RefreshCw,
  Save
} from 'lucide-react';
import { format } from 'date-fns';

export default function IncomeInput() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    year_month: format(new Date(), 'yyyy-MM'),
    project_id: '',
    income_amount: '',
    remarks: ''
  });

  useEffect(() => {
    loadVehicles();
    loadProjects();
  }, []);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('internal_vehicles')
      .select('id, license_plate, vehicle_type')
      .eq('is_active', true)
      .order('license_plate');
    setVehicles(data || []);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');
    setProjects(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.vehicle_id || !formData.income_amount) {
      toast({
        title: '请完整填写',
        description: '请选择车辆并输入收入金额',
        variant: 'destructive'
      });
      return;
    }

    try {
      // TODO: 调用保存RPC函数
      toast({
        title: '保存成功',
        description: '月度收入已录入'
      });

      setShowDialog(false);
      setFormData({
        vehicle_id: '',
        year_month: format(new Date(), 'yyyy-MM'),
        project_id: '',
        income_amount: '',
        remarks: ''
      });
    } catch (error) {
      toast({
        title: '保存失败',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="月度收入录入"
        description="为车辆录入月度运费收入"
        icon={DollarSign}
        iconColor="text-green-600"
      >
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          录入收入
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>本月收入汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            功能开发中...
          </div>
        </CardContent>
      </Card>

      {/* 录入对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入月度收入</DialogTitle>
            <DialogDescription>
              为车辆录入本月运费收入
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>年月</Label>
              <Input
                type="month"
                value={formData.year_month}
                onChange={e => setFormData({...formData, year_month: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>车辆</Label>
              <Select value={formData.vehicle_id} onValueChange={v => setFormData({...formData, vehicle_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择车辆" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.license_plate} - {v.vehicle_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>项目来源（可选）</Label>
              <Select value={formData.project_id} onValueChange={v => setFormData({...formData, project_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>收入金额（元）</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.income_amount}
                onChange={e => setFormData({...formData, income_amount: e.target.value})}
                step="0.01"
              />
            </div>

            <div className="grid gap-2">
              <Label>备注</Label>
              <Textarea
                placeholder="输入备注..."
                value={formData.remarks}
                onChange={e => setFormData({...formData, remarks: e.target.value})}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

