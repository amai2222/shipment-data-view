// 司机详情对话框组件
// 显示司机完整信息和所有证件照片

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Phone, 
  Truck, 
  FileImage, 
  Loader2,
  X,
  Eye,
  IdCard,
  Car
} from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface Driver {
  id: string;
  name: string;
  licensePlate: string;
  phone: string;
  id_card_photos?: string[];
  driver_license_photos?: string[];
  qualification_certificate_photos?: string[];
  driving_license_photos?: string[];
  transport_license_photos?: string[];
}

interface DriverDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  driverName: string;
  licensePlate?: string;
}

export function DriverDetailDialog({ 
  isOpen, 
  onClose, 
  driverName,
  licensePlate 
}: DriverDetailDialogProps) {
  const { toast } = useToast();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 加载司机详细信息
  useEffect(() => {
    if (isOpen && driverName) {
      loadDriverDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, driverName, licensePlate]);

  const loadDriverDetails = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('drivers')
        .select('*')
        .eq('name', driverName);

      // 如果有车牌号，优先按车牌号查询（更精确）
      if (licensePlate) {
        query = query.eq('license_plate', licensePlate);
      }

      const { data, error } = await query.single();

      if (error) {
        console.error('加载司机信息失败:', error);
        toast({
          title: "加载失败",
          description: "无法加载司机详细信息",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        setDriver({
          id: data.id,
          name: data.name,
          licensePlate: data.license_plate,
          phone: data.phone,
          id_card_photos: (data.id_card_photos as string[]) || [],
          driver_license_photos: (data.driver_license_photos as string[]) || [],
          qualification_certificate_photos: (data.qualification_certificate_photos as string[]) || [],
          driving_license_photos: (data.driving_license_photos as string[]) || [],
          transport_license_photos: (data.transport_license_photos as string[]) || []
        });
      }
    } catch (error: unknown) {
      console.error('加载司机信息失败:', error);
      const errorMessage = error instanceof Error ? error.message : "无法加载司机详细信息";
      toast({
        title: "加载失败",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 渲染照片区域
  const renderPhotoSection = (
    title: string,
    photos: string[],
    icon: React.ReactNode,
    colorClass: string
  ) => {
    if (!photos || photos.length === 0) {
      return (
        <div className="text-center py-6 text-gray-400">
          <FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无{title}照片</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3">
        {photos.map((url, index) => (
          <div 
            key={index} 
            className="relative group aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
            onClick={() => setPreviewImage(url)}
          >
            <img
              src={url}
              alt={`${title} ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <Badge className={`absolute top-2 right-2 ${colorClass}`}>
              {index + 1}
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              司机详情
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : driver ? (
            <div className="space-y-6">
              {/* 基本信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">司机姓名</Label>
                      <p className="font-semibold text-lg">{driver.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">车牌号</Label>
                      <p className="font-mono font-semibold text-lg">{driver.licensePlate}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">联系电话</Label>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{driver.phone}</p>
                        {driver.phone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => window.open(`tel:${driver.phone}`)}
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            拨打
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* 司机证件照片 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IdCard className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">司机证件照片</h3>
                </div>

                {/* 身份证 */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      身份证
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {driver.id_card_photos?.length || 0}/2
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderPhotoSection(
                      '身份证',
                      driver.id_card_photos || [],
                      <IdCard className="h-4 w-4" />,
                      'bg-blue-500 text-white'
                    )}
                  </CardContent>
                </Card>

                {/* 驾驶证 */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      驾驶证
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {driver.driver_license_photos?.length || 0}/2
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderPhotoSection(
                      '驾驶证',
                      driver.driver_license_photos || [],
                      <Car className="h-4 w-4" />,
                      'bg-green-500 text-white'
                    )}
                  </CardContent>
                </Card>

                {/* 从业资格证 */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      从业资格证
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        {driver.qualification_certificate_photos?.length || 0}/2
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderPhotoSection(
                      '从业资格证',
                      driver.qualification_certificate_photos || [],
                      <FileImage className="h-4 w-4" />,
                      'bg-purple-500 text-white'
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* 车辆证件照片 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold">车辆证件照片</h3>
                </div>

                {/* 行驶证 */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      行驶证
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        {driver.driving_license_photos?.length || 0}/2
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderPhotoSection(
                      '行驶证',
                      driver.driving_license_photos || [],
                      <Car className="h-4 w-4" />,
                      'bg-purple-500 text-white'
                    )}
                  </CardContent>
                </Card>

                {/* 道路运输许可证 */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      道路运输许可证
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        {driver.transport_license_photos?.length || 0}/2
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderPhotoSection(
                      '道路运输许可证',
                      driver.transport_license_photos || [],
                      <Truck className="h-4 w-4" />,
                      'bg-orange-500 text-white'
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 底部按钮 */}
              <div className="flex justify-end pt-4">
                <Button onClick={onClose}>关闭</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>未找到司机信息</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 照片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-0">
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage}
                alt="照片预览"
                className="w-full h-auto max-h-[90vh] object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setPreviewImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

