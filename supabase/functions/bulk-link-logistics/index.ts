import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log("bulk-link-logistics function initialized");

// 定义返回给前端的数据结构
interface LinkResult {
  id: string;
  status: 'success' | 'not_found' | 'error';
  logistics_number?: string | null; // ★★★ 修改点 ★★★
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
          const { data: scaleRecord, error: scaleError } = await supabaseAdmin
            .from('scale_records')
            .select('project_id, loading_date, license_plate, trip_number')
            .eq('id', id)
            .single();

          if (scaleError) throw new Error(`Scale record fetch failed: ${scaleError.message}`);

          const { data: logisticRecord, error: logisticError } = await supabaseAdmin
            .from('logistics_records')
            .select('auto_number')
            .eq('project_id', scaleRecord.project_id)
            .eq('license_plate', scaleRecord.license_plate)
            .eq('trip_number', scaleRecord.trip_number)
            .gte('loading_date', `${scaleRecord.loading_date}T00:00:00Z`)
            .lt('loading_date', `${scaleRecord.loading_date}T23:59:59Z`)
            .maybeSingle();

          if (logisticError) throw new Error(`Logistics lookup failed: ${logisticError.message}`);

          if (!logisticRecord || !logisticRecord.auto_number) {
            return { id, status: 'not_found' };
          }

          const logisticsNumber = logisticRecord.auto_number;

          // ★★★ 修改点 ★★★
          const { error: updateError } = await supabaseAdmin
            .from('scale_records')
            .update({ logistics_number: logisticsNumber }) // 更新正确的字段
            .eq('id', id);

          if (updateError) throw new Error(`Update failed: ${updateError.message}`);

          // ★★★ 修改点 ★★★
          return { id, status: 'success', logistics_number: logisticsNumber }; // 返回正确的字段名

        } catch (error) {
          return { id, status: 'error', error: error.message };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
