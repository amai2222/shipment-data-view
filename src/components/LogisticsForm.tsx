import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, Driver, Location, PartnerChain } from "@/types";

interface LogisticsFormProps {
  formData: {
    projectId: string;
    chainId: string;
    loadingTime: string;
    loadingLocation: string;
    unloadingLocation: string;
    driverId: string;
    loadingWeight: string;
    unloadingDate: string;
    unloadingWeight: string;
    transportType: "实际运输" | "退货";
    currentFee: string;
    extraFee: string;
    driverReceivable: string;
    remarks: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  projects: Project[];
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  className?: string;
}

export function LogisticsForm({ 
  formData, 
  setFormData, 
  projects, 
  onSubmit, 
  submitLabel = "保存记录",
  className = ""
}: LogisticsFormProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedDrivers, loadedLocations] = await Promise.all([
          SupabaseStorage.getDrivers(),
          SupabaseStorage.getLocations(),
        ]);
        setDrivers(loadedDrivers);
        setLocations(loadedLocations);
      } catch (error) {
        console.error('Error loading form data:', error);
      }
    };
    loadData();
  }, []);

  // 加载项目的合作链路
  const loadPartnerChains = async (projectId: string) => {
    if (!projectId) {
      setPartnerChains([]);
      return;
    }
    try {
      const chains = await SupabaseStorage.getPartnerChains(projectId);
      setPartnerChains(chains.map(chain => ({
        id: chain.id,
        projectId: chain.project_id,
        chainName: chain.chain_name,
        description: chain.description,
        isDefault: chain.is_default,
        createdAt: chain.created_at,
      })));
    } catch (error) {
      console.error('Error loading partner chains:', error);
      setPartnerChains([]);
    }
  };

  // 当项目选择变化时加载合作链路并过滤司机和地点
  useEffect(() => {
    if (formData.projectId) {
      loadPartnerChains(formData.projectId);
      setFormData((prev: any) => ({ ...prev, chainId: "" })); // 重置链路选择
      
      // 过滤司机：优先显示该项目的司机，然后显示没有项目关联的司机
      const projectDrivers = drivers.filter(d => d.projectIds?.includes(formData.projectId));
      const noProjectDrivers = drivers.filter(d => !d.projectIds || d.projectIds.length === 0);
      setFilteredDrivers([...projectDrivers, ...noProjectDrivers]);
      
      // 过滤地点：优先显示该项目的地点，然后显示没有项目关联的地点
      const projectLocations = locations.filter(l => l.projectIds?.includes(formData.projectId));
      const noProjectLocations = locations.filter(l => !l.projectIds || l.projectIds.length === 0);
      setFilteredLocations([...projectLocations, ...noProjectLocations]);
    } else {
      setPartnerChains([]);
      setFilteredDrivers(drivers);
      setFilteredLocations(locations);
    }
  }, [formData.projectId, drivers, locations]);

  // 当项目和链路都选择后，自动选择默认链路
  useEffect(() => {
    if (formData.projectId && partnerChains.length > 0 && !formData.chainId) {
      const defaultChain = partnerChains.find(chain => chain.isDefault);
      if (defaultChain) {
        setFormData((prev: any) => ({ ...prev, chainId: defaultChain.id }));
      }
    }
  }, [formData.projectId, partnerChains, formData.chainId]);

  const handleDriverChange = async (value: string) => {
    // 如果是新司机（不在现有列表中），创建新司机
    if (!filteredDrivers.find(d => `${d.name} (${d.licensePlate})` === value)) {
      // 解析司机名称和车牌号
      const match = value.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        const [, name, licensePlate] = match;
        try {
          const newDriver = await SupabaseStorage.addDriver({
            name: name.trim(),
            licensePlate: licensePlate.trim(),
            phone: "", // 默认空电话
            projectIds: formData.projectId ? [formData.projectId] : []
          });
          setDrivers(prev => [...prev, newDriver]);
          setFormData((prev: any) => ({ ...prev, driverId: newDriver.id }));
        } catch (error) {
          console.error('Error creating driver:', error);
        }
      }
    } else {
      // 现有司机
      const driver = filteredDrivers.find(d => `${d.name} (${d.licensePlate})` === value);
      if (driver) {
        setFormData((prev: any) => ({ ...prev, driverId: driver.id }));
      }
    }
  };

  const handleLocationChange = async (value: string, field: 'loadingLocation' | 'unloadingLocation') => {
    // 如果是新地点（不在现有列表中），创建新地点
    if (!filteredLocations.find(l => l.name === value)) {
      try {
        const newLocation = await SupabaseStorage.addLocation({
          name: value,
          projectIds: formData.projectId ? [formData.projectId] : []
        });
        setLocations(prev => [...prev, newLocation]);
        setFormData((prev: any) => ({ ...prev, [field]: value }));
      } catch (error) {
        console.error('Error creating location:', error);
      }
    } else {
      setFormData((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <form onSubmit={onSubmit} className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="project">项目 *</Label>
          <Select value={formData.projectId} onValueChange={(value) => setFormData((prev: any) => ({ ...prev, projectId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-md">
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="chain">合作链路 *</Label>
          <Select value={formData.chainId} onValueChange={(value) => setFormData((prev: any) => ({ ...prev, chainId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="选择合作链路" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-md">
              {partnerChains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id}>
                  {chain.chainName}
                  {chain.isDefault && " (默认)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="loadingTime">装车时间 *</Label>
          <Input
            id="loadingTime"
            type="datetime-local"
            value={formData.loadingTime}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, loadingTime: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="loadingLocation">装车地点 *</Label>
          <Combobox
            options={filteredLocations.map(location => ({ value: location.name, label: location.name }))}
            value={formData.loadingLocation}
            onValueChange={(value) => handleLocationChange(value, 'loadingLocation')}
            placeholder="选择或输入装车地点"
            searchPlaceholder="搜索地点..."
            emptyMessage="无匹配地点"
            onCreateNew={async (value) => handleLocationChange(value, 'loadingLocation')}
          />
        </div>

        <div>
          <Label htmlFor="unloadingLocation">卸车地点 *</Label>
          <Combobox
            options={filteredLocations.map(location => ({ value: location.name, label: location.name }))}
            value={formData.unloadingLocation}
            onValueChange={(value) => handleLocationChange(value, 'unloadingLocation')}
            placeholder="选择或输入卸车地点"
            searchPlaceholder="搜索地点..."
            emptyMessage="无匹配地点"
            onCreateNew={async (value) => handleLocationChange(value, 'unloadingLocation')}
          />
        </div>

        <div>
          <Label htmlFor="driver">司机 *</Label>
          <Combobox
            options={filteredDrivers.map(driver => ({
              value: `${driver.name} (${driver.licensePlate})`,
              label: `${driver.name} (${driver.licensePlate})`
            }))}
            value={filteredDrivers.find(d => d.id === formData.driverId) ? 
              `${filteredDrivers.find(d => d.id === formData.driverId)!.name} (${filteredDrivers.find(d => d.id === formData.driverId)!.licensePlate})` : ''}
            onValueChange={handleDriverChange}
            placeholder="选择或输入司机"
            searchPlaceholder="搜索司机..."
            emptyMessage="无匹配司机"
            onCreateNew={async (value) => handleDriverChange(value)}
          />
        </div>

        <div>
          <Label htmlFor="loadingWeight">装车重量(吨) *</Label>
          <Input
            id="loadingWeight"
            type="number"
            step="0.1"
            value={formData.loadingWeight}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, loadingWeight: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="unloadingDate">卸车日期</Label>
          <Input
            id="unloadingDate"
            type="date"
            value={formData.unloadingDate}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, unloadingDate: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="unloadingWeight">卸车重量(吨)</Label>
          <Input
            id="unloadingWeight"
            type="number"
            step="0.1"
            value={formData.unloadingWeight}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, unloadingWeight: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="transportType">运输类型</Label>
          <Select value={formData.transportType} onValueChange={(value: "实际运输" | "退货") => setFormData((prev: any) => ({ ...prev, transportType: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border shadow-md">
              <SelectItem value="实际运输">实际运输</SelectItem>
              <SelectItem value="退货">退货</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="currentFee">当前费用(元)</Label>
          <Input
            id="currentFee"
            type="number"
            step="0.01"
            value={formData.currentFee}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, currentFee: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="extraFee">额外费用(元)</Label>
          <Input
            id="extraFee"
            type="number"
            step="0.01"
            value={formData.extraFee}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, extraFee: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="driverReceivable">司机应收(元)</Label>
          <Input
            id="driverReceivable"
            type="number"
            step="0.01"
            value={formData.driverReceivable}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, driverReceivable: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="remarks">备注</Label>
        <Textarea
          id="remarks"
          value={formData.remarks}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, remarks: e.target.value }))}
          placeholder="添加备注信息..."
        />
      </div>

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}