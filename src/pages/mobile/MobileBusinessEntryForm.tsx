import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ExternalTrackingNumber } from '@/types';

interface Driver {
  id: string;
  name: string;
  license_plate: string | null;
  phone: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface PartnerChain {
  id: string;
  chain_name: string;
  billing_type_id: number | null;
  is_default: boolean;
}

interface FormData {
  projectId: string;
  chainId: string;
  driverId: string;
  loadingLocationId: string;
  unloadingLocationId: string;
  loadingDate: Date | undefined;
  unloadingDate: Date | undefined;
  licensePlate: string;
  driverPhone: string;
  loading_weight: string;
  unloading_weight: string;
  transportType: string;
  currentCost: string;
  extraCost: string;
  remarks: string;
  external_tracking_numbers: string[];
  other_platform_names: string[];
}

const INITIAL_FORM_DATA: FormData = {
  projectId: '',
  chainId: '',
  driverId: '',
  loadingLocationId: '',
  unloadingLocationId: '',
  loadingDate: new Date(),
  unloadingDate: new Date(),
  licensePlate: '',
  driverPhone: '',
  loading_weight: '',
  unloading_weight: '',
  transportType: '实际运输',
  currentCost: '',
  extraCost: '',
  remarks: '',
  external_tracking_numbers: [],
  other_platform_names: [],
};

export default function MobileBusinessEntryForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chains, setChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const selectedChain = useMemo(() => chains.find(c => c.id === formData.chainId), [chains, formData.chainId]);
  const billingTypeId = selectedChain?.billing_type_id || 1;

  const quantityLabel = useMemo(() => {
    if (billingTypeId === 2) return '发车次数';
    if (billingTypeId === 3) return '体积(立方)';
    return '重量(吨)';
  }, [billingTypeId]);

