import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// 定义从前端接收的筛选条件类型
interface FilterState {
  projectId: string;
  requestId: string;
  driverName: string;
  dateRange?: { from?: string; to?: string }; // 日期范围是可选的，并且值为字符串
}

Deno.serve(async (req) => {
  // 1. 处理浏览器的 CORS 预检请求 (preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. 从请求体中安全地解析出筛选条件
    const { filters }: { filters: FilterState } = await req.json();

    // 3. 创建一个 Supabase 服务端客户端
    //    此客户端会使用发起请求的用户的认证信息，因此会遵循您设置的行级安全 (RLS) 策略
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 4. 基于筛选条件构建数据库查询
    let query = supabaseClient
      .from('payment_requests')
      .select('*');

    // 应用直接筛选：按申请单号
    if (filters.requestId) {
      query = query.ilike('request_id', `%${filters.requestId}%`);
    }

    // 检查是否存在任何需要关联 `logistics_records` 表的筛选条件
    const hasLogisticsFilter = 
      filters.projectId !== 'all' || 
      filters.driverName !== 'all' || 
      filters.dateRange;

    if (hasLogisticsFilter) {
      // 初始化对 `logistics_records` 表的子查询
      let logisticsQuery = supabaseClient.from('logistics_records').select('id');

      // 应用关联筛选：按项目ID
      if (filters.projectId !== 'all') {
        logisticsQuery = logisticsQuery.eq('project_id', filters.projectId);
      }
      // 应用关联筛选：按司机姓名
      if (filters.driverName !== 'all') {
        logisticsQuery = logisticsQuery.eq('driver_name', filters.driverName);
      }
      // 应用关联筛选：按装货日期范围
      if (filters.dateRange?.from) {
        logisticsQuery = logisticsQuery.gte('loading_date', filters.dateRange.from);
      }
      if (filters.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setUTCHours(23, 59, 59, 999); // 确保包含结束日期的全天
        logisticsQuery = logisticsQuery.lte('loading_date', toDate.toISOString());
      }

      // 执行子查询，获取所有匹配运单的 ID
      const { data: recordIds, error: recordError } = await logisticsQuery;
      if (recordError) throw recordError;

      const ids = recordIds.map(r => r.id);

      if (ids.length > 0) {
        // 使用 .overlaps() 筛选出包含这些运单ID的付款申请
        query = query.overlaps('logistics_record_ids', ids);
      } else {
        // 性能优化：如果子查询没有匹配项，则主查询结果必定为空
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    
    // 5. 对最终构建好的查询进行排序并执行
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 6. 成功时，返回查询到的数据
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // 7. 如果过程中出现任何错误，返回标准的错误响应
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
