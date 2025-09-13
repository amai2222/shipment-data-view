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
  loadingLocationIds: string[]; // 改为数组支持多地点
  unloadingLocationIds: string[]; // 改为数组支持多地点
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
  external_tracking_numbers: any[]; // 外部运单号数组
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
  other_platform_waybills: '',
  external_tracking_numbers: [], // 添加缺失的字段
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
        // 先设置基本信息，地点信息会在数据加载完成后单独设置
        setFormData({
          projectId: editingRecord.project_id || '',
          chainId: editingRecord.chain_id || '',
          driverId: editingRecord.driver_id || '',
          loadingLocationIds: [], // 临时设为空，稍后会被正确的地点数据覆盖
          unloadingLocationIds: [], // 临时设为空，稍后会被正确的地点数据覆盖
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
          external_tracking_numbers: (() => {
            if (!editingRecord.external_tracking_numbers || !Array.isArray(editingRecord.external_tracking_numbers)) {
              return [];
            }
            
            // 按平台分组，将同一平台的多个运单号合并
            const groupedByPlatform: { [key: string]: string[] } = {};
            editingRecord.external_tracking_numbers.forEach((item: any) => {
              if (item.platform && item.tracking_number) {
                if (!groupedByPlatform[item.platform]) {
                  groupedByPlatform[item.platform] = [];
                }
                groupedByPlatform[item.platform].push(item.tracking_number);
              }
            });
            
            // 转换为表单格式
            return Object.entries(groupedByPlatform).map(([platform, trackingNumbers]) => ({
              platform,
              tracking_number: trackingNumbers.join('|'),
              status: 'pending',
              created_at: new Date().toISOString()
            }));
          })(),
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

  // 在编辑模式下，当数据加载完成后填充地点和司机信息
  useEffect(() => {
    if (editingRecord && locations.length > 0 && drivers.length > 0) {
      // 解析装卸货地点
      const loadingLocationNames = parseLocationString(editingRecord.loading_location || '');
      const unloadingLocationNames = parseLocationString(editingRecord.unloading_location || '');
      
      console.log('编辑模式加载地点数据:', {
        loadingLocation: editingRecord.loading_location,
        unloadingLocation: editingRecord.unloading_location,
        loadingLocationNames,
        unloadingLocationNames,
        locationsCount: locations.length
      });
      
      // 确保当前司机在司机列表中
      const currentDriver = drivers.find(d => d.id === editingRecord.driver_id);
      if (!currentDriver && editingRecord.driver_id) {
        // 如果当前司机不在列表中，需要单独加载
        loadDriverById(editingRecord.driver_id);
      }
      
      // 确保地点在地点列表中
      const missingLocations = [...loadingLocationNames, ...unloadingLocationNames]
        .filter(name => !locations.find(l => l.name === name));
      
      if (missingLocations.length > 0) {
        // 如果有缺失的地点，需要创建它们
        createMissingLocations(missingLocations);
      }
      
      const loadingLocationIds = findLocationIdsByName(loadingLocationNames);
      const unloadingLocationIds = findLocationIdsByName(unloadingLocationNames);
      
      console.log('地点ID查找结果:', {
        loadingLocationIds,
        unloadingLocationIds,
        locations: locations.map(l => ({ id: l.id, name: l.name }))
      });
      
      setFormData(prev => ({
        ...prev,
        loadingLocationIds,
        unloadingLocationIds,
      }));
    }
  }, [editingRecord, locations, drivers]);

  // 单独加载司机信息
  const loadDriverById = async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single();
      
      if (error) throw error;
      if (data) {
        setDrivers(prev => {
          // 如果司机不在列表中，添加到列表
          if (!prev.find(d => d.id === driverId)) {
            return [...prev, data];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error loading driver:', error);
    }
  };

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

      // 处理平台字段：从运单号数组中提取平台名称，支持运单号用|分隔
      const externalTrackingNumbers: any[] = [];
      const otherPlatformNames: string[] = [];
      
      (formData.external_tracking_numbers || []).forEach(item => {
        if (item.platform && item.tracking_number) {
          // 如果运单号包含|分隔符，则拆分成多个运单号
          const trackingNumbers = item.tracking_number.split('|').map(tn => tn.trim()).filter(Boolean);
          
          trackingNumbers.forEach(trackingNumber => {
            externalTrackingNumbers.push({
              platform: item.platform,
              tracking_number: trackingNumber,
              status: 'pending',
              created_at: new Date().toISOString()
            });
          });
          
          // 添加平台名称（去重）
          if (!otherPlatformNames.includes(item.platform)) {
            otherPlatformNames.push(item.platform);
          }
        }
      });

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
              <MultiLocationInput
                label="装货地点 *"
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
              <MultiLocationInput
                label="卸货地点 *"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>装货{quantityLabel} *</Label>
              <Input type="number" step="0.01" value={formData.loading_weight} onChange={(e) => setFormData(prev => ({ ...prev, loading_weight: e.target.value }))} placeholder={`输入装货${quantityLabel}`} />
            </div>
            <div>
              <Label>卸货{quantityLabel}</Label>
              <Input type="number" step="0.01" value={formData.unloading_weight} onChange={(e) => setFormData(prev => ({ ...prev, unloading_weight: e.target.value }))} placeholder={`输入卸货${quantityLabel}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>运费(元) *</Label>
              <Input type="number" step="0.01" min="0" value={formData.currentCost} onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))} placeholder="输入运费" />
            </div>
            <div>
              <Label>额外费(元)</Label>
              <Input type="number" step="0.01" value={formData.extraCost} onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))} placeholder="输入额外费用，支持负数" />
            </div>
          </div>
          <div>
            <Label className="font-semibold">司机应收(元)</Label>
            <div className="mt-1 px-3 py-2 bg-muted rounded-md font-mono text-primary font-semibold text-lg">¥{driverReceivable.toFixed(2)}</div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">其他平台运单信息</Label>
              <div className="text-sm text-muted-foreground mt-1 mb-3">
                外部运单号: {(formData.external_tracking_numbers || []).length} 个 | 其他平台: {(formData.external_tracking_numbers || []).map(item => item.platform).filter(Boolean).filter((platform, index, arr) => arr.indexOf(platform) === index).length} 个
              </div>
              
              {/* 外部运单号输入 */}
              <div className="space-y-2">
                <Label className="text-sm">外部运单号</Label>
                <div className="space-y-2">
                  {(formData.external_tracking_numbers || []).map((tracking, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="平台名称"
                        value={tracking.platform || ''}
                        onChange={(e) => {
                          const newTrackings = [...(formData.external_tracking_numbers || [])];
                          newTrackings[index] = { ...tracking, platform: e.target.value };
                          setFormData(prev => ({ ...prev, external_tracking_numbers: newTrackings }));
                        }}
                        className="w-32"
                      />
                      <Input
                        placeholder="运单号"
                        value={tracking.tracking_number || ''}
                        onChange={(e) => {
                          const newTrackings = [...(formData.external_tracking_numbers || [])];
                          newTrackings[index] = { ...tracking, tracking_number: e.target.value };
                          setFormData(prev => ({ ...prev, external_tracking_numbers: newTrackings }));
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newTrackings = (formData.external_tracking_numbers || []).filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, external_tracking_numbers: newTrackings }));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        external_tracking_numbers: [
                          ...(prev.external_tracking_numbers || []),
                          { platform: '', tracking_number: '', status: 'pending', created_at: new Date().toISOString() }
                        ]
                      }));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加运单号
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  每个运单号包含平台名称和对应的运单号码。如果同一平台有多个运单号，用|分隔，例如：HL123456|HL789012|HL345678
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label>备注</Label>
            <Textarea value={formData.remarks} onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))} placeholder="输入备注信息" rows={3} />
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




