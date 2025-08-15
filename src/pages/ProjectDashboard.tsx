// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [RECOVERY-MODE] 恢复模式代码，用于确保页面可以重新打开

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';

export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!projectId) {
          throw new Error("URL中缺少项目ID (projectId)。");
        }
        
        // ★★★ 注意：我们暂时调用一个不存在的 v3 函数，预期会报错，这是正常的 ★★★
        console.log(`[恢复模式] 准备为项目 ${projectId} 调用函数...`);
        const { data, error: rpcError } = await supabase.rpc('get_project_dashboard_data_v3' as any, {
          p_selected_project_id: projectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });

        if (rpcError) throw rpcError;

        setDebugData(data);
      } catch (e: any) {
        console.error("[恢复模式] 捕获到错误:", e);
        setError(`加载数据时发生错误: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate]);

  if (loading) {
    return <div style={{ padding: '20px', fontFamily: 'monospace' }}>[恢复模式] 正在加载...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>恢复模式</h1>
      <p>如果能看到此页面，说明前端已恢复正常。</p>
      <hr />
      {error && <p style={{ color: 'red' }}>错误信息: {error}</p>}
      {debugData && <pre>{JSON.stringify(debugData, null, 2)}</pre>}
    </div>
  );
}
