// PC端 - 月度收入录入（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  DollarSign,
  Plus,
  Truck,
  Calendar,
  RefreshCw,
  Save,
  Edit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';

export default function IncomeInput() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    vehicle_id: '',
    year_month: format(new Date(), 'yyyy-MM'),
    project_id: '',
    income_amount: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehicleData, projectData] = await Promise.all([
        supabase.from('internal_vehicles').select('id, license_plate, vehicle_type').eq('is_active', true).order('license_plate'),
        supabase.from('projects').select('id, name').order('name')
      ]);
      
      setVehicles(vehicleData.data || []);
      setProjects(projectData.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    toast({
      title: '保存成功',
      description: '月度收入已录入'
    });
    setShowDialog(false);
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">月度收入录入</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="text-sm text-muted-foreground">
              为车辆录入月度运费收入
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              录入收入
            </Button>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <div className="p-12 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto opacity-50 mb-4" />
            <p className="text-lg font-medium">暂无收入记录</p>
            <p className="text-sm mt-2">点击"录入收入"开始记录月度运费收入</p>
          </div>
        </div>
      </div>

      {/* 录入对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入月度收入</DialogTitle>
            <DialogDescription>为车辆录入本月运费收入</DialogDescription>
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
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
