// 最终文件路径: src/pages/BusinessEntry/components/LogisticsFormDialog.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save, X, Plus, Package, Banknote, Weight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { relaxedSupabase as supabase } from "@/lib/supabase-helpers";
import { LogisticsRecord, Project, PlatformTracking } from '../types';
import { PlatformTrackingInput } from '@/components/PlatformTrackingInput';
import { MultiLocationInput } from '@/components/MultiLocationInput';
import { DriverComboInput } from '@/components/DriverComboInput';
import { LocationEditDialog } from '@/components/LocationEditDialog';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { formatChinaDateString, convertUTCDateToChinaDate } from "@/utils/dateUtils";

interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; nickname?: string | null; }
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
  unitPrice: string; // 单价（元/吨）- 新增
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
  unitPrice: '', // 单价 - 新增
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
  const [saveAndContinue, setSaveAndContinue] = useState(false); // 保存并新增模式
  const [taxIncludedPrice, setTaxIncludedPrice] = useState(''); // 含税单价
  const [taxRate, setTaxRate] = useState(''); // 税点
  const [costCalculationMode, setCostCalculationMode] = useState<'manual' | 'auto'>('manual'); // 费用计算模式
  
  // 地点编辑对话框状态
  const [locationEditDialogOpen, setLocationEditDialogOpen] = useState(false);
  const [locationEditInitialName, setLocationEditInitialName] = useState('');
  const [locationEditType, setLocationEditType] = useState<'loading' | 'unloading'>('loading'); // 用于区分是装货还是卸货地点
  
  // 使用 ref 跟踪是否已经初始化，避免重复初始化导致表单重置
  const isInitializedRef = useRef(false);
  const editingRecordIdRef = useRef<string | null>(null);

  // 调试：监听司机列表变化
  useEffect(() => {
    console.log('司机列表已更新:', { 
      count: drivers.length, 
      drivers: drivers.map(d => ({ id: d.id, name: d.name })),
      currentProjectId: formData.projectId 
    });
  }, [drivers, formData.projectId]);

  const selectedChain = useMemo(() => chains.find(c => c.id === formData.chainId), [chains, formData.chainId]);
  const billingTypeId = selectedChain?.billing_type_id || 1;

  const quantityLabel = useMemo(() => {
    if (billingTypeId === 2) return '发车次数';
    if (billingTypeId === 3) return '体积(立方)';
    if (billingTypeId === 4) return '件数(件)';
    return '重量(吨)';
  }, [billingTypeId]);

  // 获取单位文本（用于显示）
  const unitLabel = useMemo(() => {
    if (billingTypeId === 2) return '车';
    if (billingTypeId === 3) return '立方';
    if (billingTypeId === 4) return '件';
    return '吨';
  }, [billingTypeId]);

  // 计算有效数量（根据链路计费模式和项目配置）
  const effectiveQuantity = useMemo(() => {
    const loadingWeight = parseFloat(formData.loading_weight) || 0;
    const unloadingWeight = parseFloat(formData.unloading_weight) || 0;
    
    // 1. 如果是计车模式（billing_type_id = 2），有效数量固定为 1
    if (billingTypeId === 2) {
      return 1;
    }
    
    // 2. 对于其他计费模式（计重/计方/计件），根据项目配置计算
    const project = projects.find(p => p.id === formData.projectId);
    const quantityType = project?.effective_quantity_type || 'min_value';
    
    // 根据项目配置计算有效数量
    if (quantityType === 'loading') {
      return loadingWeight;
    } else if (quantityType === 'unloading') {
      return unloadingWeight;
    } else { // min_value
      if (loadingWeight > 0 && unloadingWeight > 0) {
        return Math.min(loadingWeight, unloadingWeight);
      }
      return loadingWeight || unloadingWeight || 0;
    }
  }, [formData.loading_weight, formData.unloading_weight, formData.projectId, projects, billingTypeId]);

  // 自动计算运费（仅在自动模式下）
  useEffect(() => {
    if (costCalculationMode === 'auto' && effectiveQuantity > 0) {
      const unitPrice = parseFloat(formData.unitPrice) || 0;
      if (unitPrice > 0) {
        const calculatedCost = unitPrice * effectiveQuantity;
        const newCost = calculatedCost > 0 ? calculatedCost.toFixed(2) : '';
        // 只有当计算出的值不同时才更新，避免不必要的重渲染
        setFormData(prev => {
          if (prev.currentCost !== newCost) {
            return { ...prev, currentCost: newCost };
          }
          return prev;
        });
      }
    }
  }, [costCalculationMode, formData.unitPrice, effectiveQuantity]);

  // 含税单价自动计算（仅在自动模式下）
  useEffect(() => {
    if (costCalculationMode === 'auto') {
      const taxPrice = parseFloat(taxIncludedPrice) || 0;
      const tax = parseFloat(taxRate) || 0;
      
      if (taxPrice > 0 && tax >= 0 && tax < 100) {
        // 计算不含税单价：含税单价 × (1 - 税点/100)
        const unitPriceBeforeTax = taxPrice * (1 - tax / 100);
        setFormData(prev => ({ ...prev, unitPrice: unitPriceBeforeTax.toFixed(2) }));
      }
    }
  }, [costCalculationMode, taxIncludedPrice, taxRate]);

  const driverReceivable = useMemo(() => {
    const current = parseFloat(formData.currentCost) || 0;
    const extra = parseFloat(formData.extraCost) || 0;
    return current + extra;
  }, [formData.currentCost, formData.extraCost]);

  // 解析地点字符串为地点ID数组
  const parseLocationString = (locationString: string): string[] => {
    if (!locationString) return [];
    return locationString.split('|').map(loc => loc.trim()).filter(Boolean);
  };

  // 根据地点名称数组查找地点ID数组
  const findLocationIdsByName = useCallback((locationNames: string[]): string[] => {
    return locationNames
      .map(name => locations.find(loc => loc.name === name)?.id)
      .filter(Boolean) as string[];
  }, [locations]);

  const loadProjectSpecificData = useCallback(async (projectId: string) => {
    try {
      // 1. 加载合作链路
      const chainsRes = await supabase
        .from('partner_chains')
        .select('id, chain_name, billing_type_id, is_default')
        .eq('project_id', projectId);

      if (chainsRes.error) throw chainsRes.error;
      setChains(chainsRes.data || []);

      // 2. 根据项目ID加载关联的司机
      // 先通过 driver_projects 表查询与项目关联的司机ID
      const { data: driverProjects, error: driverProjectsError } = await supabase
        .from('driver_projects')
        .select('driver_id')
        .eq('project_id', projectId);

      if (driverProjectsError) {
        console.error('查询司机项目关联失败:', driverProjectsError);
        throw driverProjectsError;
      }

      const driverIds = [...new Set((driverProjects || []).map(dp => dp.driver_id))];

      console.log('项目关联的司机ID:', { projectId, driverIds, count: driverIds.length });

      // 3. 根据司机ID查询司机详情
      if (driverIds.length > 0) {
        const { data: driversData, error: driversError } = await supabase
          .from('drivers')
          .select('*')
          .in('id', driverIds)
          .order('name');

        if (driversError) {
          console.error('查询司机详情失败:', driversError);
          throw driversError;
        }

        console.log('加载的司机列表:', { count: driversData?.length || 0, drivers: driversData?.map(d => d.name) });
        setDrivers(driversData || []);
      } else {
        console.log('项目没有关联任何司机，清空司机列表');
        setDrivers([]);
      }

      // 4. 根据项目ID加载关联的地点
      // 先通过 location_projects 表查询与项目关联的地点ID
      const { data: locationProjects, error: locationProjectsError } = await supabase
        .from('location_projects')
        .select('location_id')
        .eq('project_id', projectId);

      if (locationProjectsError) throw locationProjectsError;

      const locationIds = [...new Set((locationProjects || []).map(lp => lp.location_id))];

      // 5. 根据地点ID查询地点详情（包含 nickname 字段）
      if (locationIds.length > 0) {
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, nickname')
          .in('id', locationIds)
          .order('name');

        if (locationsError) throw locationsError;
        setLocations(locationsData || []);
      } else {
        setLocations([]);
      }

      console.log('加载项目关联数据:', {
        drivers: driverIds.length,
        locations: locationIds.length,
        chains: chainsRes.data?.length
      });
    } catch (error) {
      console.error('加载项目关联数据失败:', error);
      toast({ title: "错误", description: "加载项目关联数据失败", variant: "destructive" });
    }
  }, [toast]);

  // 初始化表单数据（只在打开对话框或编辑记录变化时执行，避免 chains 更新导致重置）
  useEffect(() => {
    if (isOpen) {
      // 检查是否是新的编辑记录或首次打开
      const isNewRecord = editingRecord?.id !== editingRecordIdRef.current;
      
      if (editingRecord && isNewRecord) {
        // 更新 ref，标记当前正在编辑的记录
        editingRecordIdRef.current = editingRecord.id;
        isInitializedRef.current = true;
        
        // 调试：检查单价数据
        console.log('编辑运单 - 从数据库读取的数据:', {
          id: editingRecord.id,
          unit_price: editingRecord.unit_price,
          effective_quantity: editingRecord.effective_quantity,
          calculation_mode: editingRecord.calculation_mode,
          current_cost: editingRecord.current_cost,
        });
        
        // 直接使用数据库中的信息，不需要复杂的初始化
        const initialProjectId = editingRecord.project_id || '';
        const unitPriceValue = editingRecord.unit_price?.toString() || '';
        const hasUnitPrice = unitPriceValue !== '' && parseFloat(unitPriceValue) > 0;
        console.log('设置单价到表单:', unitPriceValue, '有单价:', hasUnitPrice);
        
        // 如果有单价，先计算有效数量和运费（在设置 formData 之前）
        let initialCurrentCost = editingRecord.current_cost?.toString() || '';
        if (hasUnitPrice) {
          // 获取链路的计费模式（优先使用 editingRecord 中的 billing_type_id，否则从 chains 中查找）
          const recordBillingTypeId = editingRecord.billing_type_id || 1;
          const chain = chains.find(c => c.id === editingRecord.chain_id);
          const chainBillingTypeId = chain?.billing_type_id || recordBillingTypeId;
          
          const loadingWeight = parseFloat(editingRecord.loading_weight?.toString() || '0') || 0;
          const unloadingWeight = parseFloat(editingRecord.unloading_weight?.toString() || '0') || 0;
          
          let effectiveQty = 0;
          
          // 1. 如果是计车模式（billing_type_id = 2），有效数量固定为 1
          if (chainBillingTypeId === 2) {
            effectiveQty = 1;
          } else {
            // 2. 对于其他计费模式（计重/计方/计件），根据项目配置计算
            const project = projects.find(p => p.id === initialProjectId);
            const quantityType = project?.effective_quantity_type || 'min_value';
            
            if (quantityType === 'loading') {
              effectiveQty = loadingWeight;
            } else if (quantityType === 'unloading') {
              effectiveQty = unloadingWeight;
            } else { // min_value
              if (loadingWeight > 0 && unloadingWeight > 0) {
                effectiveQty = Math.min(loadingWeight, unloadingWeight);
              } else {
                effectiveQty = loadingWeight || unloadingWeight || 0;
              }
            }
          }
          
          // 重新计算运费
          if (effectiveQty > 0) {
            const unitPrice = parseFloat(unitPriceValue);
            const calculatedCost = unitPrice * effectiveQty;
            initialCurrentCost = calculatedCost.toFixed(2);
            console.log('编辑模式 - 重新计算运费:', {
              unitPrice,
              effectiveQty,
              calculatedCost,
              initialCurrentCost
            });
          }
        }
        
        setFormData({
          projectId: initialProjectId,
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
          unitPrice: unitPriceValue, // 从数据库读取单价
          currentCost: initialCurrentCost, // 如果有单价则使用重新计算的值，否则使用数据库的值
          extraCost: editingRecord.extra_cost?.toString() || '',
          remarks: editingRecord.remarks || '',
          other_platform_names: Array.isArray(editingRecord.other_platform_names) 
            ? editingRecord.other_platform_names.join(',') 
            : (editingRecord.other_platform_names || ''),
          external_tracking_numbers: Array.isArray(editingRecord.external_tracking_numbers) 
            ? editingRecord.external_tracking_numbers.join(',') 
            : (editingRecord.external_tracking_numbers || ''),
        });
        // 如果有项目ID，立即加载项目关联的数据
        if (initialProjectId) {
          loadProjectSpecificData(initialProjectId);
        }
      } else if (!editingRecord && isInitializedRef.current) {
        // 新增模式：重置表单
        isInitializedRef.current = false;
        editingRecordIdRef.current = null;
        setFormData(INITIAL_FORM_DATA);
        // 清空所有列表
        setDrivers([]);
        setLocations([]);
        setChains([]);
        // 清空含税单价计算器
        setTaxIncludedPrice('');
        setTaxRate('');
        setCostCalculationMode('manual');
      } else if (!isInitializedRef.current && !editingRecord) {
        // 首次打开且是新增模式
        isInitializedRef.current = true;
        setFormData(INITIAL_FORM_DATA);
        setDrivers([]);
        setLocations([]);
        setChains([]);
        // 清空含税单价计算器
        setTaxIncludedPrice('');
        setTaxRate('');
        setCostCalculationMode('manual');
      }
    } else {
      // 对话框关闭时重置状态
      isInitializedRef.current = false;
      editingRecordIdRef.current = null;
      setDrivers([]);
      setLocations([]);
      setChains([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingRecord?.id, loadProjectSpecificData, projects]);

  // 当司机数据加载完成后，如果是编辑模式且司机信息为空，自动从司机数据中填充
  useEffect(() => {
    if (editingRecord && drivers.length > 0 && formData.driverId) {
      const driver = drivers.find(d => d.id === formData.driverId);
      if (driver) {
        setFormData(prev => {
          // 只在车牌或电话为空时才填充，避免覆盖用户手动输入的值
          if (!prev.licensePlate || !prev.driverPhone) {
            return {
              ...prev,
              licensePlate: prev.licensePlate || driver.license_plate || '',
              driverPhone: prev.driverPhone || driver.phone || ''
            };
          }
          return prev;
        });
      }
    }
  }, [editingRecord, drivers, formData.driverId]);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectSpecificData(formData.projectId);
    } else {
      setChains([]);
      setDrivers([]);
      setLocations([]);
      // 只在非编辑模式下清空表单数据
      if (!editingRecord) {
        setFormData(prev => ({ ...prev, chainId: '', driverId: '', loadingLocationIds: [], unloadingLocationIds: [] }));
      }
    }
  }, [formData.projectId, loadProjectSpecificData, editingRecord]);

  // 当 chains 加载完成后，设置默认链路（只在新增模式或链路为空时设置，避免覆盖用户选择）
  useEffect(() => {
    if (chains.length > 0 && isInitializedRef.current) {
      // 只在新增模式时设置默认链路，编辑模式不自动设置（避免覆盖已有数据）
      if (!editingRecord) {
        const defaultChain = chains.find(c => c.is_default);
        if (defaultChain) {
          setFormData(prev => {
            // 只在当前没有选择链路时才设置默认链路
            if (!prev.chainId) {
              return { ...prev, chainId: defaultChain.id };
            }
            return prev;
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chains]);

  // 在编辑模式下，当地点数据加载完成后，直接设置地点ID
  useEffect(() => {
    if (editingRecord && locations.length > 0 && formData.loadingLocationIds.length === 0) {
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
  }, [editingRecord, locations, formData.loadingLocationIds.length, findLocationIdsByName]);

  // 创建缺失的地点
  const createMissingLocations = async (locationNames: string[]) => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_locations_from_string', {
        p_location_string: locationNames.join('|')
      });
      
      if (error) throw error;
      if (data) {
        setLocations(prev => {
          const newLocations = (data as Location[]).filter((loc) => !prev.find(l => l.id === loc.id));
          return [...prev, ...newLocations];
        });
      }
    } catch (error) {
      console.error('Error creating locations:', error);
    }
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
      unitPrice: record.unit_price?.toString() || '', // 从数据库读取单价
      currentCost: record.current_cost?.toString() || '',
      extraCost: record.extra_cost?.toString() || '',
      remarks: record.remarks || '',
      external_tracking_numbers: Array.isArray(record.external_tracking_numbers) 
        ? record.external_tracking_numbers.join(',') 
        : (record.external_tracking_numbers || ''),
      other_platform_names: Array.isArray(record.other_platform_names) 
        ? record.other_platform_names.join(',') 
        : (record.other_platform_names || ''),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 调试信息
    console.log('表单数据验证:', {
      projectId: formData.projectId,
      driverId: formData.driverId,
      loadingLocationIds: formData.loadingLocationIds,
      unloadingLocationIds: formData.unloadingLocationIds,
      loadingDate: formData.loadingDate,
      licensePlate: formData.licensePlate,
      driverPhone: formData.driverPhone,
      isEditing: !!editingRecord,
      editingRecord: editingRecord ? {
        project_id: editingRecord.project_id,
        driver_id: editingRecord.driver_id,
        loading_location: editingRecord.loading_location,
        unloading_location: editingRecord.unloading_location
      } : null
    });
    
    // 在编辑模式下，如果表单字段暂时为空但原始记录有相应信息，则使用原始值
    const hasProject = formData.projectId || editingRecord?.project_id;
    const hasDriver = formData.driverId || editingRecord?.driver_id;
    const hasLoadingLocation = formData.loadingLocationIds.length > 0 || (editingRecord?.loading_location && editingRecord.loading_location.length > 0);
    const hasUnloadingLocation = formData.unloadingLocationIds.length > 0 || (editingRecord?.unloading_location && editingRecord.unloading_location.length > 0);
    const hasLoadingDate = formData.loadingDate || editingRecord?.loading_date;
    
    if (!hasProject || !hasDriver || !hasLoadingLocation || !hasUnloadingLocation || !hasLoadingDate) {
      const missingFields = [];
      if (!hasProject) missingFields.push('项目');
      if (!hasDriver) missingFields.push('司机');
      if (!hasLoadingLocation) missingFields.push('装货地点');
      if (!hasUnloadingLocation) missingFields.push('卸货地点');
      if (!hasLoadingDate) missingFields.push('装货日期');
      
      toast({ 
        title: "验证失败", 
        description: `以下必填项不能为空：${missingFields.join('、')}`, 
        variant: "destructive" 
      });
      return;
    }
    setLoading(true);

    try {
      // 将地点ID数组转换为地点名称字符串
      // 在编辑模式下，如果地点ID为空，使用原始地点数据
      let loadingLocationNames = formData.loadingLocationIds
        .map(id => locations.find(l => l.id === id)?.name)
        .filter(Boolean)
        .join('|');
      
      let unloadingLocationNames = formData.unloadingLocationIds
        .map(id => locations.find(l => l.id === id)?.name)
        .filter(Boolean)
        .join('|');
      
      // 如果是编辑模式且地点名称为空，使用原始值
      if (editingRecord) {
        if (!loadingLocationNames && editingRecord.loading_location) {
          loadingLocationNames = editingRecord.loading_location;
        }
        if (!unloadingLocationNames && editingRecord.unloading_location) {
          unloadingLocationNames = editingRecord.unloading_location;
        }
      }

      // 处理平台字段：解析逗号分隔的平台名称和运单号
      const otherPlatformNames = formData.other_platform_names 
        ? formData.other_platform_names.split(',').map(name => name.trim()).filter(Boolean)
        : [];
      
      const externalTrackingNumbers: string[][] = formData.external_tracking_numbers 
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
        // 将中国时区的日期转换为日期字符串（YYYY-MM-DD格式）
        // 用户选择的是中国时区的日期，需要正确格式化
        loading_date: formatChinaDateString(formData.loadingDate),
        unloading_date: formData.unloadingDate ? formatChinaDateString(formData.unloadingDate) : null,
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
        // 使用表单数据，如果为空则使用原始记录数据
        const finalProjectId = formData.projectId || editingRecord.project_id;
        const finalDriverId = formData.driverId || editingRecord.driver_id;
        
        const unitPriceParam = formData.unitPrice ? parseFloat(formData.unitPrice) : null;
        console.log('保存运单 - 单价参数:', {
          unitPrice: formData.unitPrice,
          parsed: unitPriceParam,
          recordId: editingRecord.id
        });
        
        const { error } = await supabase.rpc('update_logistics_record_via_recalc_1120', { 
          p_record_id: editingRecord.id, 
          p_project_id: finalProjectId,
          p_project_name: projects.find(p => p.id === finalProjectId)?.name || editingRecord.project_name || '',
          p_chain_id: formData.chainId || editingRecord.chain_id,
          p_billing_type_id: selectedChain?.billing_type_id || editingRecord.billing_type_id || 1,  // ✅ 新增：传递计费模式ID
          p_driver_id: finalDriverId,
          p_driver_name: drivers.find(d => d.id === finalDriverId)?.name || editingRecord.driver_name || '',
          p_loading_location: loadingLocationNames,
          p_unloading_location: unloadingLocationNames,
          // 传递纯日期字符串（YYYY-MM-DD），函数内部会添加时区信息
          p_loading_date: formData.loadingDate ? formatChinaDateString(formData.loadingDate) : (editingRecord.loading_date ? formatChinaDateString(convertUTCDateToChinaDate(editingRecord.loading_date.split('T')[0])) : null),
          p_loading_weight: parseFloat(formData.loading_weight) || 0,
          p_unloading_weight: parseFloat(formData.unloading_weight) || 0,
          p_unit_price: unitPriceParam, // 单价参数
          p_current_cost: parseFloat(formData.currentCost) || 0,
          p_extra_cost: parseFloat(formData.extraCost) || 0,
          p_license_plate: formData.licensePlate,
          p_driver_phone: formData.driverPhone,
          p_transport_type: formData.transportType,
          p_remarks: formData.remarks,
          // 传递纯日期字符串（YYYY-MM-DD），函数内部会添加时区信息
          p_unloading_date: formData.unloadingDate ? formatChinaDateString(formData.unloadingDate) : null
        });
        
        // 更新可选字段
        if (error) {
          console.error('保存运单失败:', error);
          throw error;
        }
        
        // 验证保存结果
        const { data: savedRecord, error: verifyError } = await supabase
          .from('logistics_records')
          .select('unit_price, effective_quantity, calculation_mode, current_cost')
          .eq('id', editingRecord.id)
          .single();
        
        if (!verifyError && savedRecord) {
          console.log('保存后的数据验证:', savedRecord);
        } else if (verifyError) {
          console.error('验证保存结果失败:', verifyError);
        }
        
        // 更新平台运单信息
        if (externalTrackingNumbers.length > 0 || otherPlatformNames.length > 0) {
          const { error: platformError } = await supabase
            .from('logistics_records')
            .update({
              external_tracking_numbers: externalTrackingNumbers,
              other_platform_names: otherPlatformNames,
            })
            .eq('id', editingRecord.id);
          
          if (platformError) throw platformError;
        }
        
        toast({ title: "成功", description: "运单已更新" });
      } else {
        // 使用数据库函数来添加运单并自动计算合作方成本
        const { data: newRecordId, error } = await supabase.rpc('add_logistics_record_with_costs_1120', {
          p_project_id: formData.projectId,
          p_project_name: projects.find(p => p.id === formData.projectId)?.name || '',
          p_chain_id: formData.chainId,
          p_billing_type_id: selectedChain?.billing_type_id || 1,  // ✅ 新增：传递计费模式ID
          p_driver_id: formData.driverId,
          p_driver_name: drivers.find(d => d.id === formData.driverId)?.name || '',
          p_loading_location: loadingLocationNames,
          p_unloading_location: unloadingLocationNames,
          // 传递纯日期字符串（YYYY-MM-DD），函数内部会添加时区信息
          p_loading_date: formData.loadingDate ? formatChinaDateString(formData.loadingDate) : null,
          p_loading_weight: parseFloat(formData.loading_weight) || 0,
          p_unloading_weight: parseFloat(formData.unloading_weight) || 0,
          p_unit_price: formData.unitPrice ? parseFloat(formData.unitPrice) : null, // 单价参数（必须在 current_cost 之前）
          p_current_cost: parseFloat(formData.currentCost) || 0,
          p_extra_cost: parseFloat(formData.extraCost) || 0,
          p_license_plate: formData.licensePlate,
          p_driver_phone: formData.driverPhone,
          p_transport_type: formData.transportType,
          p_remarks: formData.remarks,
          p_unloading_date: formData.unloadingDate ? formatChinaDateString(formData.unloadingDate) : null
        });
        
        if (error) {
          console.error('保存运单失败 - 详细错误:', error);
          console.error('错误代码:', error.code);
          console.error('错误消息:', error.message);
          console.error('错误详情:', error.details);
          console.error('错误提示:', error.hint);
          throw error;
        }
        
        console.log('运单创建成功，ID:', newRecordId);
        
        // 使用函数返回的ID更新平台运单信息
        if (newRecordId && (externalTrackingNumbers.length > 0 || otherPlatformNames.length > 0)) {
          const { error: platformError } = await supabase
            .from('logistics_records')
            .update({ 
              external_tracking_numbers: externalTrackingNumbers,
              other_platform_names: otherPlatformNames
            })
            .eq('id', newRecordId);
          if (platformError) {
            console.error('更新平台运单信息失败:', platformError);
            throw platformError;
          }
        }
        
        toast({ title: "成功", description: "运单已创建" });
      }
      onSubmitSuccess();
      
      // 如果是"保存并新增"模式
      if (saveAndContinue && !editingRecord) {
        // 保留项目和链路信息
        const projectId = formData.projectId;
        const chainId = formData.chainId;
        
        // 重置表单，但保留项目和链路
        setFormData({
          ...INITIAL_FORM_DATA,
          projectId,
          chainId,
        });
        
        // 清空含税单价计算器
        setTaxIncludedPrice('');
        setTaxRate('');
        setCostCalculationMode('manual');
        
        // 重置保存并新增标志
        setSaveAndContinue(false);
        
        toast({ 
          title: "成功", 
          description: "运单已创建，可继续录入下一单",
          duration: 2000
        });
      } else {
        // 正常模式，关闭对话框
        onClose();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      toast({ title: "保存失败", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // [新增] 当选择司机时，自动填充车牌和电话
  const handleDriverSelect = useCallback((driverId: string, driverData?: { name: string; license_plate: string; phone: string }) => {
    setFormData(prev => {
      // 如果司机ID没有变化，不更新（避免不必要的重渲染）
      if (prev.driverId === driverId) {
        return prev;
      }
      return {
        ...prev,
        driverId: driverId,
        licensePlate: driverData?.license_plate || prev.licensePlate || '',
        driverPhone: driverData?.phone || prev.driverPhone || ''
      };
    });
  }, []);

  // 重新加载司机列表（添加新司机后调用）
  const handleDriversUpdate = async () => {
    if (formData.projectId) {
      // 重新加载项目关联的司机列表
      await loadProjectSpecificData(formData.projectId);
    }
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
            
            {/* [修改] 司机改为支持搜索和自定义输入的复合组件 */}
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
              <DriverComboInput
                drivers={drivers}
                value={formData.driverId}
                onChange={handleDriverSelect}
                onDriversUpdate={handleDriversUpdate}
                disabled={!formData.projectId}
                placeholder="搜索或选择司机"
                projectId={formData.projectId}
              />
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
                onCustomLocationAdd={(locationName) => {
                  // 打开地点编辑对话框
                  setLocationEditInitialName(locationName);
                  setLocationEditType('loading');
                  setLocationEditDialogOpen(true);
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
                onCustomLocationAdd={(locationName) => {
                  // 打开地点编辑对话框
                  setLocationEditInitialName(locationName);
                  setLocationEditType('unloading');
                  setLocationEditDialogOpen(true);
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
              <div className="ml-auto">
                <Button
                  type="button"
                  size="sm"
                  variant={costCalculationMode === 'auto' ? 'default' : 'outline'}
                  onClick={() => {
                    const newMode = costCalculationMode === 'manual' ? 'auto' : 'manual';
                    setCostCalculationMode(newMode);
                    if (newMode === 'manual') {
                      // 切换到手动模式时，清空单价和计算器
                      setFormData(prev => ({ ...prev, unitPrice: '' }));
                      setTaxIncludedPrice('');
                      setTaxRate('');
                    }
                  }}
                  className="text-xs"
                >
                  {costCalculationMode === 'auto' ? '✅ 自动计算模式' : '✏️ 手动输入模式'}
                </Button>
              </div>
            </div>
            
            {/* 含税单价计算器（仅在自动模式显示） */}
            {costCalculationMode === 'auto' && (
              <div className="mb-3 bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-blue-800">🧮 含税单价计算器</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label className="text-xs text-blue-600">含税单价（元/{unitLabel}）</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="含税价格"
                      className="mt-1 text-sm"
                      value={taxIncludedPrice}
                      onChange={(e) => setTaxIncludedPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-blue-600">税点（%）</Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="100"
                      placeholder="如：3"
                      className="mt-1 text-sm"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-xs text-blue-600 bg-white bg-opacity-60 p-2 rounded">
                  💡 公式：不含税单价 = 含税单价 × (1 - 税点%)
                </div>
              </div>
            )}

            {/* 单价输入（仅在自动模式显示） */}
            {costCalculationMode === 'auto' && (
              <div className="mb-4 bg-white p-3 rounded-lg border border-emerald-100">
                <Label className="text-xs text-emerald-600 font-medium">单价（元/{unitLabel}）</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={formData.unitPrice} 
                  onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: e.target.value }))} 
                  placeholder="单价（自动从含税单价计算）" 
                  className="mt-1"
                />
              </div>
            )}

            {/* 有效数量显示（仅在自动模式） */}
            {costCalculationMode === 'auto' && (
              <div className="mb-4 bg-white p-3 rounded-lg border border-blue-100">
                <Label className="text-xs text-blue-600 font-medium">有效数量（{unitLabel}）</Label>
                <Input 
                  type="text" 
                  value={effectiveQuantity.toFixed(3)} 
                  disabled
                  className="mt-1 bg-gray-50 text-gray-700 font-semibold"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const project = projects.find(p => p.id === formData.projectId);
                    const quantityType = project?.effective_quantity_type || 'min_value';
                    if (quantityType === 'loading') return `📦 按项目配置：取装货${unitLabel}`;
                    if (quantityType === 'unloading') return `📦 按项目配置：取卸货${unitLabel}`;
                    return `📦 按项目配置：取装货和卸货较小值（${unitLabel}）`;
                  })()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-emerald-600 font-medium">
                  运费(元) * {costCalculationMode === 'auto' && <span className="text-blue-500">（自动计算）</span>}
                </Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={formData.currentCost} 
                  onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))} 
                  placeholder={costCalculationMode === 'auto' ? "自动计算" : "输入运费"} 
                  className="mt-1"
                  disabled={costCalculationMode === 'auto'}
                  style={costCalculationMode === 'auto' ? { backgroundColor: '#f3f4f6', fontWeight: '600' } : {}}
                />
                {costCalculationMode === 'auto' && (
                  <div className="text-xs text-blue-600 mt-1">
                    计算公式：{formData.unitPrice} × {effectiveQuantity.toFixed(3)} = {formData.currentCost}
                  </div>
                )}
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
            
            {/* 统计信息卡片 */}
            <div className="bg-white p-3 rounded-lg border border-violet-100 mb-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-violet-600">📦</span>
                  <span className="text-gray-600">其他平台名称:</span>
                  <span className="font-semibold text-violet-600">
                    {formData.other_platform_names ? formData.other_platform_names.split(',').filter(Boolean).length : 0} 个
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />取消
            </Button>
            {!editingRecord && (
              <Button 
                type="submit" 
                disabled={loading}
                variant="secondary"
                onClick={() => setSaveAndContinue(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {loading && saveAndContinue ? '保存中...' : '保存并新增'}
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading}
              onClick={() => setSaveAndContinue(false)}
            >
              <Save className="mr-2 h-4 w-4" />
              {loading && !saveAndContinue ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      {/* 地点编辑对话框 */}
      <LocationEditDialog
        isOpen={locationEditDialogOpen}
        onClose={() => setLocationEditDialogOpen(false)}
        onSuccess={async (locationId) => {
          // 重新加载项目关联的地点列表
          if (formData.projectId) {
            await loadProjectSpecificData(formData.projectId);
            
            // 自动选择新添加的地点
            if (locationEditType === 'loading') {
              setFormData(prev => ({ 
                ...prev, 
                loadingLocationIds: [...prev.loadingLocationIds, locationId] 
              }));
            } else {
              setFormData(prev => ({ 
                ...prev, 
                unloadingLocationIds: [...prev.unloadingLocationIds, locationId] 
              }));
            }
          }
        }}
        projectId={formData.projectId}
        initialName={locationEditInitialName}
      />
    </Dialog>
  );
}




