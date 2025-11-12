import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react';
import { formatChinaDateString } from '@/utils/dateUtils';

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

interface MobileScaleRecordFormProps {
  projects: Project[];
  onSuccess: () => void;
  onCancel: () => void;
}

interface NamingParams {
  date: string;
  licensePlate: string;
  tripNumber: number;
  projectName: string;
}

export function MobileScaleRecordForm({ projects, onSuccess, onCancel }: MobileScaleRecordFormProps) {
  const [formData, setFormData] = useState({
    projectId: '',
    // 使用中国时区的今天日期
    loadingDate: formatChinaDateString(new Date()),
    licensePlate: '',
    driverName: '',
    tripNumber: 1,
    validQuantity: '',
    billingTypeId: '1',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);
  const [availableTrips, setAvailableTrips] = useState<number[]>([]);
  const [projectDrivers, setProjectDrivers] = useState<Driver[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadBillingTypes();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      loadProjectDrivers();
      setFormData(prev => ({ ...prev, licensePlate: '', driverName: '' }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (formData.projectId && formData.loadingDate && formData.licensePlate) {
      loadAvailableTrips();
    }
  }, [formData.projectId, formData.loadingDate, formData.licensePlate]);

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
      const { data, error } = await supabase
        .from('scale_records')
        .select('trip_number')
        .eq('project_id', formData.projectId)
        .eq('loading_date', formData.loadingDate)
        .eq('license_plate', formData.licensePlate)
        .order('trip_number');

      if (error) throw error;

      const existingTrips = data?.map(record => record.trip_number) || [];
      let nextTrip = 1;
      while (existingTrips.includes(nextTrip)) {
        nextTrip++;
      }

      const availableOptions = [];
      for (let i = 1; i <= nextTrip; i++) {
        if (!existingTrips.includes(i)) {
          availableOptions.push(i);
        }
      }
      if (availableOptions.length === 0) {
        availableOptions.push(nextTrip);
      }

      setAvailableTrips(availableOptions);
      setFormData(prev => ({ ...prev, tripNumber: availableOptions[availableOptions.length - 1] }));
    } catch (error) {
      console.error('Error loading available trips:', error);
    }
  };

  const handleDriverSelect = (licensePlate: string) => {
    const selectedDriver = projectDrivers.find(d => d.license_plate === licensePlate);
    setFormData(prev => ({
      ...prev,
      licensePlate,
      driverName: selectedDriver?.name || ''
    }));
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

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 后置摄像头
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setSelectedFiles(prev => [...prev, file]);
      }
    };
    input.click();
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

      const imageUrls = await uploadFiles({
        date: formData.loadingDate,
        licensePlate: formData.licensePlate,
        tripNumber: formData.tripNumber,
        projectName: selectedProject?.name || 'UnknownProject'
      });

      const { error } = await supabase
        .from('scale_records')
        .insert({
          project_id: formData.projectId,
          project_name: selectedProject?.name || '',
          loading_date: formData.loadingDate,
          trip_number: formData.tripNumber,
          valid_quantity: formData.validQuantity ? parseFloat(formData.validQuantity) : null,
          billing_type_id: parseInt(formData.billingTypeId),
          image_urls: imageUrls,
          license_plate: formData.licensePlate,
          driver_name: formData.driverName || null,
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "磅单记录已保存",
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving record:', error);
      toast({
        title: "错误",
        description: "保存磅单记录失败",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
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
          <Select 
            value={formData.licensePlate} 
            onValueChange={handleDriverSelect}
            disabled={!formData.projectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择车牌号" />
            </SelectTrigger>
            <SelectContent>
              {projectDrivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.license_plate}>
                  {driver.license_plate} - {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.driverName && (
          <div>
            <Label>司机姓名</Label>
            <Input
              value={formData.driverName}
              disabled
              className="bg-muted"
            />
          </div>
        )}

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
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
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
              <ImageIcon className="h-4 w-4 mr-2" />
              选择图片
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCameraCapture}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              拍照
            </Button>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <Label>已选择 {selectedFiles.length} 张图片:</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="flex-1 truncate">{file.name}</span>
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
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button type="submit" disabled={uploading} className="flex-1">
          {uploading ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}