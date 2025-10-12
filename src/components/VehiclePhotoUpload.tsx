// 车辆照片上传组件
// 支持行驶证、道路运输许可证的多张照片上传
// 上传到七牛云的Truck目录

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Eye, FileImage, Loader2, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface VehiclePhotos {
  driving_license_photos: string[]; // 行驶证照片
  transport_license_photos: string[]; // 道路运输许可证照片
}

interface VehiclePhotoUploadProps {
  driverName: string;
  licensePlate: string;
  existingPhotos?: VehiclePhotos;
  onChange: (photos: VehiclePhotos) => void;
}

type PhotoType = 'driving_license' | 'transport_license';

interface PhotoTypeConfig {
  key: keyof VehiclePhotos;
  label: string;
  color: string;
  maxCount: number;
}

const PHOTO_TYPES: Record<PhotoType, PhotoTypeConfig> = {
  driving_license: {
    key: 'driving_license_photos',
    label: '行驶证',
    color: 'bg-purple-100 text-purple-800',
    maxCount: 2 // 正副页
  },
  transport_license: {
    key: 'transport_license_photos',
    label: '道路运输许可证',
    color: 'bg-orange-100 text-orange-800',
    maxCount: 2 // 正副页
  }
};

export function VehiclePhotoUpload({ 
  driverName, 
  licensePlate, 
  existingPhotos = { driving_license_photos: [], transport_license_photos: [] },
  onChange 
}: VehiclePhotoUploadProps) {
  const [photos, setPhotos] = useState<VehiclePhotos>(existingPhotos);
  const [selectedFiles, setSelectedFiles] = useState<Record<PhotoType, File[]>>({
    driving_license: [],
    transport_license: []
  });
  const [uploading, setUploading] = useState<Record<PhotoType, boolean>>({
    driving_license: false,
    transport_license: false
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { toast } = useToast();

  // 处理文件选择
  const handleFileSelect = (type: PhotoType, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "请选择图片文件",
        description: "只支持图片格式的文件",
        variant: "destructive",
      });
      return;
    }

    const config = PHOTO_TYPES[type];
    const currentCount = photos[config.key].length + selectedFiles[type].length;
    
    if (currentCount + imageFiles.length > config.maxCount) {
      toast({
        title: "照片数量超限",
        description: `${config.label}最多只能上传${config.maxCount}张照片`,
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(prev => ({
      ...prev,
      [type]: [...prev[type], ...imageFiles]
    }));
  };

  // 上传文件到七牛云
  const uploadToQiniu = async (type: PhotoType) => {
    const files = selectedFiles[type];
    if (files.length === 0) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const config = PHOTO_TYPES[type];
      const timestamp = Date.now();
      
      // 准备上传文件
      const filesToUpload = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop();
        const customFileName = `${config.label}-${driverName}-${licensePlate}-${timestamp}-${i + 1}.${fileExtension}`;
        
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            resolve(base64.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });

        filesToUpload.push({
          fileName: file.name,
          fileData: fileData,
          customName: customFileName
        });
      }

      // 调用七牛云上传函数
      const { data, error } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: filesToUpload.map(f => ({
            fileName: f.fileName,
            fileData: f.fileData
          })),
          namingParams: {
            projectName: 'Truck', // 上传到Truck目录
            customName: filesToUpload[0].customName
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || '上传失败');

      // 更新照片列表
      const newPhotos = {
        ...photos,
        [config.key]: [...photos[config.key], ...data.urls]
      };
      
      setPhotos(newPhotos);
      onChange(newPhotos);

      // 清空已选择的文件
      setSelectedFiles(prev => ({
        ...prev,
        [type]: []
      }));

      toast({
        title: "上传成功",
        description: `已成功上传${files.length}张${config.label}照片`,
      });

    } catch (error: any) {
      console.error('上传失败:', error);
      toast({
        title: "上传失败",
        description: error.message || "请重试",
        variant: "destructive",
      });
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  // 删除照片
  const removePhoto = (type: PhotoType, index: number) => {
    const config = PHOTO_TYPES[type];
    const newPhotos = {
      ...photos,
      [config.key]: photos[config.key].filter((_, i) => i !== index)
    };
    setPhotos(newPhotos);
    onChange(newPhotos);
  };

  // 删除选中的文件
  const removeSelectedFile = (type: PhotoType, index: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  // 预览照片
  const previewPhoto = (url: string) => {
    setPreviewImage(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-medium">车辆证件照片</h3>
      </div>

      {Object.entries(PHOTO_TYPES).map(([type, config]) => (
        <Card key={type} className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                <span>{config.label}</span>
                <Badge variant="secondary" className={config.color}>
                  {photos[config.key].length}/{config.maxCount}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 已上传的照片 */}
            {photos[config.key].length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos[config.key].map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`${config.label} ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => previewPhoto(url)}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(type as PhotoType, index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-1 left-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => previewPhoto(url)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 选中的文件 */}
            {selectedFiles[type as PhotoType].length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">待上传文件</Label>
                <div className="space-y-2">
                  {selectedFiles[type as PhotoType].map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uploadToQiniu(type as PhotoType)}
                          disabled={uploading[type as PhotoType]}
                        >
                          {uploading[type as PhotoType] ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              上传中
                            </>
                          ) : (
                            <>
                              <Upload className="h-3 w-3 mr-1" />
                              上传
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSelectedFile(type as PhotoType, index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 文件选择 */}
            {photos[config.key].length < config.maxCount && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(type as PhotoType, e)}
                  className="hidden"
                  id={`vehicle-${type}-upload`}
                />
                <Label
                  htmlFor={`vehicle-${type}-upload`}
                  className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                >
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
                    <p className="text-sm text-gray-600">
                      点击选择{config.label}照片
                    </p>
                    <p className="text-xs text-gray-500">
                      支持 JPG、PNG 格式，最多{config.maxCount}张
                    </p>
                  </div>
                </Label>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* 照片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage}
                alt="预览"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setPreviewImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
