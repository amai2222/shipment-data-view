import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Truck, Calendar, Banknote, Weight, Package, User, Phone, Building2 } from 'lucide-react';
import { LogisticsRecord } from '@/types';

interface WaybillDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  record: LogisticsRecord | null;
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
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return '格式错误';
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
    <div className="flex items-center gap-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {loadingLocations.map((loc, index) => (
          <Badge key={index} variant="secondary" className="text-xs">
            {loc}
          </Badge>
        ))}
      </div>
      <span className="text-muted-foreground">→</span>
      <div className="flex flex-wrap gap-1">
        {unloadingLocations.map((loc, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {loc}
          </Badge>
        ))}
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

  const loadingLocations = parseLocations(record.loading_location);
  const unloadingLocations = parseLocations(record.unloading_location);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            运单详情 - {record.auto_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">项目信息</Label>
              </div>
              <div className="space-y-3 pl-6">
                <div>
                  <Label className="text-xs text-muted-foreground">项目名称</Label>
                  <p className="font-medium">{record.project_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">合作链路</Label>
                  <p className="text-sm">{record.chain_name || '默认'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">时间信息</Label>
              </div>
              <div className="space-y-3 pl-6">
                <div>
                  <Label className="text-xs text-muted-foreground">装货日期</Label>
                  <p className="text-sm">{formatDate(record.loading_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">卸货日期</Label>
                  <p className="text-sm">{formatDate(record.unloading_date)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 司机信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">司机信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">司机姓名</Label>
                <p className="font-medium">{record.driver_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">车牌号</Label>
                <p className="text-sm font-mono">{record.license_plate || '未填写'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">司机电话</Label>
                <p className="text-sm">{record.driver_phone || '未填写'}</p>
              </div>
            </div>
          </div>

          {/* 路线信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">运输路线</Label>
            </div>
            <div className="pl-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">装货地点</Label>
                    <div className="mt-1">
                      {formatMultiLocations(loadingLocations)}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">卸货地点</Label>
                    <div className="mt-1">
                      {formatMultiLocations(unloadingLocations)}
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">路线概览</Label>
                    <div className="mt-1">
                      {formatRoute(loadingLocations, unloadingLocations)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 货物信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">货物信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">计费方式</Label>
                <p className="text-sm">{getBillingTypeLabel(record.billing_type_id)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">装货数量</Label>
                <p className="text-sm">{formatQuantity(record)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">运输类型</Label>
                <div className="mt-1">
                  {getTransportTypeBadge(record.transport_type)}
                </div>
              </div>
            </div>
          </div>

          {/* 费用信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">费用信息</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
              <div>
                <Label className="text-xs text-muted-foreground">运费金额</Label>
                <p className="font-mono text-sm">{formatCurrency(record.current_cost)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">额外费用</Label>
                <p className="font-mono text-sm">{formatCurrency(record.extra_cost)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">司机应收</Label>
                <p className="font-mono font-bold text-primary text-sm">
                  {formatCurrency(record.payable_cost)}
                </p>
              </div>
            </div>
          </div>

          {/* 其他平台信息 */}
          {(record.external_tracking_numbers && record.external_tracking_numbers.length > 0) || 
           (record.other_platform_names && record.other_platform_names.length > 0) ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">其他平台信息</Label>
              </div>
              <div className="pl-6 space-y-3">
                {/* 其他平台名称 */}
                {record.other_platform_names && record.other_platform_names.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">其他平台名称</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {record.other_platform_names.map((platform, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 外部运单号 */}
                {record.external_tracking_numbers && record.external_tracking_numbers.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">外部运单号</Label>
                    <div className="space-y-2 mt-1">
                      {(() => {
                        // 解析平台名称和运单号的对应关系
                        const platformNames = record.other_platform_names || [];
                        const trackingNumbers = record.external_tracking_numbers || [];
                        
                        return platformNames.map((platformName, index) => {
                          const platformTrackingNumbers = trackingNumbers[index] ? trackingNumbers[index].split('|') : [];
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                <Badge variant="outline" className="text-xs">
                                  {platformName}
                                </Badge>
                              </div>
                              {platformTrackingNumbers.length > 0 && (
                                <div className="pl-4 space-y-1">
                                  {platformTrackingNumbers.map((trackingNumber, tnIndex) => (
                                    <div key={tnIndex} className="text-sm font-mono text-muted-foreground">
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
    </Dialog>
  );
}
