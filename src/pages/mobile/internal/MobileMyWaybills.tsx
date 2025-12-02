// 移动端 - 我的行程记录（司机运单列表）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
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
  const navigate = useNavigate();
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


  const totalWeight = waybills.reduce((sum, w) => sum + (w.loading_weight || 0), 0);
  const totalTrips = waybills.length;

  return (
    <DriverMobileLayout title="我的行程">
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
              <Card 
                key={waybill.id} 
                className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 rounded-xl overflow-hidden bg-gradient-to-br from-white to-gray-50/50 active:scale-[0.98] cursor-pointer"
                onClick={() => navigate(`/m/internal/waybill/${waybill.id}`)}
              >
                <CardContent className="p-4">
                  {/* 运单编号和时间 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="font-semibold text-base text-gray-900 mb-1">{waybill.auto_number}</div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(waybill.created_at), 'yyyy-MM-dd HH:mm')}
                      </div>
                    </div>
                  </div>
                  
                  {/* 项目信息 */}
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{waybill.project_name}</span>
                  </div>
                  
                  {/* 路线信息 - 参考货拉拉设计 */}
                  <div className="space-y-3 mb-4">
                    {/* 起点 */}
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        </div>
                        <div className="w-0.5 h-12 bg-gradient-to-b from-blue-500 via-blue-400 to-green-500 my-1"></div>
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="text-xs text-gray-500 mb-1">起点</div>
                        <div className="font-medium text-base text-gray-900 leading-tight">{waybill.loading_location}</div>
                      </div>
                    </div>
                    
                    {/* 终点 */}
                    <div className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm mt-0.5 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 mb-1">终点</div>
                        <div className="font-medium text-base text-gray-900 leading-tight">{waybill.unloading_location}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 底部信息栏 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <Weight className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-800">{waybill.loading_weight}吨</span>
                      </div>
                      {waybill.unloading_weight && (
                        <div className="flex items-center gap-1.5">
                          <Weight className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-gray-800">{waybill.unloading_weight}吨</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-purple-600" />
                        <span className="text-sm text-gray-600">{format(new Date(waybill.loading_date), 'MM-dd')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DriverMobileLayout>
  );
}

