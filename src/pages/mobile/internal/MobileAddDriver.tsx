// 移动端 - 添加司机（车队长）

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { User, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const SALARY_TYPES = [
  { value: 'monthly', label: '月薪制', description: '固定月薪' },
  { value: 'trip_based', label: '计次制', description: '按趟次计费+提成' },
  { value: 'commission', label: '提成制', description: '纯提成' }
];

export default function MobileAddDriver() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    id_card_number: '',
    hire_date: format(new Date(), 'yyyy-MM-dd'),
    employment_status: 'active',
    base_salary: '5000',
    salary_calculation_type: 'monthly',
    commission_rate: '10',
    remarks: ''
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      toast({
        title: '请填写必填项',
        description: '姓名和电话为必填项',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('internal_drivers')
        .insert([{
          name: formData.name,
          phone: formData.phone,
          id_card_number: formData.id_card_number || null,
          hire_date: formData.hire_date,
          employment_status: formData.employment_status,
          base_salary: parseFloat(formData.base_salary),
          salary_calculation_type: formData.salary_calculation_type,
          commission_rate: formData.salary_calculation_type === 'monthly' ? null : parseFloat(formData.commission_rate),
          remarks: formData.remarks || null,
          fleet_manager_id: user?.id || null  // 自动关联当前车队长
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '添加成功',
        description: `司机 ${formData.name} 已添加`
      });

      navigate('/m/internal/drivers');
    } catch (error: any) {
      console.error('添加失败:', error);
      toast({
        title: '添加失败',
        description: error.message || '无法添加司机',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="添加司机" showBack={true}>
      <div className="space-y-4 pb-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>姓名 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入司机姓名"
                className="mt-1"
              />
            </div>

            <div>
              <Label>电话 <span className="text-red-500">*</span></Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入联系电话"
                className="mt-1"
              />
            </div>

            <div>
              <Label>身份证号</Label>
              <Input
                value={formData.id_card_number}
                onChange={(e) => setFormData({ ...formData, id_card_number: e.target.value })}
                placeholder="请输入身份证号"
                className="mt-1"
              />
            </div>

            <div>
              <Label>入职日期</Label>
              <Input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>在职状态</Label>
              <Select
                value={formData.employment_status}
                onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">在职</SelectItem>
                  <SelectItem value="on_leave">请假</SelectItem>
                  <SelectItem value="resigned">离职</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">薪资信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>工资制度</Label>
              <Select
                value={formData.salary_calculation_type}
                onValueChange={(value) => setFormData({ ...formData, salary_calculation_type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>基本工资（元）</Label>
              <Input
                type="number"
                value={formData.base_salary}
                onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                placeholder="请输入基本工资"
                className="mt-1"
              />
            </div>

            {formData.salary_calculation_type !== 'monthly' && (
              <div>
                <Label>提成比例（%）</Label>
                <Input
                  type="number"
                  value={formData.commission_rate}
                  onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  placeholder="请输入提成比例"
                  className="mt-1"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="请输入备注信息"
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 bg-white border-t p-4 space-y-2">
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={saving}
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}

