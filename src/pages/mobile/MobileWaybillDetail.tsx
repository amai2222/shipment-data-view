// 移动端运单详情页面
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  Truck,
  Package,
  DollarSign,
  MapPin,
  Phone,
  Calendar,
  Clock,
  FileText,
  Edit,
  Share,
  Download,
  AlertCircle,
  CheckCircle,
  Navigation,
  Weight,
  CreditCard,
  Building2,
  Hash,
  MessageSquare,
  Eye,
  Copy,
  ExternalLink
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
  driver_payable_cost: number;
  current_cost?: number;
  extra_cost?: number;
  transport_type: string;
  billing_type_id: number;
  cargo_type?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  partner_chains?: {
    chain_name: string;
  };
  projects?: {
    name: string;
    manager: string;
    loading_address: string;
    unloading_address: string;
  };
}

const transportTypeConfig = {
  '实际运输': { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  '空车返回': { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  '倒短': { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' }
};

const billingTypeConfig = {
  1: { name: '计重', unit: '吨', icon: Weight },
  2: { name: '计车', unit: '车', icon: Truck },
  3: { name: '计体积', unit: '立方', icon: Package }
};

export default function MobileWaybillDetail() {
  const { waybillId } = useParams<{ waybillId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 获取运单详情
  const { data: waybill, isLoading, error } = useQuery<WaybillDetail>({
    queryKey: ['waybillDetail', waybillId],
    queryFn: async () => {
      if (!waybillId) throw new Error('运单ID不存在');
      
      const { data, error } = await supabase
        .from('logistics_records')
        .select(`
          *,
          partner_chains(chain_name),
          projects(name, manager, loading_address, unloading_address)
        `)
        .eq('id', waybillId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!waybillId,
  });

  const formatAmount = (amount: number | undefined | null) => {
    if (!amount && amount !== 0) return '¥0';
    return `¥${amount.toLocaleString()}`;
  };

  const formatWeight = (weight: number | undefined | null) => {
    if (!weight && weight !== 0) return '0吨';
    return `${weight.toFixed(1)}吨`;
  };

  const formatDate = (dateString: string | undefined | null, formatStr: string = 'yyyy年MM月dd日 HH:mm') => {
    if (!dateString) return '未填写';
    try {
      return format(parseISO(dateString), formatStr, { locale: zhCN });
    } catch (error) {
      console.warn('日期格式化失败:', dateString, error);
      return dateString.includes('T') ? dateString.split('T')[0] : dateString;
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: '复制成功',
        description: `已复制${label}到剪贴板`,
      });
    }).catch(() => {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板',
        variant: 'destructive',
      });
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `运单详情 - ${waybill?.auto_number}`,
        text: `司机：${waybill?.driver_name}\n重量：${formatWeight(waybill?.loading_weight)}\n金额：${formatAmount(waybill?.driver_payable_cost)}`,
        url: window.location.href,
      });
    } else {
      copyToClipboard(window.location.href, '链接');
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载运单详情中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !waybill) {
    return (
      <MobileLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground mb-4">无法加载运单详情</p>
          <Button onClick={() => navigate(-1)}>
            返回上一页
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const billingConfig = billingTypeConfig[waybill.billing_type_id as keyof typeof billingTypeConfig] || billingTypeConfig[1];
  const transportConfig = transportTypeConfig[waybill.transport_type as keyof typeof transportTypeConfig] || transportTypeConfig['实际运输'];

  return (
    <MobileLayout>
      <div className="space-y-4 pb-4">
        {/* 页面头部 */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">运单详情</h1>
              <p className="text-sm text-muted-foreground font-mono">
                {waybill.auto_number}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleShare}
                className="p-2"
              >
                <Share className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/m/waybill/${waybillId}/edit`)}
                className="p-2"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 状态卡片 */}
        <Card className={`${transportConfig.bgColor} ${transportConfig.borderColor} border-2`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${transportConfig.color} rounded-full flex items-center justify-center`}>
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <Badge 
                    variant="outline"
                    className={`${transportConfig.bgColor} ${transportConfig.textColor} border-0 font-medium`}
                  >
                    {waybill.transport_type}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(waybill.loading_date, 'yyyy年MM月dd日 HH:mm')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(waybill.driver_payable_cost)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatWeight(waybill.loading_weight)} • {billingConfig.name}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 司机信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              司机信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-blue-500 text-white font-semibold text-sm">
                  {waybill.driver_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold text-base">{waybill.driver_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-mono">
                    {waybill.license_plate}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(waybill.license_plate, '车牌号')}
                    className="p-1 h-auto"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {waybill.driver_phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${waybill.driver_phone}`)}
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  拨打
                </Button>
              )}
            </div>

            {waybill.driver_phone && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">联系电话</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{waybill.driver_phone}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(waybill.driver_phone!, '电话号码')}
                    className="p-1 h-auto"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 时间信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              时间信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">装货日期</span>
                </div>
                <p className="text-sm font-mono">{formatDate(waybill.loading_date, 'MM-dd HH:mm')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(waybill.loading_date, 'yyyy年MM月dd日')}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">卸货日期</span>
                </div>
                <p className="text-sm font-mono">{formatDate(waybill.unloading_date, 'MM-dd HH:mm')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {waybill.unloading_date ? formatDate(waybill.unloading_date, 'yyyy年MM月dd日') : '待完成'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 项目信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />
              项目信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm">项目名称</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{waybill.project_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/m/projects/detail/${waybill.project_id}`)}
                  className="p-1 h-auto"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {waybill.projects?.manager && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">项目经理</span>
                </div>
                <span className="font-medium">{waybill.projects.manager}</span>
              </div>
            )}

            {waybill.partner_chains?.chain_name && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">合作链路</span>
                </div>
                <span className="font-medium">{waybill.partner_chains.chain_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 运输信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-500" />
              运输路线
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 装货地点 */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-600 font-medium">装货地点</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(waybill.loading_date, 'MM-dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-base font-medium mt-1">{waybill.loading_location}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Weight className="h-3 w-3" />
                      <span>装货重量: {formatWeight(waybill.loading_weight)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-px h-8 bg-gray-300"></div>
            </div>

            {/* 卸货地点 */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-600 font-medium">卸货地点</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(waybill.unloading_date, 'MM-dd HH:mm')}
                    </span>
                  </div>
                  <p className="text-base font-medium mt-1">{waybill.unloading_location}</p>
                  {waybill.unloading_weight && (
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Weight className="h-3 w-3" />
                        <span>卸货重量: {formatWeight(waybill.unloading_weight)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 费用明细 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              费用明细
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">司机应付费用</span>
                </div>
                <span className="text-lg font-bold text-orange-600">
                  {formatAmount(waybill.driver_payable_cost)}
                </span>
              </div>

              {waybill.current_cost && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm">基础费用</span>
                  <span className="font-medium">{formatAmount(waybill.current_cost)}</span>
                </div>
              )}

              {waybill.extra_cost && waybill.extra_cost > 0 && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm">额外费用</span>
                  <span className="font-medium">{formatAmount(waybill.extra_cost)}</span>
                </div>
              )}

              {waybill.cargo_type && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">货物类型</span>
                  </div>
                  <span className="font-medium">{waybill.cargo_type}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 备注信息 */}
        {waybill.remarks && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                备注信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm leading-relaxed">{waybill.remarks}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 记录信息 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              记录信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">运单编号</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{waybill.auto_number}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(waybill.auto_number, '运单编号')}
                  className="p-1 h-auto"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">创建时间</span>
              </div>
              <span className="text-sm">
                {format(parseISO(waybill.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">更新时间</span>
              </div>
              <span className="text-sm">
                {format(parseISO(waybill.updated_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 底部操作按钮 */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/m/waybill/${waybillId}/edit`)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            编辑运单
          </Button>
          <Button 
            onClick={handleShare}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <Share className="h-4 w-4" />
            分享运单
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
