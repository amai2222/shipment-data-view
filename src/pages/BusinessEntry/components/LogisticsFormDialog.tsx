// 最终文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsRecord, Project, PlatformTracking } from '../types';
import { PlatformTrackingInput } from '@/components/PlatformTrackingInput';
import { MultiLocationInput } from '@/components/MultiLocationInput';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; billing_type_id: number | null; is_default: boolean; }
interface LogisticsFormDialogProps { isOpen: boolean; onClose: () => void; editingRecord?: LogisticsRecord | null; projects: Project[]; onSubmitSuccess: () => void; }

// [修改] FormData 现在存储 ID，支持多地点
interface FormData {
  projectId: string;
  chainId: string;
  driverId: string;
  loadingLocationIds: string[]; // 地点ID数组
  unloadingLocationIds: string[]; // 地点ID数组
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
  other_platform_names: string; // 其他平台名称，用逗号分隔
  external_tracking_numbers: string; // 外部运单号，用逗号分隔不同平台，用竖线分隔同一平台的多个运单号
}

const INITIAL_FORM_DATA: FormData = {
  projectId: '',
  chainId: '',
  driverId: '',
  loadingLocationIds: [], // 改为空数组
  unloadingLocationIds: [], // 改为空数组
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
  other_platform_names: '', // 其他平台名称
  external_tracking_numbers: '', // 外部运单号
};

