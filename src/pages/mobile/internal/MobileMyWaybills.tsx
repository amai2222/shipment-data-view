// 移动端 - 我的行程记录（司机运单列表）

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  MapPin,
  Calendar,
  Weight,
  DollarSign,
  Loader2,
  Package,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Waybill {
  id: string;
  auto_number: string;
  project_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  loading_weight: number;
  unloading_weight: number | null;
  payment_status: string;
  created_at: string;
}

export default function MobileMyWaybills() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadWaybills();
  }, [days]);

  const loadWaybills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_waybills', {
        p_days: days,
        p_limit: 50
      });
      
      if (error) throw error;
      setWaybills(data || []);
    } catch (error) {
      console.error('加载运单失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载运单记录',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      Unpaid: { label: '未付款', className: 'bg-red-100 text-red-800' },
      Processing: { label: '处理中', className: 'bg-yellow-100 text-yellow-800' },
      Paid: { label: '已付款', className: 'bg-green-100 text-green-800' }
    };
    const cfg = config[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  const totalWeight = waybills.reduce((sum, w) => sum + (w.loading_weight || 0), 0);
  const totalTrips = waybills.length;

  return (
    <MobileLayout title="行程记录">
      <div className="space-y-4 pb-20">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <Package className="h-6 w-6 mx-auto mb-2 opacity-80" />
              <div className="text-3xl font-bold">{totalTrips}</div>
              <div className="text-xs mt-1 opacity-90">总运次</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <Weight className="h-6 w-6 mx-auto mb-2 opacity-80" />
              <div className="text-3xl font-bold">{totalWeight.toFixed(1)}</div>
              <div className="text-xs mt-1 opacity-90">累计吨数</div>
            </CardContent>
          </Card>
        </div>

        {/* 运单列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">加载中...</p>
            </div>
          ) : waybills.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
                <p className="text-muted-foreground">暂无运单记录</p>
                <p className="text-xs text-muted-foreground mt-2">最近{days}天内没有运输记录</p>
              </CardContent>
            </Card>
          ) : (
            waybills.map(waybill => (
              <Card key={waybill.id} className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-base mb-1">{waybill.auto_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(waybill.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                    {getPaymentStatusBadge(waybill.payment_status)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>项目：{waybill.project_name}</span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium">{waybill.loading_location}</div>
                        <div className="text-xs text-muted-foreground my-1">↓</div>
                        <div className="font-medium">{waybill.unloading_location}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Weight className="h-4 w-4 text-green-600" />
                        <span className="text-green-700 font-semibold">{waybill.loading_weight}吨</span>
                      </div>
                      {waybill.unloading_weight && (
                        <div className="flex items-center gap-1">
                          <Weight className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-700 font-semibold">{waybill.unloading_weight}吨</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <span className="text-purple-700">{format(new Date(waybill.loading_date), 'MM-dd')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

