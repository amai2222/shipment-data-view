// 货主移动端 - 运单查询页面

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Search,
  Calendar,
  MapPin,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function MobileShipperWaybills() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 获取运单列表（简化版，实际应该调用专门的查询函数）
  const { data, isLoading } = useQuery({
    queryKey: ['shipper-waybills', user?.partnerId, searchKeyword, currentPage],
    queryFn: async () => {
      if (!user?.partnerId) return { records: [], total_count: 0 };

      // 通过开票申请单关联查询运单
      const { data: invoicesData, error: invoicesError } = await supabase.rpc(
        'get_invoice_requests_filtered_1114',
        {
          p_invoicing_partner_id: user.partnerId,
          p_page_number: 1,
          p_page_size: 100
        }
      );

      if (invoicesError) throw invoicesError;

      // 获取所有关联的运单ID
      const result = invoicesData as {
        success: boolean;
        records?: WaybillItem[];
        total_count?: number;
      };
      const invoices = result.records || [];
      const waybillIds: string[] = [];
      
      for (const invoice of invoices) {
        const { data: details } = await supabase
          .from('invoice_request_details')
          .select('logistics_record_id')
          .eq('invoice_request_id', invoice.id);
        
        if (details) {
          waybillIds.push(...details.map(d => d.logistics_record_id));
        }
      }

      if (waybillIds.length === 0) {
        return { records: [], total_count: 0 };
      }

      // 查询运单详情
      let query = supabase
        .from('logistics_records')
        .select('*')
        .in('id', waybillIds)
        .order('loading_date', { ascending: false })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (searchKeyword) {
        query = query.or(`auto_number.ilike.%${searchKeyword}%,loading_location.ilike.%${searchKeyword}%,unloading_location.ilike.%${searchKeyword}%`);
      }

      const { data: waybills, error: waybillsError } = await query;

      if (waybillsError) throw waybillsError;

      return {
        records: waybills || [],
        total_count: waybillIds.length
      };
    },
    enabled: !!user?.partnerId
  });

  const waybills = data?.records || [];
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索运单号、起运地、目的地..."
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* 运单列表 */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">加载中...</p>
            </CardContent>
          </Card>
        ) : waybills.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">暂无运单记录</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {waybills.map((waybill: any) => (
              <Card
                key={waybill.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/m/shipper/waybills/${waybill.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">
                          {waybill.auto_number}
                        </p>
                        {waybill.invoice_status && (
                          <Badge variant="outline" className="text-xs">
                            {waybill.invoice_status === 'Completed' ? '已开票' : waybill.invoice_status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                        <MapPin className="h-3 w-3" />
                        <span>{waybill.loading_location} → {waybill.unloading_location}</span>
                      </div>
                      {waybill.loading_date && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(waybill.loading_date), 'yyyy-MM-dd', { locale: zhCN })}
                          </span>
                        </div>
                      )}
                    </div>
                    {waybill.payable_cost && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">应付金额</p>
                        <p className="text-lg font-bold text-gray-900">
                          ¥{waybill.payable_cost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                    <Button variant="ghost" size="sm">
                      查看详情
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </ShipperMobileLayout>
  );
}