export function LogisticsFormDialog({ isOpen, onClose, editingRecord, projects, onSubmitSuccess }: LogisticsFormDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chains, setChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        // 直接使用数据库中的信息，不需要复杂的初始化
        setFormData({
          projectId: editingRecord.project_id || '',
          chainId: editingRecord.chain_id || '',
          driverId: editingRecord.driver_id || '',
          loadingLocationIds: [], // 地点ID会在locations加载后设置
          unloadingLocationIds: [], // 地点ID会在locations加载后设置
          loadingDate: editingRecord.loading_date ? new Date(editingRecord.loading_date) : new Date(),
          unloadingDate: editingRecord.unloading_date ? new Date(editingRecord.unloading_date) : new Date(),
          licensePlate: editingRecord.license_plate || '',
          driverPhone: editingRecord.driver_phone || '',
          loading_weight: editingRecord.loading_weight?.toString() || '',
          unloading_weight: editingRecord.unloading_weight?.toString() || '',
          transportType: editingRecord.transport_type || '实际运输',
          currentCost: editingRecord.current_cost?.toString() || '',
          extraCost: editingRecord.extra_cost?.toString() || '',
          remarks: editingRecord.remarks || '',
          other_platform_names: Array.isArray(editingRecord.other_platform_names) 
            ? editingRecord.other_platform_names.join(',') 
            : (editingRecord.other_platform_names || ''),
          external_tracking_numbers: Array.isArray(editingRecord.external_tracking_numbers) 
            ? editingRecord.external_tracking_numbers.join(',') 
            : (editingRecord.external_tracking_numbers || ''),
        });
      } else {
        setFormData(INITIAL_FORM_DATA);
      }
    }
  }, [isOpen, editingRecord]);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectSpecificData(formData.projectId);
    } else {
      setChains([]);
      setDrivers([]);
      setLocations([]);
      setFormData(prev => ({ ...prev, chainId: '', driverId: '', loadingLocationIds: [], unloadingLocationIds: [] }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (chains.length > 0) {
      if (editingRecord && editingRecord.chain_id) {
        setFormData(prev => ({ ...prev, chainId: editingRecord.chain_id || '' }));
      } else if (!editingRecord) {
        const defaultChain = chains.find(c => c.is_default);
        if (defaultChain) setFormData(prev => ({ ...prev, chainId: defaultChain.id }));
      }
    }
  }, [chains, editingRecord]);

  // 在编辑模式下，当地点数据加载完成后，直接设置地点ID
  useEffect(() => {
    if (editingRecord && locations.length > 0) {
      const loadingLocationNames = parseLocationString(editingRecord.loading_location || '');
      const unloadingLocationNames = parseLocationString(editingRecord.unloading_location || '');
      
      const loadingLocationIds = findLocationIdsByName(loadingLocationNames);
      const unloadingLocationIds = findLocationIdsByName(unloadingLocationNames);
      
      // 直接设置地点ID，不需要复杂的条件判断
      setFormData(prev => ({
        ...prev,
        loadingLocationIds,
        unloadingLocationIds,
      }));
    }
  }, [editingRecord, locations]);


  // 创建缺失的地点
  const createMissingLocations = async (locationNames: string[]) => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_locations_from_string', {
        p_location_string: locationNames.join('|')
      });
      
      if (error) throw error;
      if (data) {
        setLocations(prev => {
          const newLocations = data.filter((loc: any) => !prev.find(l => l.id === loc.id));
          return [...prev, ...newLocations];
        });
      }
    } catch (error) {
      console.error('Error creating locations:', error);
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
      toast({ title: "错误", description: "加载项目关联数据失败", variant: "destructive" });
    }
  };

  // 解析地点字符串为地点ID数组
  const parseLocationString = (locationString: string): string[] => {
    if (!locationString) return [];
    return locationString.split('|').map(loc => loc.trim()).filter(Boolean);
  };

  // 根据地点名称数组查找地点ID数组
  const findLocationIdsByName = (locationNames: string[]): string[] => {
    return locationNames
      .map(name => locations.find(loc => loc.name === name)?.id)
      .filter(Boolean) as string[];
  };

  const populateFormWithRecord = (record: LogisticsRecord) => {
    // 解析装卸货地点
    const loadingLocationNames = parseLocationString(record.loading_location || '');
    const unloadingLocationNames = parseLocationString(record.unloading_location || '');
    
    setFormData({
      projectId: record.project_id || '',
      chainId: record.chain_id || '',
      driverId: record.driver_id || '',
      loadingLocationIds: findLocationIdsByName(loadingLocationNames),
      unloadingLocationIds: findLocationIdsByName(unloadingLocationNames),
      loadingDate: record.loading_date ? new Date(record.loading_date) : new Date(),
      unloadingDate: record.unloading_date ? new Date(record.unloading_date) : new Date(),
      licensePlate: record.license_plate || '',
      driverPhone: record.driver_phone || '',
      loading_weight: record.loading_weight?.toString() || '',
      unloading_weight: record.unloading_weight?.toString() || '',
      transportType: record.transport_type || '实际运输',
      currentCost: record.current_cost?.toString() || '',
      extraCost: record.extra_cost?.toString() || '',
      remarks: record.remarks || '',
      external_tracking_numbers: record.external_tracking_numbers || [],
      other_platform_names: record.other_platform_names || [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectId || !formData.driverId || formData.loadingLocationIds.length === 0 || formData.unloadingLocationIds.length === 0 || !formData.loadingDate) {
      toast({ title: "验证失败", description: "项目、司机和地点等必填项不能为空。", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      // 将地点ID数组转换为地点名称字符串
      const loadingLocationNames = formData.loadingLocationIds
        .map(id => locations.find(l => l.id === id)?.name)
        .filter(Boolean)
        .join('|');
      
      const unloadingLocationNames = formData.unloadingLocationIds
        .map(id => locations.find(l => l.id === id)?.name)
        .filter(Boolean)
        .join('|');

      // 处理平台字段：解析逗号分隔的平台名称和运单号
      const otherPlatformNames = formData.other_platform_names 
        ? formData.other_platform_names.split(',').map(name => name.trim()).filter(Boolean)
        : [];
      
      const externalTrackingNumbers = formData.external_tracking_numbers 
        ? formData.external_tracking_numbers.split(',').map(trackingGroup => {
            // 每个trackingGroup可能包含多个运单号，用|分隔
            const trackingNumbers = trackingGroup.split('|').map(tn => tn.trim()).filter(Boolean);
            return trackingNumbers;
          })
        : [];

      const p_record = {
        project_id: formData.projectId,
        chain_id: formData.chainId,
        driver_id: formData.driverId,
        loading_location: loadingLocationNames,
        unloading_location: unloadingLocationNames,
        loading_date: formData.loadingDate.toISOString(),
        unloading_date: formData.unloadingDate ? formData.unloadingDate.toISOString() : null,
        license_plate: formData.licensePlate,
        driver_phone: formData.driverPhone,
        loading_weight: formData.loading_weight,
        unloading_weight: formData.unloading_weight,
        transport_type: formData.transportType,
        current_cost: formData.currentCost,
        extra_cost: formData.extraCost,
        remarks: formData.remarks,
        external_tracking_numbers: externalTrackingNumbers,
        other_platform_names: otherPlatformNames,
      };

      if (editingRecord) {
        const { error } = await supabase.rpc('update_logistics_record_via_recalc', { 
          p_record_id: editingRecord.id, 
          p_project_id: formData.projectId,
          p_project_name: projects.find(p => p.id === formData.projectId)?.name || '',
          p_chain_id: formData.chainId,
          p_driver_id: formData.driverId,
          p_driver_name: drivers.find(d => d.id === formData.driverId)?.name || '',
          p_loading_location: loadingLocationNames,
          p_unloading_location: unloadingLocationNames,
          p_loading_date: formData.loadingDate?.toISOString(),
          p_loading_weight: parseFloat(formData.loading_weight) || 0,
          p_unloading_weight: parseFloat(formData.unloading_weight) || 0,
          p_current_cost: parseFloat(formData.currentCost) || 0,
          p_license_plate: formData.licensePlate,
          p_driver_phone: formData.driverPhone,
          p_transport_type: formData.transportType,
          p_extra_cost: parseFloat(formData.extraCost) || 0,
          p_remarks: formData.remarks,
          p_unloading_date: formData.unloadingDate?.toISOString()
        });
        
        // 更新可选字段
        if (error) throw error;
        
        // 更新平台运单信息
        if (externalTrackingNumbers.length > 0 || otherPlatformNames.length > 0) {
          const { error: platformError } = await supabase
            .from('logistics_records')
            .update({ 
              external_tracking_numbers: externalTrackingNumbers,
              other_platform_names: otherPlatformNames
            })
            .eq('id', editingRecord.id);
          if (platformError) throw platformError;
        }
        if (error) throw error;
        toast({ title: "成功", description: "运单已更新" });
      } else {
        // 使用数据库函数来添加运单并自动计算合作方成本
        const { error } = await supabase.rpc('add_logistics_record_with_costs', {
          p_project_id: formData.projectId,
          p_project_name: projects.find(p => p.id === formData.projectId)?.name || '',
          p_chain_id: formData.chainId,
          p_driver_id: formData.driverId,
          p_driver_name: drivers.find(d => d.id === formData.driverId)?.name || '',
          p_loading_location: loadingLocationNames,
          p_unloading_location: unloadingLocationNames,
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
        
        // 获取新创建的运单ID并更新平台运单信息
        const { data: newRecord } = await supabase
          .from('logistics_records')
          .select('id')
          .eq('project_id', formData.projectId)
          .eq('driver_name', drivers.find(d => d.id === formData.driverId)?.name || '')
          .eq('loading_date', formData.loadingDate?.toISOString().split('T')[0] || '')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (newRecord) {
          if (externalTrackingNumbers.length > 0 || otherPlatformNames.length > 0) {
            const { error: platformError } = await supabase
              .from('logistics_records')
              .update({ 
                external_tracking_numbers: externalTrackingNumbers,
                other_platform_names: otherPlatformNames
              })
              .eq('id', newRecord.id);
            if (platformError) throw platformError;
          }
        }
        
        toast({ title: "成功", description: "运单已创建" });
      }
      onSubmitSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // [新增] 当选择司机时，自动填充车牌和电话
  const handleDriverSelect = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    setFormData(prev => ({
      ...prev,
      driverId: driverId,
      licensePlate: driver?.license_plate || '',
      driverPhone: driver?.phone || ''
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingRecord ? '编辑运单' : '新增运单'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ... 项目和合作链路部分保持不变 ... */}
            <div>
              <Label>项目 *</Label>
              <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>{projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>合作链路</Label>
              <Select value={formData.chainId} onValueChange={(value) => setFormData(prev => ({ ...prev, chainId: value }))} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择合作链路" /></SelectTrigger>
                <SelectContent>{chains.map((c) => (<SelectItem key={c.id} value={c.id}>{c.chain_name}{c.is_default ? ' (默认)' : ''}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {/* ... 日期部分保持不变 ... */}
            <div>
              <Label>装货日期 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.loadingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.loadingDate ? format(formData.loadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.loadingDate} onSelect={(date) => setFormData(prev => ({ ...prev, loadingDate: date }))} initialFocus locale={zhCN} /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>卸货日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.unloadingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.unloadingDate ? format(formData.unloadingDate, "yyyy年MM月dd日", { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.unloadingDate} onSelect={(date) => setFormData(prev => ({ ...prev, unloadingDate: date }))} initialFocus locale={zhCN} /></PopoverContent>
              </Popover>
            </div>
            
            {/* [修改] 司机改为下拉选择 */}
            <div>
              <Label>司机 *</Label>
              {editingRecord && editingRecord.driver_name && (
                <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-blue-800">当前司机信息</span>
                  </div>
                  <div className="text-sm font-medium text-gray-800">{editingRecord.driver_name}</div>
                  {editingRecord.license_plate && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        🚗 {editingRecord.license_plate}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <Select value={formData.driverId} onValueChange={handleDriverSelect} disabled={!formData.projectId}>
                <SelectTrigger><SelectValue placeholder="选择司机" /></SelectTrigger>
                <SelectContent>{drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} - {d.license_plate || '无车牌'}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>车牌号</Label>
              <Input value={formData.licensePlate} onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))} placeholder="选择司机后自动填充" />
            </div>
            <div>
              <Label>司机电话</Label>
              <Input value={formData.driverPhone} onChange={(e) => setFormData(prev => ({ ...prev, driverPhone: e.target.value }))} placeholder="选择司机后自动填充" />
            </div>
            {/* ... 运输类型保持不变 ... */}
            <div>
              <Label>运输类型</Label>
              <Select value={formData.transportType} onValueChange={(value) => setFormData(prev => ({ ...prev, transportType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent>
              </Select>
            </div>

            {/* [修改] 地点改为多地点选择 */}
            <div>
              <Label>装货地点 *</Label>
              {editingRecord && editingRecord.loading_location && (
                <div className="mb-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-green-800">当前装货地点</span>
                  </div>
                  <div className="space-y-1">
                    {editingRecord.loading_location.split('|').map((loc, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-green-600 text-xs">📍</span>
                        <span className="text-sm text-gray-700 bg-white px-2 py-1 rounded border text-xs font-medium">
                          {loc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <MultiLocationInput
                label=""
                locations={locations}
                value={formData.loadingLocationIds}
                onChange={(locationIds) => setFormData(prev => ({ ...prev, loadingLocationIds: locationIds }))}
                placeholder="选择装货地点"
                maxLocations={5}
                allowCustomInput={true}
                onCustomLocationAdd={async (locationName) => {
                  try {
                    // 使用数据库函数批量获取或创建地点
                    const { data, error } = await supabase.rpc('get_or_create_locations_from_string', {
                      p_location_string: locationName
                    });
                    
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                      const newLocationId = data[0];
                      
                      // 重新加载地点列表
                      const { data: updatedLocations } = await supabase
                        .from('locations')
                        .select('*')
                        .limit(100);
                      
                      if (updatedLocations) {
                        setLocations(updatedLocations);
                        // 自动选择新添加的地点
                        setFormData(prev => ({ 
                          ...prev, 
                          loadingLocationIds: [...prev.loadingLocationIds, newLocationId] 
                        }));
                      }
                    }
                  } catch (error) {
                    console.error('Error adding custom location:', error);
                    toast({ 
                      title: "错误", 
                      description: "添加自定义地点失败", 
                      variant: "destructive" 
                    });
                  }
                }}
              />
            </div>
            <div>
              <Label>卸货地点 *</Label>
              {editingRecord && editingRecord.unloading_location && (
                <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-orange-800">当前卸货地点</span>
                  </div>
                  <div className="space-y-1">
                    {editingRecord.unloading_location.split('|').map((loc, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-orange-600 text-xs">🏁</span>
                        <span className="text-sm text-gray-700 bg-white px-2 py-1 rounded border text-xs font-medium">
                          {loc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <MultiLocationInput
                label=""
                locations={locations}
                value={formData.unloadingLocationIds}
                onChange={(locationIds) => setFormData(prev => ({ ...prev, unloadingLocationIds: locationIds }))}
                placeholder="选择卸货地点"
                maxLocations={5}
                allowCustomInput={true}
                onCustomLocationAdd={async (locationName) => {
                  try {
                    // 使用数据库函数批量获取或创建地点
                    const { data, error } = await supabase.rpc('get_or_create_locations_from_string', {
                      p_location_string: locationName
                    });
                    
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                      const newLocationId = data[0];
                      
                      // 重新加载地点列表
                      const { data: updatedLocations } = await supabase
                        .from('locations')
                        .select('*')
                        .limit(100);
                      
                      if (updatedLocations) {
                        setLocations(updatedLocations);
                        // 自动选择新添加的地点
                        setFormData(prev => ({ 
                          ...prev, 
                          unloadingLocationIds: [...prev.unloadingLocationIds, newLocationId] 
                        }));
                      }
                    }
                  } catch (error) {
                    console.error('Error adding custom location:', error);
                    toast({ 
                      title: "错误", 
                      description: "添加自定义地点失败", 
                      variant: "destructive" 
                    });
                  }
                }}
              />
            </div>
          </div>
          {/* ... 后续表单部分保持不变 ... */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Weight className="h-4 w-4 text-slate-600" />
              </div>
              <Label className="text-sm font-semibold text-slate-800">重量信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-600 font-medium">装货{quantityLabel} *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.loading_weight} 
                  onChange={(e) => setFormData(prev => ({ ...prev, loading_weight: e.target.value }))} 
                  placeholder={`输入装货${quantityLabel}`} 
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 font-medium">卸货{quantityLabel}</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.unloading_weight} 
                  onChange={(e) => setFormData(prev => ({ ...prev, unloading_weight: e.target.value }))} 
                  placeholder={`输入卸货${quantityLabel}`} 
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Banknote className="h-4 w-4 text-emerald-600" />
              </div>
              <Label className="text-sm font-semibold text-emerald-800">费用信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-emerald-600 font-medium">运费(元) *</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={formData.currentCost} 
                  onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))} 
                  placeholder="输入运费" 
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-emerald-600 font-medium">额外费(元)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.extraCost} 
                  onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))} 
                  placeholder="输入额外费用，支持负数" 
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Banknote className="h-4 w-4 text-amber-600" />
              </div>
              <Label className="text-sm font-semibold text-amber-800">司机应收金额</Label>
            </div>
            <div className="bg-white p-4 rounded-lg border border-amber-100 text-center">
              <div className="text-2xl font-bold text-amber-600 font-mono">¥{driverReceivable.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">自动计算：运费 + 额外费</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-4 rounded-lg border border-violet-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
              <Label className="text-sm font-semibold text-violet-800">其他平台运单信息</Label>
            </div>
            <div className="bg-white p-3 rounded-lg border border-violet-100 mb-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-violet-600">📦</span>
                  <span className="text-gray-600">其他平台名称:</span>
                  <span className="font-semibold text-violet-600">
                    {formData.other_platform_names ? formData.other_platform_names.split(',').filter(Boolean).length : 0} 个
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-violet-600">📋</span>
                  <span className="text-gray-600">外部运单号:</span>
                  <span className="font-semibold text-violet-600">
                    {formData.external_tracking_numbers ? formData.external_tracking_numbers.split(',').filter(Boolean).length : 0} 个
                  </span>
                </div>
              </div>
            </div>
              
              <div className="space-y-4">
                {/* 其他平台名称输入 */}
                <div className="space-y-2">
                  <Label className="text-xs text-violet-600 font-medium">其他平台名称</Label>
                  <Input
                    placeholder="输入平台名称，用逗号分隔，例如：拼多多,京东"
                    value={formData.other_platform_names}
                    onChange={(e) => setFormData(prev => ({ ...prev, other_platform_names: e.target.value }))}
                    className="border-violet-200 focus:border-violet-400"
                  />
                  <div className="text-xs text-gray-500 bg-violet-50 p-2 rounded border border-violet-100">
                    💡 用逗号分隔不同平台名称，例如：拼多多,京东,淘宝
                  </div>
                </div>
                
                {/* 外部运单号输入 */}
                <div className="space-y-2">
                  <Label className="text-xs text-violet-600 font-medium">外部运单号</Label>
                  <Input
                    placeholder="输入运单号，用逗号分隔不同平台，用竖线分隔同一平台的多个运单号，例如：1234,1234|2345"
                    value={formData.external_tracking_numbers}
                    onChange={(e) => setFormData(prev => ({ ...prev, external_tracking_numbers: e.target.value }))}
                    className="border-violet-200 focus:border-violet-400"
                  />
                  <div className="text-xs text-gray-500 bg-violet-50 p-2 rounded border border-violet-100">
                    💡 格式说明：用逗号分隔不同平台，用竖线分隔同一平台的多个运单号<br/>
                    例如：1234,1234|2345 表示第一个平台运单号1234，第二个平台运单号1234和2345
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <CalendarIcon className="h-4 w-4 text-gray-600" />
              </div>
              <Label className="text-sm font-semibold text-gray-800">备注信息</Label>
            </div>
            <Textarea 
              value={formData.remarks} 
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))} 
              placeholder="输入备注信息" 
              rows={3}
              className="border-gray-200 focus:border-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />取消</Button>
            <Button type="submit" disabled={loading}><Save className="mr-2 h-4 w-4" />{loading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}




