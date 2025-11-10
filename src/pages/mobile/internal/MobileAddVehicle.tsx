// 移动端 - 添加车辆（车队长）

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
import { Truck, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const VEHICLE_TYPES = ['厢式货车', '平板车', '冷藏车', '自卸车', '牵引车', '其他'];
const VEHICLE_BRANDS = ['东风', '解放', '重汽', '福田', '江淮', '陕汽', '其他'];

export default function MobileAddVehicle() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    license_plate: '',
    vehicle_number: '',
    vehicle_type: '',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_status: 'active',
    load_capacity: '',
    manufacture_year: new Date().getFullYear().toString(),
    current_mileage: '0',
    driving_license_expire_date: '',
    insurance_expire_date: '',
    annual_inspection_date: '',
    remarks: ''
  });

  const handleSubmit = async () => {
    if (!formData.license_plate || !formData.vehicle_type) {
      toast({
        title: '请填写必填项',
        description: '车牌号和车辆类型为必填项',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('internal_vehicles')
        .insert([{
          license_plate: formData.license_plate,
          vehicle_number: formData.vehicle_number || null,
          vehicle_type: formData.vehicle_type,
          vehicle_brand: formData.vehicle_brand || null,
          vehicle_model: formData.vehicle_model || null,
          vehicle_status: formData.vehicle_status,
          load_capacity: formData.load_capacity ? parseFloat(formData.load_capacity) : null,
          manufacture_year: formData.manufacture_year ? parseInt(formData.manufacture_year) : null,
          current_mileage: formData.current_mileage ? parseInt(formData.current_mileage) : 0,
          driving_license_expire_date: formData.driving_license_expire_date || null,
          insurance_expire_date: formData.insurance_expire_date || null,
          annual_inspection_date: formData.annual_inspection_date || null,
          remarks: formData.remarks || null,
          is_active: true,
          fleet_manager_id: user?.id || null  // 自动关联当前车队长
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '添加成功',
        description: `车辆 ${formData.license_plate} 已添加`
      });

      navigate('/m/internal/vehicles');
    } catch (error: any) {
      console.error('添加失败:', error);
      toast({
        title: '添加失败',
        description: error.message || '无法添加车辆',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout title="添加车辆" showBack={true}>
      <div className="space-y-4 pb-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5" />
              车辆基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>车牌号 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.license_plate}
                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                placeholder="请输入车牌号"
                className="mt-1"
              />
            </div>

            <div>
              <Label>车辆编号</Label>
              <Input
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                placeholder="请输入车辆编号"
                className="mt-1"
              />
            </div>

            <div>
              <Label>车辆类型 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="请选择车辆类型" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>品牌</Label>
              <Select
                value={formData.vehicle_brand}
                onValueChange={(value) => setFormData({ ...formData, vehicle_brand: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="请选择品牌" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_BRANDS.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>型号</Label>
              <Input
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                placeholder="请输入车辆型号"
                className="mt-1"
              />
            </div>

            <div>
              <Label>载重（吨）</Label>
              <Input
                type="number"
                value={formData.load_capacity}
                onChange={(e) => setFormData({ ...formData, load_capacity: e.target.value })}
                placeholder="请输入载重"
                className="mt-1"
              />
            </div>

            <div>
              <Label>生产年份</Label>
              <Input
                type="number"
                value={formData.manufacture_year}
                onChange={(e) => setFormData({ ...formData, manufacture_year: e.target.value })}
                placeholder="请输入生产年份"
                className="mt-1"
              />
            </div>

            <div>
              <Label>当前里程（公里）</Label>
              <Input
                type="number"
                value={formData.current_mileage}
                onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value })}
                placeholder="请输入当前里程"
                className="mt-1"
              />
            </div>

            <div>
              <Label>车辆状态</Label>
              <Select
                value={formData.vehicle_status}
                onValueChange={(value) => setFormData({ ...formData, vehicle_status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="maintenance">维修中</SelectItem>
                  <SelectItem value="retired">已报废</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">证件信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>行驶证到期日</Label>
              <Input
                type="date"
                value={formData.driving_license_expire_date}
                onChange={(e) => setFormData({ ...formData, driving_license_expire_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>保险到期日</Label>
              <Input
                type="date"
                value={formData.insurance_expire_date}
                onChange={(e) => setFormData({ ...formData, insurance_expire_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label>年检到期日</Label>
              <Input
                type="date"
                value={formData.annual_inspection_date}
                onChange={(e) => setFormData({ ...formData, annual_inspection_date: e.target.value })}
                className="mt-1"
              />
            </div>
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

