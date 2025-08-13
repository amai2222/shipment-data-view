import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Save, X, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsRecord, Project } from '../types';
import { SimpleCreatableCombobox } from "@/components/SimpleCreatableCombobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

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

interface PartnerChain {
  id: string;
  chain_name: string;
  billing_type_id: number | null;
  is_default: boolean;
}

interface LogisticsFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecord?: LogisticsRecord | null;
  projects: Project[];
  onSubmitSuccess: () => void;
}

interface FormData {
  projectId: string;
  chainId: string;
  loadingDate: Date | undefined;
  unloadingDate: Date | undefined;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  loadingLocation: string;
  unloadingLocation: string;
  loadingQuantity: string;
  unloadingQuantity: string;
  transportType: string;
  currentCost: string;
  extraCost: string;
  remarks: string;
  // New fields for step 2
  loadingVolume: string;
  unloadingVolume: string;
  tripCount: string;
}

const INITIAL_FORM_DATA: FormData = {
  projectId: '',
  chainId: '',
  loadingDate: new Date(),
  unloadingDate: new Date(),
  driverName: '',
  licensePlate: '',
  driverPhone: '',
  loadingLocation: '',
  unloadingLocation: '',
  loadingQuantity: '',
  unloadingQuantity: '',
  transportType: '实际运输',
  currentCost: '',
  extraCost: '',
  remarks: '',
  loadingVolume: '',
  unloadingVolume: '',
  tripCount: '1'
};

