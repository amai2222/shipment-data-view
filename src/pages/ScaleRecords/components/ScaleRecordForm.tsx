import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface Driver {
  id: string;
  name: string;
  license_plate: string;
}

interface BillingType {
  billing_type_id: number;
  type_name: string;
}

interface ScaleRecord {
  id: string;
  project_id: string;
  project_name: string;
  loading_date: string;
  trip_number: number;
  valid_quantity: number | null;
  billing_type_id: number;
  image_urls: string[];
  license_plate: string | null;
  driver_name: string | null;
  created_at: string;
  logistics_number: string | null;
}

interface ScaleRecordFormProps {
  projects: Project[];
  drivers: Driver[];
  onSuccess: () => void;
  editingRecord?: ScaleRecord | null;
}

interface NamingParams {
  date: string;
  licensePlate: string;
  tripNumber: number;
  projectName: string;
}

export function ScaleRecordForm({ projects, drivers, onSuccess, editingRecord }: ScaleRecordFormProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    loadingDate: new Date().toISOString().split('T')[0],
    licensePlate: '',
    tripNumber: 1,
    validQuantity: '',
    billingTypeId: '1',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);
  const [availableTrips, setAvailableTrips] = useState<number[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  const { toast } = useToast();

  const [projectDrivers, setProjectDrivers] = useState<Driver[]>([]);

  const driverOptions = useMemo(() => {
    const options = projectDrivers.map(driver => ({
      value: driver.license_plate,
      label: `${driver.license_plate} - ${driver.name}`
    }));
    
    // 在编辑模式下，如果当前车牌号不在项目司机列表中，添加它
    if (isEditMode && editingRecord?.license_plate) {
      const currentLicensePlate = editingRecord.license_plate;
      const exists = options.some(option => option.value === currentLicensePlate);
      if (!exists) {
        options.unshift({
          value: currentLicensePlate,
          label: `${currentLicensePlate} - ${editingRecord.driver_name || '未知司机'}`
        });
      }
    }
    
    return options;
  }, [projectDrivers, isEditMode, editingRecord]);

  useEffect(() => {
    loadBillingTypes();
  }, []);

  useEffect(() => {
    if (editingRecord) {
      console.log('编辑模式 - 接收到的记录数据:', editingRecord);
      setIsEditMode(true);
      const formData = {
        projectId: editingRecord.project_id,
        loadingDate: editingRecord.loading_date.split('T')[0],
        licensePlate: editingRecord.license_plate || '',
        tripNumber: editingRecord.trip_number,
        validQuantity: editingRecord.valid_quantity?.toString() || '',
        billingTypeId: editingRecord.billing_type_id.toString(),
      };
      console.log('编辑模式 - 设置的表单数据:', formData);
      setFormData(formData);
      setExistingImageUrls(editingRecord.image_urls || []);
    } else {
      setIsEditMode(false);
      setFormData({
        projectId: '',
        loadingDate: new Date().toISOString().split('T')[0],
        licensePlate: '',
        tripNumber: 1,
        validQuantity: '',
        billingTypeId: '1',
      });
      setExistingImageUrls([]);
    }
  }, [editingRecord]);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectDrivers();
      // 只有在非编辑模式下才重置车牌号
      if (!isEditMode) {
        setFormData(prev => ({ ...prev, licensePlate: '' }));
      }
    }
  }, [formData.projectId, isEditMode]);

  // 在编辑模式下，当项目司机加载完成后，确保车牌号选项可用
  useEffect(() => {
    if (isEditMode && editingRecord && projectDrivers.length > 0) {
      // 检查当前车牌号是否在项目司机列表中
      const currentLicensePlate = editingRecord.license_plate;
      if (currentLicensePlate && !projectDrivers.some(d => d.license_plate === currentLicensePlate)) {
        console.warn('编辑模式：当前车牌号不在项目司机列表中:', currentLicensePlate);
      }
    }
  }, [isEditMode, editingRecord, projectDrivers]);

  useEffect(() => {
    if (formData.projectId && formData.loadingDate && formData.licensePlate) {
      loadAvailableTrips();
    }
  }, [formData.projectId, formData.loadingDate, formData.licensePlate]);

  // 在编辑模式下，当所有必要数据都设置好后，加载可用车次
  useEffect(() => {
    if (isEditMode && editingRecord && formData.projectId && formData.loadingDate && formData.licensePlate) {
      loadAvailableTrips();
    }
  }, [isEditMode, editingRecord, formData.projectId, formData.loadingDate, formData.licensePlate]);

  const loadBillingTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_types')
        .select('billing_type_id, type_name')
        .order('billing_type_id');

      if (error) throw error;
      setBillingTypes(data || []);
    } catch (error) {
      console.error('Error loading billing types:', error);
    }
  };

  const loadProjectDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_projects')
        .select(`
          drivers (
            id,
            name,
            license_plate
          )
        `)
        .eq('project_id', formData.projectId);

      if (error) throw error;
      
      const drivers = data?.map(item => item.drivers).filter(Boolean) || [];
      setProjectDrivers(drivers as Driver[]);
    } catch (error) {
      console.error('Error loading project drivers:', error);
      setProjectDrivers([]);
    }
  };

  const loadAvailableTrips = async () => {
    try {
      let query = supabase
        .from('scale_records')
        .select('trip_number')
        .eq('project_id', formData.projectId)
        .eq('loading_date', formData.loadingDate)
        .eq('license_plate', formData.licensePlate);

      // 在编辑模式下，排除当前记录本身
      if (isEditMode && editingRecord?.id) {
        query = query.neq('id', editingRecord.id);
      }

      const { data, error } = await query.order('trip_number');

      if (error) throw error;

      const existingTrips = data?.map(record => record.trip_number) || [];
      let nextTrip = 1;
      while (existingTrips.includes(nextTrip)) {
        nextTrip++;
      }

      const availableOptions = [];
      
      // 在编辑模式下，包含当前记录的车次
      if (isEditMode && editingRecord?.trip_number) {
        const currentTrip = editingRecord.trip_number;
        availableOptions.push(currentTrip);
      }
      
      // 添加其他可用的车次
      for (let i = 1; i <= nextTrip; i++) {
        if (!existingTrips.includes(i) && !availableOptions.includes(i)) {
          availableOptions.push(i);
        }
      }
      
      // 如果没有可用选项，添加下一个车次
      if (availableOptions.length === 0) {
        availableOptions.push(nextTrip);
      }

      // 排序
      availableOptions.sort((a, b) => a - b);

      setAvailableTrips(availableOptions);
      
      // 只有在非编辑模式下才自动设置车次
      if (!isEditMode) {
        setFormData(prev => ({ ...prev, tripNumber: availableOptions[availableOptions.length - 1] }));
      }
    } catch (error) {
      console.error('Error loading available trips:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "警告",
        description: "只能上传图片文件",
        variant: "destructive",
      });
    }

    setSelectedFiles(prev => [...prev, ...imageFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (namingParams: NamingParams): Promise<string[]> => {
    if (selectedFiles.length === 0) return [];

    const filesToUpload = selectedFiles.map(file => ({
      fileName: file.name,
      fileData: ''
    }));

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          filesToUpload[i].fileData = base64.split(',')[1];
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    const { data, error } = await supabase.functions.invoke('qiniu-upload', {
      body: { 
        files: filesToUpload,
        namingParams: namingParams 
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Upload failed');

    return data.urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId) {
      toast({ title: "错误", description: "请选择项目", variant: "destructive" });
      return;
    }

    if (!formData.licensePlate) {
      toast({ title: "错误", description: "请选择车牌号", variant: "destructive" });
      return;
    }

    setUploading(true);

    try {
      const selectedProject = projects.find(p => p.id === formData.projectId);
      const selectedDriver = projectDrivers.find(d => d.license_plate === formData.licensePlate);

      let imageUrls = existingImageUrls;
      
      // 如果有新上传的文件，上传它们
      if (selectedFiles.length > 0) {
        const newImageUrls = await uploadFiles({
          date: formData.loadingDate,
          licensePlate: formData.licensePlate,
          tripNumber: formData.tripNumber,
          projectName: selectedProject?.name || 'UnknownProject'
        });
        imageUrls = [...existingImageUrls, ...newImageUrls];
      }

      const recordData = {
        project_id: formData.projectId,
        project_name: selectedProject?.name || '',
        loading_date: formData.loadingDate,
        trip_number: formData.tripNumber,
        valid_quantity: formData.validQuantity ? parseFloat(formData.validQuantity) : null,
        billing_type_id: parseInt(formData.billingTypeId),
        image_urls: imageUrls,
        license_plate: formData.licensePlate,
        driver_name: selectedDriver?.name || null,
      };

      if (isEditMode && editingRecord) {
        // 更新现有记录
        const { error } = await supabase
          .from('scale_records')
          .update(recordData)
          .eq('id', editingRecord.id);

        if (error) throw error;
      } else {
        // 创建新记录
        const { error } = await supabase
          .from('scale_records')
          .insert(recordData);

        if (error) throw error;
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving record:', error);
      toast({
        title: "错误",
        description: isEditMode ? "更新磅单记录失败" : "保存磅单记录失败",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="project">项目 *</Label>
          <Select 
            value={formData.projectId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.filter(project => project.id && project.id.trim() !== '').map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="loadingDate">装车日期 *</Label>
          <Input
            id="loadingDate"
            type="date"
            value={formData.loadingDate}
            onChange={(e) => setFormData(prev => ({ ...prev, loadingDate: e.target.value }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="licensePlate">车牌号 *</Label>
          <Combobox
            options={driverOptions}
            value={formData.licensePlate}
            onValueChange={(value) => setFormData(prev => ({ ...prev, licensePlate: value }))}
            placeholder="选择或搜索车牌号"
            searchPlaceholder="搜索车牌号或司机姓名..."
            emptyMessage="未找到匹配的车牌号"
          />
        </div>

        <div>
          <Label htmlFor="tripNumber">车次</Label>
          <Select 
            value={formData.tripNumber.toString()} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, tripNumber: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableTrips.map((trip) => (
                <SelectItem key={trip} value={trip.toString()}>
                  第{trip}车次
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="validQuantity">有效数量 (吨)</Label>
          <Input
            id="validQuantity"
            type="number"
            step="0.01"
            placeholder="输入有效数量"
            value={formData.validQuantity}
            onChange={(e) => setFormData(prev => ({ ...prev, validQuantity: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="billingType">计费方式</Label>
          <Select 
            value={formData.billingTypeId} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, billingTypeId: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {billingTypes.map((type) => (
                <SelectItem key={type.billing_type_id} value={type.billing_type_id.toString()}>
                  {type.type_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>磅单图片</Label>
        <div className="mt-2">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="fileInput"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('fileInput')?.click()}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            选择图片
          </Button>
        </div>

        {(selectedFiles.length > 0 || existingImageUrls.length > 0) && (
          <div className="mt-4 space-y-2">
            {existingImageUrls.length > 0 && (
              <div>
                <Label>现有图片:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingImageUrls.map((url, index) => (
                    <div key={`existing-${index}`} className="relative">
                      <img 
                        src={url} 
                        alt={`现有图片 ${index + 1}`}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedFiles.length > 0 && (
              <div>
                <Label>新选择的文件:</Label>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={uploading}>
          {uploading ? (isEditMode ? '更新中...' : '保存中...') : (isEditMode ? '更新' : '保存')}
        </Button>
      </div>
    </form>
  );
}
