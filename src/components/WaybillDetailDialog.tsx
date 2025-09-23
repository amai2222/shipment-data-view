import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Truck, Calendar, Banknote, Weight, Package, User, Phone, Building2, FileImage, Eye } from 'lucide-react';
import { LogisticsRecord } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface WaybillDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  record: LogisticsRecord | null;
}

interface ScaleRecord {
  id: string;
  logistics_number: string | null;
  image_urls: string[] | null;
  valid_quantity: number | null;
  trip_number: number;
  created_at: string;
}

// 格式化货币
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(value);
};

// 格式化日期
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '未填写';
  try {
    // 处理日期字符串，确保转换为中国时区
    let date: Date;
    if (dateString.includes('T')) {
      // 如果包含时间信息，直接解析
      date = new Date(dateString);
    } else {
      // 如果只是日期，假设是UTC+0的日期，转换为中国时区
      date = new Date(dateString + 'T00:00:00.000Z');
      // 转换为中国时区 (UTC+8)
      date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    }
    
    if (isNaN(date.getTime())) return dateString; // 如果无法解析，返回原始字符串
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.warn('日期格式化失败:', dateString, error);
    return dateString; // 返回原始字符串而不是"格式错误"
  }
};

// 解析多地点字符串
const parseLocations = (locationString: string | null | undefined): string[] => {
  if (!locationString) return [];
  return locationString.split('|').map(loc => loc.trim()).filter(loc => loc.length > 0);
};

// 格式化多地点显示
const formatMultiLocations = (locations: string[]): React.ReactNode => {
  if (locations.length === 0) return <span className="text-muted-foreground">未填写</span>;
  
  if (locations.length === 1) {
    return <span className="font-medium">{locations[0]}</span>;
  }
  
  return (
    <div className="space-y-1">
      {locations.map((location, index) => (
        <div key={index} className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {index + 1}
          </Badge>
          <span className="text-sm">{location}</span>
        </div>
      ))}
    </div>
  );
};