export function LogisticsFormDialog({ isOpen, onClose, editingRecord, projects, onSubmitSuccess }: LogisticsFormDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [chains, setChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(false);

  // Get billing type info for current chain
  const selectedChain = useMemo(() => 
    chains.find(c => c.id === formData.chainId), 
    [chains, formData.chainId]
  );

  const billingTypeId = selectedChain?.billing_type_id;
  const showStep2 = billingTypeId === 2 || billingTypeId === 3;

  const quantityUnit = useMemo(() => {
    if (billingTypeId === 2) return '车';
    if (billingTypeId === 3) return '立方';
    return '吨'; // default for billing_type_id = 1 or null
  }, [billingTypeId]);

  // Calculate driver receivable automatically
  const driverReceivable = useMemo(() => {
    const current = parseFloat(formData.currentCost) || 0;
    const extra = parseFloat(formData.extraCost) || 0;
    return current + extra;
  }, [formData.currentCost, formData.extraCost]);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      loadInitialData();
      if (editingRecord) {
        populateFormWithRecord(editingRecord);
      } else {
        setFormData(INITIAL_FORM_DATA);
      }
    }
  }, [isOpen, editingRecord]);

  // Load partner chains and project-specific data when project changes
  useEffect(() => {
    if (formData.projectId) {
      loadPartnerChains(formData.projectId);
      loadProjectDriversAndLocations(formData.projectId);
    } else {
      setChains([]);
      setDrivers([]);
      setLocations([]);
      setFormData(prev => ({ ...prev, chainId: '' }));
    }
  }, [formData.projectId]);

  // Auto-select default chain whenever chains are loaded
  useEffect(() => {
    if (chains.length > 0 && !editingRecord) {
      const defaultChain = chains.find(c => c.is_default);
      if (defaultChain) {
        setFormData(prev => ({ ...prev, chainId: defaultChain.id }));
      }
    }
  }, [chains, editingRecord]);

  const loadInitialData = async () => {
    // Initial data will be loaded when project is selected
  };

  const loadProjectDriversAndLocations = async (projectId: string) => {
    try {
      const [driversRes, locationsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, name, license_plate, phone')
          .in('id', 
            await supabase
              .from('driver_projects')
              .select('driver_id')
              .eq('project_id', projectId)
              .then(res => res.data?.map(dp => dp.driver_id) || [])
          ),
        supabase
          .from('locations')
          .select('id, name')
          .in('id',
            await supabase
              .from('location_projects')
              .select('location_id')
              .eq('project_id', projectId)
              .then(res => res.data?.map(lp => lp.location_id) || [])
          )
      ]);

      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
    } catch (error) {
      console.error('Error loading project data:', error);
      toast({ title: "错误", description: "加载项目数据失败", variant: "destructive" });
    }
  };

  const loadPartnerChains = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('partner_chains')
        .select('id, chain_name, billing_type_id, is_default')
        .eq('project_id', projectId);

      if (error) throw error;
      setChains(data || []);
    } catch (error) {
      console.error('Error loading partner chains:', error);
      setChains([]);
    }
  };

  const populateFormWithRecord = (record: LogisticsRecord) => {
    setFormData({
      projectId: record.project_id || '',
      chainId: record.chain_id || '',
      loadingDate: record.loading_date ? new Date(record.loading_date) : new Date(),
      unloadingDate: record.unloading_date ? new Date(record.unloading_date) : new Date(),
      driverName: record.driver_name || '',
      licensePlate: record.license_plate || '',
      driverPhone: record.driver_phone || '',
      loadingLocation: record.loading_location || '',
      unloadingLocation: record.unloading_location || '',
      loadingQuantity: record.loading_weight?.toString() || '',
      unloadingQuantity: record.unloading_weight?.toString() || '',
      transportType: record.transport_type || '实际运输',
      currentCost: record.current_cost?.toString() || '',
      extraCost: record.extra_cost?.toString() || '',
      remarks: record.remarks || '',
      loadingVolume: '',
      unloadingVolume: '',
      tripCount: '1'
    });
  };

  const validateStep1 = () => {
    if (!formData.projectId || !formData.loadingDate || !formData.driverName || 
        !formData.loadingLocation || !formData.unloadingLocation) {
      toast({ title: "错误", description: "请填写所有必填字段", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get or create driver
      const { data: driverData, error: driverError } = await supabase.rpc('get_or_create_driver', {
        p_driver_name: formData.driverName,
        p_license_plate: formData.licensePlate,
        p_phone: formData.driverPhone,
        p_project_id: formData.projectId
      });

      if (driverError) throw driverError;

      // Get or create locations
      const [loadingLocationId, unloadingLocationId] = await Promise.all([
        supabase.rpc('get_or_create_location', {
          p_location_name: formData.loadingLocation,
          p_project_id: formData.projectId
        }),
        supabase.rpc('get_or_create_location', {
          p_location_name: formData.unloadingLocation,
          p_project_id: formData.projectId
        })
      ]);

      if (loadingLocationId.error) throw loadingLocationId.error;
      if (unloadingLocationId.error) throw unloadingLocationId.error;

      const project = projects.find(p => p.id === formData.projectId);

      // Determine quantities based on billing type
      let loadingWeight = null;
      let unloadingWeight = null;

      if (billingTypeId === 2) {
        // For billing_type_id = 2, use trip count
        loadingWeight = parseFloat(formData.tripCount) || null;
        unloadingWeight = parseFloat(formData.tripCount) || null;
      } else if (billingTypeId === 3) {
        // For billing_type_id = 3, use volume
        loadingWeight = parseFloat(formData.loadingVolume) || null;
        unloadingWeight = parseFloat(formData.unloadingVolume) || null;
      } else {
        // Default: use weight
        loadingWeight = parseFloat(formData.loadingQuantity) || null;
        unloadingWeight = formData.unloadingQuantity ? parseFloat(formData.unloadingQuantity) : null;
      }

      const recordData = {
        project_id: formData.projectId,
        project_name: project?.name || '',
        chain_id: formData.chainId || null,
        driver_id: driverData[0]?.driver_id,
        driver_name: formData.driverName,
        license_plate: formData.licensePlate,
        driver_phone: formData.driverPhone,
        loading_location: formData.loadingLocation,
        unloading_location: formData.unloadingLocation,
        loading_date: format(formData.loadingDate!, 'yyyy-MM-dd'),
        unloading_date: formData.unloadingDate ? format(formData.unloadingDate, 'yyyy-MM-dd') : null,
        loading_weight: loadingWeight,
        unloading_weight: unloadingWeight,
        transport_type: formData.transportType,
        current_cost: parseFloat(formData.currentCost) || null,
        extra_cost: parseFloat(formData.extraCost) || null,
        payable_cost: driverReceivable,
        remarks: formData.remarks || null,
        created_by_user_id: (await supabase.auth.getUser()).data.user?.id
      };

      if (editingRecord) {
        // Update existing record
        const { error } = await supabase.rpc('update_logistics_record_via_recalc', {
          p_record_id: editingRecord.id,
          p_project_id: recordData.project_id,
          p_project_name: recordData.project_name,
          p_chain_id: recordData.chain_id,
          p_driver_id: recordData.driver_id,
          p_driver_name: recordData.driver_name,
          p_loading_location: recordData.loading_location,
          p_unloading_location: recordData.unloading_location,
          p_loading_date: recordData.loading_date,
          p_loading_weight: recordData.loading_weight,
          p_unloading_weight: recordData.unloading_weight,
          p_current_cost: recordData.current_cost,
          p_license_plate: recordData.license_plate,
          p_driver_phone: recordData.driver_phone,
          p_transport_type: recordData.transport_type,
          p_extra_cost: recordData.extra_cost,
          p_remarks: recordData.remarks,
          p_unloading_date: recordData.unloading_date
        });
        if (error) throw error;
        toast({ title: "成功", description: "运单已更新" });
      } else {
        // Create new record - generate auto_number first
        const currentDate = format(formData.loadingDate!, 'yyyyMMdd');
        const autoNumber = `YDN${currentDate}-001`; // This should be generated properly
        
        const { error } = await supabase.from('logistics_records').insert([{
          ...recordData,
          auto_number: autoNumber
        }]);
        if (error) throw error;
        toast({ title: "成功", description: "运单已创建" });
      }

      onSubmitSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving record:', error);
      toast({ title: "错误", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDriverSelect = (value: string) => {
    const driver = drivers.find(d => d.name === value);
    if (driver) {
      setFormData(prev => ({
        ...prev,
        driverName: driver.name,
        licensePlate: driver.license_plate || '',
        driverPhone: driver.phone || ''
      }));
    } else {
      setFormData(prev => ({ ...prev, driverName: value }));
    }
  };

  const handleCreateDriver = (value: string) => {
    setFormData(prev => ({ ...prev, driverName: value }));
  };

  const handleCreateLocation = (value: string, type: 'loading' | 'unloading') => {
    if (type === 'loading') {
      setFormData(prev => ({ ...prev, loadingLocation: value }));
    } else {
      setFormData(prev => ({ ...prev, unloadingLocation: value }));
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Selection */}
        <div>
          <Label htmlFor="project">项目 *</Label>
          <Select value={formData.projectId} onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}>
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

        {/* Partner Chain */}
        <div>
          <Label htmlFor="chain">合作链路</Label>
          <Select value={formData.chainId} onValueChange={(value) => setFormData(prev => ({ ...prev, chainId: value }))}>
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

        {/* Loading Date */}
        <div>
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
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.loadingDate}
                onSelect={(date) => setFormData(prev => ({ ...prev, loadingDate: date }))}
                initialFocus
                className="pointer-events-auto"
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Unloading Date */}
        <div>
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
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.unloadingDate}
                onSelect={(date) => setFormData(prev => ({ ...prev, unloadingDate: date }))}
                initialFocus
                className="pointer-events-auto"
                locale={zhCN}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Driver */}
        <div>
          <Label>司机 *</Label>
          <SimpleCreatableCombobox
            options={(drivers || []).map(d => ({ 
              value: d.name, 
              label: `${d.name} - ${d.license_plate || ''}` 
            }))}
            value={formData.driverName}
            onValueChange={handleDriverSelect}
            onCreateNew={handleCreateDriver}
            placeholder="选择或输入司机"
          />
        </div>

        {/* License Plate */}
        <div>
          <Label htmlFor="licensePlate">车牌号</Label>
          <Input
            id="licensePlate"
            value={formData.licensePlate}
            onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value }))}
            placeholder="输入车牌号"
          />
        </div>

        {/* Driver Phone */}
        <div>
          <Label htmlFor="driverPhone">司机电话</Label>
          <Input
            id="driverPhone"
            value={formData.driverPhone}
            onChange={(e) => setFormData(prev => ({ ...prev, driverPhone: e.target.value }))}
            placeholder="输入司机电话"
          />
        </div>

        {/* Transport Type */}
        <div>
          <Label htmlFor="transportType">运输类型</Label>
          <Select value={formData.transportType} onValueChange={(value) => setFormData(prev => ({ ...prev, transportType: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="实际运输">实际运输</SelectItem>
              <SelectItem value="退货">退货</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading Location */}
        <div>
          <Label>装货地点 *</Label>
          <SimpleCreatableCombobox
            options={(locations || []).map(l => ({ value: l.name, label: l.name }))}
            value={formData.loadingLocation}
            onValueChange={(value) => setFormData(prev => ({ ...prev, loadingLocation: value }))}
            onCreateNew={(value) => handleCreateLocation(value, 'loading')}
            placeholder="选择或输入装货地点"
          />
        </div>

        {/* Unloading Location */}
        <div>
          <Label>卸货地点 *</Label>
          <SimpleCreatableCombobox
            options={(locations || []).map(l => ({ value: l.name, label: l.name }))}
            value={formData.unloadingLocation}
            onValueChange={(value) => setFormData(prev => ({ ...prev, unloadingLocation: value }))}
            onCreateNew={(value) => handleCreateLocation(value, 'unloading')}
            placeholder="选择或输入卸货地点"
          />
        </div>
      </div>

      {/* Remarks */}
      <div>
        <Label htmlFor="remarks">备注</Label>
        <Textarea
          id="remarks"
          value={formData.remarks}
          onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
          placeholder="输入备注信息"
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      {billingTypeId === 2 && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="tripCount">发车次数</Label>
            <Input
              id="tripCount"
              type="number"
              min="1"
              value={formData.tripCount}
              onChange={(e) => setFormData(prev => ({ ...prev, tripCount: e.target.value }))}
              placeholder="输入发车次数"
            />
          </div>
        </div>
      )}

      {billingTypeId === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="loadingVolume">装货体积(立方) *</Label>
            <Input
              id="loadingVolume"
              type="number"
              step="0.1"
              value={formData.loadingVolume}
              onChange={(e) => setFormData(prev => ({ ...prev, loadingVolume: e.target.value }))}
              placeholder="输入装货体积(立方)"
            />
          </div>

          <div>
            <Label htmlFor="unloadingVolume">卸货体积(立方)</Label>
            <Input
              id="unloadingVolume"
              type="number"
              step="0.1"
              value={formData.unloadingVolume}
              onChange={(e) => setFormData(prev => ({ ...prev, unloadingVolume: e.target.value }))}
              placeholder="输入卸货体积(立方)"
            />
          </div>
        </div>
      )}

      {(billingTypeId === 1 || !billingTypeId) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="loadingQuantity">装货数量(吨) *</Label>
            <Input
              id="loadingQuantity"
              type="number"
              step="0.1"
              value={formData.loadingQuantity}
              onChange={(e) => setFormData(prev => ({ ...prev, loadingQuantity: e.target.value }))}
              placeholder="输入装货数量(吨)"
            />
          </div>

          <div>
            <Label htmlFor="unloadingQuantity">卸货数量(吨)</Label>
            <Input
              id="unloadingQuantity"
              type="number"
              step="0.1"
              value={formData.unloadingQuantity}
              onChange={(e) => setFormData(prev => ({ ...prev, unloadingQuantity: e.target.value }))}
              placeholder="输入卸货数量(吨)"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="currentCost">运费(元)</Label>
          <Input
            id="currentCost"
            type="number"
            step="0.01"
            value={formData.currentCost}
            onChange={(e) => setFormData(prev => ({ ...prev, currentCost: e.target.value }))}
            placeholder="输入运费"
          />
        </div>

        <div>
          <Label htmlFor="extraCost">额外费用(元)</Label>
          <Input
            id="extraCost"
            type="number"
            step="0.01"
            value={formData.extraCost}
            onChange={(e) => setFormData(prev => ({ ...prev, extraCost: e.target.value }))}
            placeholder="输入额外费用"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="driverReceivable">司机应收(元)</Label>
          <Input
            id="driverReceivable"
            type="number"
            value={driverReceivable.toFixed(2)}
            disabled
            className="bg-muted"
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRecord ? '编辑运单' : '新增运单'}
            {showStep2 && (
              <span className="ml-2 text-sm text-muted-foreground">
                第 {currentStep} 步，共 2 步
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <div>
              {currentStep === 2 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  上一步
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                取消
              </Button>
              
              {showStep2 && currentStep === 1 ? (
                <Button type="button" onClick={handleNext}>
                  下一步
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}