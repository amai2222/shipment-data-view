// 内部司机移动端运单详情页面
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Truck,
  Package,
  MapPin,
  Phone,
  Calendar,
  Clock,
  FileText,
  Weight,
  Building2,
  Hash,
  MessageSquare,
  Route,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  ZoomIn,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 类型定义
interface WaybillDetail {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  driver_name: string;
  license_plate: string;
  driver_phone?: string;
  loading_date: string;
  unloading_date?: string;
  loading_location: string;
  unloading_location: string;
  loading_weight: number;
  unloading_weight?: number;
  transport_type: string;
  billing_type_id: number;
  cargo_type?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  projects?: {
    name: string;
    manager: string;
    loading_address: string;
    unloading_address: string;
  };
}

const transportTypeConfig = {
  '实际运输': { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: '实际运输' },
  '空车返回': { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', label: '空车返回' },
  '倒短': { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: '倒短' }
};

const billingTypeConfig = {
  1: { name: '计重', unit: '吨', icon: Weight },
  2: { name: '计车', unit: '车', icon: Truck },
  3: { name: '计体积', unit: '立方', icon: Package }
};

interface NamingParams {
  date: string;
  licensePlate: string;
  tripNumber: number;
  projectName: string;
}

export default function MobileInternalWaybillDetail() {
  const { waybillId } = useParams<{ waybillId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 磅单照片状态
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scaleRecordId, setScaleRecordId] = useState<string | null>(null);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  
  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [allImages, setAllImages] = useState<string[]>([]);
  
  // 用于存储创建的Object URL，以便清理
  const objectUrlsRef = useRef<string[]>([]);
  
  // 清理Object URL
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  // 获取运单详情
  const { data: waybill, isLoading, error } = useQuery<WaybillDetail>({
    queryKey: ['internalWaybillDetail', waybillId],
    queryFn: async () => {
      if (!waybillId) throw new Error('运单ID不存在');
      
      const { data, error } = await supabase
        .from('logistics_records')
        .select(`
          *,
          projects(name, manager, loading_address, unloading_address)
        `)
        .eq('id', waybillId)
        .single();

      if (error) throw error;
      
      // 查找关联的磅单记录（动态加载）
      if (data.auto_number) {
        const { data: scaleRecord } = await supabase
          .from('scale_records')
          .select('id, image_urls')
          .eq('logistics_number', data.auto_number)
          .maybeSingle();
        
        if (scaleRecord) {
          setScaleRecordId(scaleRecord.id);
          // 处理 image_urls（可能是数组或JSONB对象）
          let imageUrls: string[] = [];
          if (Array.isArray(scaleRecord.image_urls)) {
            imageUrls = scaleRecord.image_urls;
          } else if (typeof scaleRecord.image_urls === 'object' && scaleRecord.image_urls !== null) {
            // 如果是JSONB对象，尝试提取数组
            const urls = (scaleRecord.image_urls as any).urls || Object.values(scaleRecord.image_urls);
            imageUrls = Array.isArray(urls) ? urls : [];
          }
          setExistingImageUrls(imageUrls);
          // 更新所有图片列表（用于预览）
          setAllImages(imageUrls);
        } else {
          // 如果没有磅单记录，清空状态
          setScaleRecordId(null);
          setExistingImageUrls([]);
          setAllImages([]);
        }
      }
      
      return data;
    },
    enabled: !!waybillId,
  });

  const formatWeight = (weight: number | undefined | null) => {
    if (!weight && weight !== 0) return '0吨';
    return `${weight.toFixed(2)}吨`;
  };

  const formatDate = (dateString: string | undefined | null, formatStr: string = 'yyyy年MM月dd日') => {
    if (!dateString) return '未填写';
    try {
      let date: Date;
      if (dateString.includes('T')) {
        date = parseISO(dateString);
      } else {
        date = new Date(dateString + 'T00:00:00.000Z');
        date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      }
      return format(date, formatStr, { locale: zhCN });
    } catch (error) {
      console.warn('日期格式化失败:', dateString, error);
      return dateString.includes('T') ? dateString.split('T')[0] : dateString;
    }
  };

  // 选择文件（支持多图）
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      
      // 为每个新文件创建Object URL
      newFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
      });
      
      // 立即显示预览（选择后显示在下方）
      toast({
        title: '已选择照片',
        description: `已选择 ${newFiles.length} 张照片，请查看下方预览`
      });
    }
    // 重置input
    event.target.value = '';
  };

  // 删除选中的文件
  const removeFile = (index: number) => {
    // 清理对应的Object URL
    const urlToRemove = objectUrlsRef.current[index];
    if (urlToRemove && urlToRemove !== '') {
      URL.revokeObjectURL(urlToRemove);
    }
    // 从数组中移除
    objectUrlsRef.current.splice(index, 1);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 上传文件到七牛云
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

  // 保存磅单记录
  const handleSaveScaleRecord = async () => {
    if (!waybill) return;

    if (selectedFiles.length === 0 && existingImageUrls.length === 0) {
      toast({
        title: '提示',
        description: '请先上传磅单照片',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      let imageUrls = [...existingImageUrls];
      
      // 如果有新上传的文件，上传它们
      if (selectedFiles.length > 0) {
        setUploading(true);
        try {
          const loadingDate = waybill.loading_date.split('T')[0];
          const newImageUrls = await uploadFiles({
            date: loadingDate,
            licensePlate: waybill.license_plate,
            tripNumber: 1, // 运单通常只有一次
            projectName: waybill.project_name
          });
          imageUrls = [...existingImageUrls, ...newImageUrls];
        } finally {
          setUploading(false);
        }
      }

      const recordData = {
        project_id: waybill.project_id,
        project_name: waybill.project_name,
        loading_date: waybill.loading_date.split('T')[0],
        trip_number: 1,
        valid_quantity: waybill.loading_weight || null,
        billing_type_id: waybill.billing_type_id,
        image_urls: imageUrls,
        license_plate: waybill.license_plate,
        driver_name: waybill.driver_name,
        logistics_number: waybill.auto_number, // 关联运单编号
      };

      if (scaleRecordId) {
        // 更新现有记录
        const { error } = await supabase
          .from('scale_records')
          .update(recordData)
          .eq('id', scaleRecordId);

        if (error) throw error;
      } else {
        // 创建新记录
        const { data: newRecord, error } = await supabase
          .from('scale_records')
          .insert(recordData)
          .select('id')
          .single();

        if (error) throw error;
        if (newRecord) {
          setScaleRecordId(newRecord.id);
        }
      }

      // 清空选中的文件并清理Object URL
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      setSelectedFiles([]);
      setExistingImageUrls(imageUrls);
      // 更新所有图片列表（用于预览）
      setAllImages(imageUrls);

      // 刷新数据
      queryClient.invalidateQueries({ queryKey: ['internalWaybillDetail', waybillId] });

      toast({
        title: '保存成功',
        description: '磅单照片已保存'
      });
    } catch (error: any) {
      console.error('保存磅单失败:', error);
      toast({
        title: '保存失败',
        description: error.message || '请重试',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !waybill) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-2">加载失败</p>
            <Button onClick={() => navigate(-1)} variant="outline" size="sm">
              返回
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const transportConfig = transportTypeConfig[waybill.transport_type as keyof typeof transportTypeConfig] || transportTypeConfig['实际运输'];
  const billingConfig = billingTypeConfig[waybill.billing_type_id as keyof typeof billingTypeConfig] || billingTypeConfig[1];

  return (
    <MobileLayout>
      <div className="space-y-4 pb-4">
        {/* 页面头部 */}
        <div className="flex items-center gap-3 px-4 pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">运单详情</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {waybill.auto_number}
            </p>
          </div>
        </div>

        {/* 状态卡片 */}
        <Card className={`${transportConfig.bgColor} ${transportConfig.borderColor} border-2 mx-4`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${transportConfig.color}`}></div>
                <span className={`font-semibold ${transportConfig.textColor}`}>
                  {transportConfig.label}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {billingConfig.name}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 基本信息 */}
        <Card className="mx-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  运单编号
                </div>
                <div className="font-medium text-sm">{waybill.auto_number}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  项目名称
                </div>
                <div className="font-medium text-sm">{waybill.project_name}</div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  装货日期
                </div>
                <div className="font-medium text-sm">{formatDate(waybill.loading_date, 'yyyy-MM-dd')}</div>
              </div>
              {waybill.unloading_date && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    卸货日期
                  </div>
                  <div className="font-medium text-sm">{formatDate(waybill.unloading_date, 'yyyy-MM-dd')}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 路线信息 */}
        <Card className="mx-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-5 w-5" />
              路线信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 起点 */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-0.5">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                <div className="w-0.5 h-12 bg-gradient-to-b from-blue-500 to-green-500 my-1"></div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">装货地</div>
                <div className="font-medium text-base text-gray-900">{waybill.loading_location}</div>
              </div>
            </div>
            
            {/* 终点 */}
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm mt-0.5"></div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">卸货地</div>
                <div className="font-medium text-base text-gray-900">{waybill.unloading_location}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数量信息 */}
        <Card className="mx-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Weight className="h-5 w-5" />
              数量信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">装货数量</div>
                <div className="font-semibold text-lg text-gray-900">
                  {formatWeight(waybill.loading_weight)}
                </div>
              </div>
              {waybill.unloading_weight && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">卸货数量</div>
                  <div className="font-semibold text-lg text-gray-900">
                    {formatWeight(waybill.unloading_weight)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 司机和车辆信息 */}
        <Card className="mx-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              司机信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-base">{waybill.driver_name}</div>
                {waybill.driver_phone && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {waybill.driver_phone}
                  </div>
                )}
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-0.5">车牌号</div>
                <div className="font-medium text-base">{waybill.license_plate}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 磅单照片 */}
        <Card className="mx-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              磅单照片
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 上传按钮 */}
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('scale-photo-input')?.click()}
                disabled={uploading || saving}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? '上传中...' : '选择磅单照片'}
              </Button>
              <input
                id="scale-photo-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* 已存在的照片（动态显示） */}
            {existingImageUrls.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">已有照片：</div>
                <div className="grid grid-cols-3 gap-2">
                  {existingImageUrls.map((url, index) => (
                    <div 
                      key={`existing-${index}`} 
                      className="relative aspect-square group cursor-pointer"
                      onClick={() => {
                        setPreviewImage(url);
                        setPreviewIndex(index);
                        setAllImages(existingImageUrls);
                      }}
                    >
                      <img 
                        src={url} 
                        alt={`磅单${index + 1}`} 
                        className="w-full h-full object-cover rounded-lg border-2 border-gray-200 transition-transform group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 新选择的文件预览（选择后立即显示在下方） */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  待上传照片：<span className="text-primary font-medium">{selectedFiles.length}</span> 张
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {selectedFiles.map((file, index) => {
                    // 获取对应的Object URL（通过文件对象查找）
                    let previewUrl = objectUrlsRef.current.find((url, idx) => {
                      // 通过索引匹配（假设顺序一致）
                      return idx === index;
                    });
                    
                    // 如果没有找到，创建新的Object URL
                    if (!previewUrl) {
                      previewUrl = URL.createObjectURL(file);
                      // 确保数组有足够的长度
                      while (objectUrlsRef.current.length <= index) {
                        objectUrlsRef.current.push('');
                      }
                      objectUrlsRef.current[index] = previewUrl;
                    }
                    
                    return (
                      <div 
                        key={`selected-${index}`} 
                        className="relative aspect-square group cursor-pointer"
                        onClick={() => {
                          // 点击预览：显示所有图片（已有+待上传）
                          const allPreviewImages = [
                            ...existingImageUrls,
                            ...objectUrlsRef.current.slice(0, selectedFiles.length).filter(url => url && url !== '')
                          ];
                          setAllImages(allPreviewImages);
                          setPreviewImage(previewUrl);
                          setPreviewIndex(existingImageUrls.length + index);
                        }}
                      >
                        <img 
                          src={previewUrl} 
                          alt={`新照片${index + 1}`} 
                          className="w-full h-full object-cover rounded-lg border-2 border-blue-300"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg z-10"
                          aria-label={`删除照片 ${index + 1}`}
                          title={`删除照片 ${index + 1}`}
                          onClick={(e) => {
                            e.stopPropagation(); // 阻止触发预览
                            removeFile(index);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                
                {/* 保存按钮（有了图片，保存磅单才好用） */}
                <Button
                  className="w-full"
                  onClick={handleSaveScaleRecord}
                  disabled={saving || uploading}
                  size="lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      保存中...
                    </>
                  ) : uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      保存磅单照片 ({selectedFiles.length} 张)
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* 空状态提示 */}
            {existingImageUrls.length === 0 && selectedFiles.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                暂无磅单照片，点击上方按钮上传
              </div>
            )}
          </CardContent>
        </Card>

        {/* 备注信息 */}
        {waybill.remarks && (
          <Card className="mx-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                备注
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{waybill.remarks}</p>
            </CardContent>
          </Card>
        )}

        {/* 创建时间 */}
        <Card className="mx-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>创建时间：{formatDate(waybill.created_at, 'yyyy-MM-dd HH:mm')}</span>
            </div>
          </CardContent>
        </Card>

        {/* 图片预览对话框（点击放大查看） */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-black/95">
            <DialogHeader className="px-4 py-3 flex-shrink-0 bg-black/50">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white text-base">
                  磅单照片 {previewIndex + 1} / {allImages.length}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewImage(null)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>

            {/* 图片显示区域 */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              {previewImage && (
                <>
                  <img
                    src={previewImage}
                    alt={`磅单照片 ${previewIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                  
                  {/* 上一张按钮 */}
                  {allImages.length > 1 && previewIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-12 w-12 rounded-full"
                      onClick={() => {
                        const newIndex = previewIndex - 1;
                        setPreviewIndex(newIndex);
                        setPreviewImage(allImages[newIndex]);
                      }}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                  )}

                  {/* 下一张按钮 */}
                  {allImages.length > 1 && previewIndex < allImages.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-12 w-12 rounded-full"
                      onClick={() => {
                        const newIndex = previewIndex + 1;
                        setPreviewIndex(newIndex);
                        setPreviewImage(allImages[newIndex]);
                      }}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* 缩略图导航（多图时显示） */}
            {allImages.length > 1 && (
              <div className="px-4 py-3 flex-shrink-0 bg-black/50 border-t border-white/10">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {allImages.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setPreviewIndex(index);
                        setPreviewImage(url);
                      }}
                      className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                        index === previewIndex
                          ? 'border-white scale-110'
                          : 'border-white/30 opacity-60'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`缩略图 ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder.svg';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

