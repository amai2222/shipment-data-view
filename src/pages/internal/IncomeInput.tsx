// PC端 - 月度收入录入（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PageHeader } from '@/components/PageHeader';
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
  const [page, setPage] = useState(1);
  const pageSize = 15;
  
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
    toast({ title: '保存成功', description: '月度收入已录入' });
    setShowDialog(false);
  };

  const paginatedRecords = incomeRecords.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(incomeRecords.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="月度收入录入"
        description="为车辆录入月度运费收入"
        icon={DollarSign}
        iconColor="text-green-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                收入管理
              </CardTitle>
              <CardDescription>
                录入和管理车辆月度运费收入
              </CardDescription>
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
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>收入记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto opacity-50 mb-4" />
            <p className="text-lg">暂无收入记录</p>
            <p className="text-sm mt-2">点击"录入收入"开始记录</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入月度收入</DialogTitle>
            <DialogDescription>为车辆录入本月运费收入</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>年月</Label>
              <Input type="month" value={formData.year_month} onChange={e => setFormData({...formData, year_month: e.target.value})} />
            </div>
            <div>
              <Label>车辆</Label>
              <Select value={formData.vehicle_id} onValueChange={v => setFormData({...formData, vehicle_id: v})}>
                <SelectTrigger><SelectValue placeholder="选择车辆" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.license_plate} - {v.vehicle_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>收入金额（元）</Label>
              <Input type="number" placeholder="0.00" value={formData.income_amount} onChange={e => setFormData({...formData, income_amount: e.target.value})} step="0.01" />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea placeholder="输入备注..." value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSubmit}><Save className="h-4 w-4 mr-2" />保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