  const driverReceivable = useMemo(() => {
    const current = parseFloat(formData.currentCost) || 0;
    const extra = parseFloat(formData.extraCost) || 0;
    return current + extra;
  }, [formData.currentCost, formData.extraCost]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isEditing && id) {
      loadRecordForEditing(id);
    }
  }, [isEditing, id]);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectSpecificData(formData.projectId);
    } else {
      setChains([]);
      setDrivers([]);
      setLocations([]);
      setFormData(prev => ({ ...prev, chainId: '', driverId: '', loadingLocationId: '', unloadingLocationId: '' }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (chains.length > 0 && !isEditing) {
      const defaultChain = chains.find(c => c.is_default);
      if (defaultChain) {
        setFormData(prev => ({ ...prev, chainId: defaultChain.id }));
      }
    }
  }, [chains, isEditing]);

  const loadInitialData = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .limit(100);

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "加载失败",
        description: "无法加载项目列表",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const loadRecordForEditing = async (recordId: string) => {
    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          projectId: data.project_id || '',
          chainId: data.chain_id || '',
          driverId: data.driver_id || '',
          loadingLocationId: data.loading_location || '',
          unloadingLocationId: data.unloading_location || '',
          loadingDate: data.loading_date ? new Date(data.loading_date) : new Date(),
          unloadingDate: data.unloading_date ? new Date(data.unloading_date) : new Date(),
          licensePlate: data.license_plate || '',
          driverPhone: data.driver_phone || '',
          loading_weight: data.loading_weight?.toString() || '',
          unloading_weight: data.unloading_weight?.toString() || '',
          transportType: data.transport_type || '实际运输',
          currentCost: data.current_cost?.toString() || '',
          extraCost: data.extra_cost?.toString() || '',
          remarks: data.remarks || '',
          external_tracking_numbers: data.external_tracking_numbers || [],
          other_platform_names: data.other_platform_names || [],
        });
      }
    } catch (error) {
      console.error('Error loading record:', error);
      toast({
        title: "加载失败",
        description: "无法加载运单信息",
        variant: "destructive",
      });
      navigate('/m/business-entry');
    }
  };

  const loadProjectSpecificData = async (projectId: string) => {
    try {
      const [driversRes, locationsRes, chainsRes] = await Promise.all([
        supabase.from('drivers').select('*').limit(100),
        supabase.from('locations').select('*').limit(100),
        supabase.from('partner_chains').select('id, chain_name, billing_type_id, is_default').eq('project_id', projectId)
      ]);

      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (chainsRes.error) throw chainsRes.error;

      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
      setChains(chainsRes.data || []);
    } catch (error) {
      console.error('Error loading project data:', error);
      toast({
        title: "错误",
        description: "加载项目关联数据失败",
        variant: "destructive",
      });
    }
  };

  const handleDriverSelect = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData(prev => ({
      ...prev,
      driverId: driverId,
      licensePlate: driver?.license_plate || '',
      driverPhone: driver?.phone || ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId || !formData.driverId || !formData.loadingLocationId || !formData.unloadingLocationId || !formData.loadingDate) {
      toast({
        title: "验证失败",
        description: "项目、司机和地点等必填项不能为空。",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isEditing && id) {
        // 使用数据库函数来更新运单并重新计算合作方成本
        const { error } = await supabase.rpc('update_logistics_record_via_recalc', {
          p_record_id: id,
          p_project_id: formData.projectId,
          p_project_name: projects.find(p => p.id === formData.projectId)?.name || '',
          p_chain_id: formData.chainId,
          p_driver_id: formData.driverId,
          p_driver_name: drivers.find(d => d.id === formData.driverId)?.name || '',
          p_loading_location: locations.find(l => l.id === formData.loadingLocationId)?.name || '',
          p_unloading_location: locations.find(l => l.id === formData.unloadingLocationId)?.name || '',
          p_loading_date: formData.loadingDate?.toISOString() || '',
          p_loading_weight: parseFloat(formData.loading_weight) || 0,
          p_unloading_weight: parseFloat(formData.unloading_weight) || 0,
          p_current_cost: parseFloat(formData.currentCost) || 0,
          p_license_plate: formData.licensePlate,
          p_driver_phone: formData.driverPhone,
          p_transport_type: formData.transportType,
          p_extra_cost: parseFloat(formData.extraCost) || 0,
          p_remarks: formData.remarks,
          p_unloading_date: formData.unloadingDate?.toISOString() || ''
        });

        if (error) throw error;
        
        // 更新平台字段
        const validExternalTrackingNumbers = formData.external_tracking_numbers.filter(
          trackingNumber => trackingNumber && trackingNumber.trim() !== ''
        );
        const validOtherPlatformNames = formData.other_platform_names.filter(
          name => name && name.trim() !== ''
        );
        
        if (validExternalTrackingNumbers.length > 0 || validOtherPlatformNames.length > 0) {
          const { error: platformError } = await supabase
            .from('logistics_records')
            .update({ 
              external_tracking_numbers: validExternalTrackingNumbers.length > 0 ? validExternalTrackingNumbers : null,
              other_platform_names: validOtherPlatformNames.length > 0 ? validOtherPlatformNames : null
            })
            .eq('id', id);
          if (platformError) throw platformError;
        }
        
        toast({ title: "成功", description: "运单已更新" });
      } else {
        // Create new record
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
        const timeStr = Math.floor(Date.now() / 1000).toString().slice(-5);
        const autoNumber = `YDN${dateStr}-${timeStr}`;

        // 使用数据库函数来添加运单并自动计算合作方成本
        const { error } = await supabase.rpc('add_logistics_record_with_costs', {
          p_project_id: formData.projectId,
          p_project_name: projects.find(p => p.id === formData.projectId)?.name || '',
          p_chain_id: formData.chainId,
          p_driver_id: formData.driverId,
          p_driver_name: drivers.find(d => d.id === formData.driverId)?.name || '',
          p_loading_location: locations.find(l => l.id === formData.loadingLocationId)?.name || '',
          p_unloading_location: locations.find(l => l.id === formData.unloadingLocationId)?.name || '',
          p_loading_date: formData.loadingDate?.toISOString().split('T')[0] || '',
          p_loading_weight: parseFloat(formData.loading_weight) || 0,
          p_unloading_weight: parseFloat(formData.unloading_weight) || 0,
          p_current_cost: parseFloat(formData.currentCost) || 0,
          p_license_plate: formData.licensePlate,
          p_driver_phone: formData.driverPhone,
          p_transport_type: formData.transportType,
          p_extra_cost: parseFloat(formData.extraCost) || 0,
          p_remarks: formData.remarks,
          p_unloading_date: formData.unloadingDate?.toISOString().split('T')[0] || ''
        });

        if (error) throw error;
        
        // 获取新创建的运单ID并更新平台字段
        const { data: newRecord } = await supabase
          .from('logistics_records')
          .select('id')
          .eq('auto_number', autoNumber)
          .single();
          
        if (newRecord && (formData.external_tracking_numbers?.length > 0 || formData.other_platform_names?.length > 0)) {
          const validExternalTrackingNumbers = formData.external_tracking_numbers.filter(
            trackingNumber => trackingNumber && trackingNumber.trim() !== ''
          );
          const validOtherPlatformNames = formData.other_platform_names.filter(
            name => name && name.trim() !== ''
          );
          
          if (validExternalTrackingNumbers.length > 0 || validOtherPlatformNames.length > 0) {
            const { error: updateError } = await supabase
              .from('logistics_records')
              .update({ 
                external_tracking_numbers: validExternalTrackingNumbers.length > 0 ? validExternalTrackingNumbers : null,
                other_platform_names: validOtherPlatformNames.length > 0 ? validOtherPlatformNames : null
              })
              .eq('id', newRecord.id);
            if (updateError) throw updateError;
          }
        }
        
        toast({ title: "成功", description: "运单已创建" });
      }

      navigate('/m/business-entry');
    } catch (error: any) {
      console.error('Error saving record:', error);
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/m/business-entry')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">
          {isEditing ? '编辑运单' : '新增运单'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 项目选择 */}
        <div className="space-y-2">
          <Label htmlFor="project">项目 *</Label>
          <Select 
            value={formData.projectId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 合作链路 */}
        <div className="space-y-2">
          <Label htmlFor="chain">合作链路</Label>
          <Select 
            value={formData.chainId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, chainId: value }))}
            disabled={!formData.projectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择合作链路" />
            </SelectTrigger>
            <SelectContent>
              {chains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id}>
                  {chain.chain_name}{chain.is_default ? ' (默认)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 日期选择 */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label>装货日期 *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.loadingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.loadingDate ? format(formData.loadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.loadingDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, loadingDate: date }))}
                  initialFocus
                  locale={zhCN}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>卸货日期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.unloadingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.unloadingDate ? format(formData.unloadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.unloadingDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, unloadingDate: date }))}
                  initialFocus
                  locale={zhCN}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 司机信息 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver">司机 *</Label>
            <Select 
              value={formData.driverId} 
              onValueChange={handleDriverSelect}
              disabled={!formData.projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择司机" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name} - {driver.license_plate || '无车牌'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="licensePlate">车牌号</Label>
            <Input
              id="licensePlate"
              value={formData.licensePlate}
              onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))}
              placeholder="选择司机后自动填充"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverPhone">司机电话</Label>
            <Input
              id="driverPhone"
              value={formData.driverPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, driverPhone: e.target.value }))}
              placeholder="选择司机后自动填充"
            />
          </div>
        </div>

        {/* 运输类型 */}
        <div className="space-y-2">
          <Label htmlFor="transportType">运输类型</Label>
          <Select 
            value={formData.transportType} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, transportType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="实际运输">实际运输</SelectItem>
              <SelectItem value="退货">退货</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 地点选择 */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loadingLocation">装货地点 *</Label>
            <Select 
              value={formData.loadingLocationId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, loadingLocationId: value }))}
              disabled={!formData.projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择装货地点" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unloadingLocation">卸货地点 *</Label>
            <Select 
              value={formData.unloadingLocationId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, unloadingLocationId: value }))}
              disabled={!formData.projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择卸货地点" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 数量信息 */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="loadingWeight">装货{quantityLabel} *</Label>
            <Input
              id="loadingWeight"
              type="number"
              step="0.01"
              value={formData.loading_weight}
              onChange={(e) => setFormData(prev => ({ ...prev, loading_weight: e.target.value }))}
              placeholder={`输入装货${quantityLabel}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unloadingWeight">卸货{quantityLabel}</Label>
            <Input
              id="unloadingWeight"
              type="number"
              step="0.01"
              value={formData.unloading_weight}
              onChange={(e) => setFormData(prev => ({ ...prev, unloading_weight: e.target.value }))}
              placeholder={`输入卸货${quantityLabel}`}
            />
          </div>
        </div>

        {/* 费用信息 */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="currentCost">运费(元) *</Label>
            <Input
              id="currentCost"
              type="number"
              step="0.01"
              min="0"
              value={formData.currentCost}
              onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))}
              placeholder="输入运费"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="extraCost">额外费(元)</Label>
            <Input
              id="extraCost"
              type="number"
              step="0.01"
              value={formData.extraCost}
              onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))}
              placeholder="输入额外费用，支持负数"
            />
          </div>
        </div>

        {/* 司机应收显示 */}
        <div className="bg-muted p-3 rounded-lg">
          <Label className="font-semibold">司机应收(元)</Label>
          <div className="text-lg font-bold text-primary mt-1">
            {formatCurrency(driverReceivable)}
          </div>
        </div>

        {/* 备注 */}
        <div className="space-y-2">
          <Label htmlFor="remarks">备注</Label>
          <Textarea
            id="remarks"
            value={formData.remarks}
            onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
            placeholder="输入备注信息..."
            rows={3}
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate('/m/business-entry')}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}