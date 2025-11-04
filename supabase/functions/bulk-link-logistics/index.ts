import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log("bulk-link-logistics function initialized with new sorting logic");

interface LinkResult {
  id: string;
  status: 'success' | 'not_found' | 'error';
  logistics_number?: string | null;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { scale_record_ids } = await req.json();
    if (!Array.isArray(scale_record_ids) || scale_record_ids.length === 0) {
      throw new Error("scale_record_ids must be a non-empty array");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results: LinkResult[] = await Promise.all(
      scale_record_ids.map(async (id: string): Promise<LinkResult> => {
        try {
          // 1. 获取磅单记录的匹配信息和关键的 trip_number
          const { data: scaleRecord, error: scaleError } = await supabaseAdmin
            .from('scale_records')
            .select('project_id, loading_date, license_plate, trip_number')
            .eq('id', id)
            .single();

          if (scaleError) throw new Error(`Scale record fetch failed: ${scaleError.message}`);
          if (!scaleRecord.trip_number || scaleRecord.trip_number <= 0) {
            return { id, status: 'not_found', error: 'Invalid trip_number in scale_record' };
          }

          // ★★★ 核心逻辑修改 ★★★
          // 2. 查找所有匹配的物流记录 (候选池)，并按 auto_number 排序
          const { data: logisticRecords, error: logisticError } = await supabaseAdmin
            .from('logistics_records')
            .select('auto_number')
            .eq('project_id', scaleRecord.project_id)
            .eq('license_plate', scaleRecord.license_plate)
            // 注意：这里不再用 trip_number 作为查询条件
            .gte('loading_date', `${scaleRecord.loading_date}T00:00:00Z`)
            .lt('loading_date', `${scaleRecord.loading_date}T23:59:59Z`)
            .order('auto_number', { ascending: true }); // 关键：按运单号升序排列

          if (logisticError) throw new Error(`Logistics lookup failed: ${logisticError.message}`);

          // 3. 根据 trip_number 定位正确的记录
          // 检查候选池中的记录数量是否足够
          if (logisticRecords && logisticRecords.length >= scaleRecord.trip_number) {
            // 数组索引是 0-based，而 trip_number 是 1-based，所以需要 -1
            const targetRecord = logisticRecords[scaleRecord.trip_number - 1];
            const logisticsNumber = targetRecord.auto_number;

            // 4. 更新磅单记录
            const { error: updateError } = await supabaseAdmin
              .from('scale_records')
              .update({ logistics_number: logisticsNumber })
              .eq('id', id);

            if (updateError) throw new Error(`Update failed: ${updateError.message}`);

            return { id, status: 'success', logistics_number: logisticsNumber };
          } else {
            // 如果候选池数量不足，则匹配失败
            return { id, status: 'not_found' };
          }

        } catch (error) {
          return { id, status: 'error', error: (error instanceof Error ? error.message : String(error)) };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
