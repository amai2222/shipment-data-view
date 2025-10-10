// 司机照片上传组件
// 支持身份证、驾驶证、从业资格证的多张照片上传
// 上传到七牛云的driver目录

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Eye, FileImage, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface DriverPhotos {
  id_card_photos: string[];
  driver_license_photos: string[];
  qualification_certificate_photos: string[];
}

interface DriverPhotoUploadProps {
  driverName: string;
  licensePlate: string;
  existingPhotos?: DriverPhotos;
  onChange: (photos: DriverPhotos) => void;
}

type PhotoType = 'id_card' | 'driver_license' | 'qualification_certificate';

interface PhotoTypeConfig {
  key: keyof DriverPhotos;
  label: string;
  color: string;
  maxCount: number;
}

const PHOTO_TYPES: Record<PhotoType, PhotoTypeConfig> = {
  id_card: {
    key: 'id_card_photos',
    label: '身份证',
    color: 'bg-blue-100 text-blue-800',
    maxCount: 2 // 正反面
  },
  driver_license: {
    key: 'driver_license_photos',
    label: '驾驶证',
    color: 'bg-green-100 text-green-800',
    maxCount: 2 // 正副页
  },
  qualification_certificate: {
    key: 'qualification_certificate_photos',
    label: '从业资格证',
    color: 'bg-purple-100 text-purple-800',
    maxCount: 2 // 正反面
  }
};

export function DriverPhotoUpload({ 
  driverName, 
  licensePlate, 
  existingPhotos,
  onChange 
}: DriverPhotoUploadProps) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<DriverPhotos>(existingPhotos || {
    id_card_photos: [],
    driver_license_photos: [],
    qualification_certificate_photos: []
  });
  const [uploading, setUploading] = useState<PhotoType | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<PhotoType, File[]>>({
    id_card: [],
    driver_license: [],
    qualification_certificate: []
  });

  // 处理文件选择
  const handleFileSelect = (type: PhotoType, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: "警告",
        description: "只能上传图片文件",
        variant: "destructive",
      });
      return;
    }

    const config = PHOTO_TYPES[type];
    const currentCount = photos[config.key].length;
    const newCount = currentCount + imageFiles.length;

    if (newCount > config.maxCount) {
      toast({
        title: "超出限制",
        description: `${config.label}最多上传${config.maxCount}张照片`,
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

    setUploading(type);
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
            projectName: 'driver', // 上传到driver目录
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

      // 清空已选文件
      setSelectedFiles(prev => ({
        ...prev,
        [type]: []
      }));

      toast({
        title: "上传成功",
        description: `${config.label}照片已上传`,
      });

    } catch (error: any) {
      console.error('上传失败:', error);
      toast({
        title: "上传失败",
        description: error.message || '照片上传失败',
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  // 删除照片
  const handleDeletePhoto = (type: PhotoType, index: number) => {
    const config = PHOTO_TYPES[type];
    const newPhotos = {
      ...photos,
      [config.key]: photos[config.key].filter((_, i) => i !== index)
    };
    setPhotos(newPhotos);
    onChange(newPhotos);

    toast({
      title: "删除成功",
      description: `${config.label}照片已删除`,
    });
  };

  // 删除待上传的文件
  const handleRemoveSelectedFile = (type: PhotoType, index: number) => {
    setSelectedFiles(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  // 渲染单个照片类型的上传区域
  const renderPhotoSection = (type: PhotoType) => {
    const config = PHOTO_TYPES[type];
    const currentPhotos = photos[config.key];
    const pendingFiles = selectedFiles[type];
    const isUploading = uploading === type;
    const canUpload = currentPhotos.length + pendingFiles.length < config.maxCount;

    return (
      <Card key={type}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              <span>{config.label}</span>
              <Badge variant="outline" className={config.color}>
                {currentPhotos.length}/{config.maxCount}
              </Badge>
            </div>
            {canUpload && (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(type, e)}
                  className="hidden"
                  id={`upload-${type}`}
                  disabled={isUploading}
                />
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  disabled={isUploading}
                >
                  <label htmlFor={`upload-${type}`} className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    选择照片
                  </label>
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 已上传的照片 */}
          {currentPhotos.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">已上传照片</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {currentPhotos.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`${config.label}-${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewImage(url)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeletePhoto(type, index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setPreviewImage(url)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 待上传的文件 */}
          {pendingFiles.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">待上传照片</Label>
              <div className="space-y-2">
                {pendingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {(file.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSelectedFile(type, index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-2"
                onClick={() => uploadToQiniu(type)}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    上传 {pendingFiles.length} 张照片
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 空状态 */}
          {currentPhotos.length === 0 && pendingFiles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileImage className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无{config.label}照片</p>
              <p className="text-xs mt-1">点击"选择照片"上传（最多{config.maxCount}张）</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">司机证件照片</h3>
        <Badge variant="outline">
          共 {photos.id_card_photos.length + photos.driver_license_photos.length + photos.qualification_certificate_photos.length} 张照片
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {renderPhotoSection('id_card')}
        {renderPhotoSection('driver_license')}
        {renderPhotoSection('qualification_certificate')}
      </div>

      {/* 图片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <img
            src={previewImage || ''}
            alt="预览"
            className="w-full h-auto"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