// 格式化路线显示
const formatRoute = (loadingLocations: string[], unloadingLocations: string[]): React.ReactNode => {
  if (loadingLocations.length === 0 && unloadingLocations.length === 0) {
    return <span className="text-muted-foreground">未填写</span>;
  }
  
  return (
    <div className="space-y-2">
      {/* 装货地点 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-xs">📍</span>
          <span className="text-xs font-medium text-green-800">装货地点</span>
        </div>
        <div className="space-y-1">
          {loadingLocations.map((loc, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-xs text-gray-500 mt-1">{index + 1}.</span>
              <span className="text-sm text-gray-700 bg-green-50 px-2 py-1 rounded border border-green-200 flex-1 break-words">
                {loc}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 箭头 */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-8 h-px bg-gray-300"></div>
          <span className="text-sm">→</span>
          <div className="w-8 h-px bg-gray-300"></div>
        </div>
      </div>
      
      {/* 卸货地点 */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-orange-600 text-xs">🏁</span>
          <span className="text-xs font-medium text-orange-800">卸货地点</span>
        </div>
        <div className="space-y-1">
          {unloadingLocations.map((loc, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-xs text-gray-500 mt-1">{index + 1}.</span>
              <span className="text-sm text-gray-700 bg-orange-50 px-2 py-1 rounded border border-orange-200 flex-1 break-words">
                {loc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 获取计费类型标签
const getBillingTypeLabel = (billingTypeId: number | null | undefined): string => {
  switch (billingTypeId) {
    case 1: return '按重量(吨)';
    case 2: return '按车次';
    case 3: return '按体积(立方)';
    default: return '按重量(吨)';
  }
};

// 格式化数量显示
const formatQuantity = (record: LogisticsRecord): string => {
  const billingTypeId = record.billing_type_id || 1;
  const loading = record.loading_weight || 0;
  const unloading = record.unloading_weight || 0;
  
  switch (billingTypeId) {
    case 1: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
    case 2: return '1 车';
    case 3: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 立方`;
    default: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
  }
};

// 获取运输类型徽章
const getTransportTypeBadge = (transportType: string | null | undefined) => {
  const type = transportType || '未知';
  const isActual = type === '实际运输';
  
  return (
    <Badge variant={isActual ? 'default' : 'secondary'} className="text-xs">
      {type}
    </Badge>
  );
};

export function WaybillDetailDialog({ isOpen, onClose, record }: WaybillDetailDialogProps) {
  if (!record) return null;

  const [scaleRecords, setScaleRecords] = useState<ScaleRecord[]>([]);
  const [loadingScaleRecords, setLoadingScaleRecords] = useState(false);
  const [showScaleImages, setShowScaleImages] = useState(false);

  const loadingLocations = parseLocations(record.loading_location);
  const unloadingLocations = parseLocations(record.unloading_location);

  const loadScaleRecords = useCallback(async () => {
    if (!record?.auto_number) return;
    
    setLoadingScaleRecords(true);
    try {
      const { data, error } = await supabase
        .from('scale_records')
        .select('id, logistics_number, image_urls, valid_quantity, trip_number, created_at')
        .eq('logistics_number', record.auto_number);
      
      if (error) throw error;
      setScaleRecords(data || []);
    } catch (error) {
      console.error('加载磅单数据失败:', error);
    } finally {
      setLoadingScaleRecords(false);
    }
  }, [record?.auto_number]);

  // 加载磅单数据
  useEffect(() => {
    if (isOpen && record?.auto_number) {
      loadScaleRecords();
    }
  }, [isOpen, record?.auto_number, loadScaleRecords]);

  const handleShowScaleImages = () => {
    setShowScaleImages(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-bold">运单详情</div>
                <div className="text-sm font-normal text-gray-600">{record.auto_number}</div>
              </div>
            </div>
            {scaleRecords.length > 0 && (
              <Button
                onClick={handleShowScaleImages}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileImage className="h-4 w-4" />
                查看磅单
                <Badge variant="secondary" className="ml-1">
                  {scaleRecords.reduce((total, record) => total + (record.image_urls?.length || 0), 0)}
                </Badge>
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-8 pt-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <Label className="text-sm font-semibold text-blue-800">项目信息</Label>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-blue-600 font-medium">项目名称</Label>
                  <p className="font-semibold text-gray-800 mt-1">{record.project_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-blue-600 font-medium">合作链路</Label>
                  <p className="text-sm text-gray-700 mt-1">{record.chain_name || '默认'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <Label className="text-sm font-semibold text-green-800">时间信息</Label>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-green-600 font-medium">装货日期</Label>
                  <p className="text-sm text-gray-700 mt-1">{formatDate(record.loading_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-green-600 font-medium">卸货日期</Label>
                  <p className="text-sm text-gray-700 mt-1">{formatDate(record.unloading_date)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 司机信息 */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Truck className="h-4 w-4 text-purple-600" />
              </div>
              <Label className="text-sm font-semibold text-purple-800">司机信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <Label className="text-xs text-purple-600 font-medium">司机姓名</Label>
                <p className="font-semibold text-gray-800 mt-1">{record.driver_name}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <Label className="text-xs text-purple-600 font-medium">车牌号</Label>
                <p className="text-sm font-mono text-gray-700 mt-1">{record.license_plate || '未填写'}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <Label className="text-xs text-purple-600 font-medium">司机电话</Label>
                <p className="text-sm text-gray-700 mt-1">{record.driver_phone || '未填写'}</p>
              </div>
            </div>
          </div>

          {/* 路线信息 */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MapPin className="h-4 w-4 text-orange-600" />
              </div>
              <Label className="text-sm font-semibold text-orange-800">运输路线</Label>
            </div>
            <div className="bg-white p-4 rounded-lg border border-orange-100">
              {formatRoute(loadingLocations, unloadingLocations)}
            </div>
          </div>

          {/* 货物信息 */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Weight className="h-4 w-4 text-teal-600" />
              </div>
              <Label className="text-sm font-semibold text-teal-800">货物信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-teal-100">
                <Label className="text-xs text-teal-600 font-medium">计费方式</Label>
                <p className="text-sm text-gray-700 mt-1">{getBillingTypeLabel(record.billing_type_id)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-teal-100">
                <Label className="text-xs text-teal-600 font-medium">装货数量</Label>
                <p className="text-sm text-gray-700 mt-1">{formatQuantity(record)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-teal-100">
                <Label className="text-xs text-teal-600 font-medium">运输类型</Label>
                <div className="mt-1">
                  {getTransportTypeBadge(record.transport_type)}
                </div>
              </div>
            </div>
          </div>

          {/* 费用信息 */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Banknote className="h-4 w-4 text-emerald-600" />
              </div>
              <Label className="text-sm font-semibold text-emerald-800">费用信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <Label className="text-xs text-emerald-600 font-medium">运费金额</Label>
                <p className="font-mono text-sm text-gray-700 mt-1">{formatCurrency(record.current_cost)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <Label className="text-xs text-emerald-600 font-medium">额外费用</Label>
                <p className="font-mono text-sm text-gray-700 mt-1">{formatCurrency(record.extra_cost)}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-100">
                <Label className="text-xs text-emerald-600 font-medium">司机应收</Label>
                <p className="font-mono font-bold text-emerald-600 text-sm mt-1">
                  {formatCurrency(record.payable_cost)}
                </p>
              </div>
            </div>
          </div>

          {/* 磅单信息 */}
          {scaleRecords.length > 0 && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileImage className="h-4 w-4 text-indigo-600" />
                </div>
                <Label className="text-sm font-semibold text-indigo-800">磅单信息</Label>
              </div>
              <div className="space-y-3">
                {scaleRecords.map((scaleRecord, index) => (
                  <div key={scaleRecord.id} className="bg-white p-3 rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          磅单 {index + 1}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          车次: {scaleRecord.trip_number}
                        </span>
                        {scaleRecord.valid_quantity && (
                          <span className="text-sm text-gray-600">
                            有效数量: {scaleRecord.valid_quantity}吨
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => setShowScaleImages(true)}
                        variant="ghost"
                        size="sm"
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看图片 ({scaleRecord.image_urls?.length || 0})
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 其他平台信息 */}
          {(record.external_tracking_numbers && record.external_tracking_numbers.length > 0) || 
           (record.other_platform_names && record.other_platform_names.length > 0) ? (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-4 w-4 text-purple-600" />
                </div>
                <Label className="text-sm font-semibold text-purple-800">其他平台信息</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 其他平台名称 */}
                {record.other_platform_names && record.other_platform_names.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-purple-100">
                    <Label className="text-xs text-purple-600 font-medium">其他平台名称</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {record.other_platform_names.map((platform, index) => (
                        <Badge key={index} variant="outline" className="text-xs border-purple-200 text-purple-700">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 外部运单号 */}
                {record.external_tracking_numbers && record.external_tracking_numbers.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-purple-100">
                    <Label className="text-xs text-purple-600 font-medium">外部运单号</Label>
                    <div className="space-y-2 mt-2">
                      {(() => {
                        // 解析平台名称和运单号的对应关系
                        const platformNames = record.other_platform_names || [];
                        const trackingNumbers = record.external_tracking_numbers || [];
                        
                        return platformNames.map((platformName, index) => {
                          const platformTrackingNumbers = trackingNumbers[index] ? trackingNumbers[index].split('|') : [];
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div className="text-xs font-medium text-purple-700">
                                {platformName}
                              </div>
                              {platformTrackingNumbers.length > 0 && (
                                <div className="space-y-1">
                                  {platformTrackingNumbers.map((trackingNumber, tnIndex) => (
                                    <div key={tnIndex} className="text-sm font-mono text-gray-700 bg-gray-50 px-2 py-1 rounded">
                                      {trackingNumber}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 备注信息 */}
          {record.remarks && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">备注信息</Label>
              </div>
              <div className="pl-6">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">{record.remarks}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* 磅单图片展示对话框 */}
      <Dialog open={showScaleImages} onOpenChange={setShowScaleImages}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              磅单图片 - {record.auto_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {scaleRecords.map((scaleRecord, index) => (
              <div key={scaleRecord.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">磅单 {index + 1}</Badge>
                  <span className="text-sm text-muted-foreground">
                    车次: {scaleRecord.trip_number}
                  </span>
                  {scaleRecord.valid_quantity && (
                    <span className="text-sm text-muted-foreground">
                      有效数量: {scaleRecord.valid_quantity}吨
                    </span>
                  )}
                </div>
                
                {scaleRecord.image_urls && scaleRecord.image_urls.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scaleRecord.image_urls.map((imageUrl, imgIndex) => (
                      <div key={imgIndex} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`磅单图片 ${index + 1}-${imgIndex + 1}`}
                          className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors cursor-pointer"
                          onClick={() => window.open(imageUrl, '_blank')}
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder.svg';
                            e.currentTarget.alt = '图片加载失败';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => window.open(imageUrl, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              查看大图
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无图片
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
