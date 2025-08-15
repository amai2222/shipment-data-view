// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [BULLETPROOF-FIX / Fiz1N] 最终防弹修复版。彻底重构渲染逻辑，移除useMemo，确保在任何情况下都不会崩溃。

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

// --- 类型定义 ---
interface ProjectDetails { 
  id: string; 
  name: string; 
  start_date: string;
  planned_total_tons: number; 
}
interface SummaryStats { total_tonnage: number; }
interface DashboardData { 
  project_details: ProjectDetails | null;
  summary_stats: SummaryStats | null; 
}

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形进度图组件 (安全版) ---
const CircularProgressChart = ({ value }: { value: number }) => {
  const safeValue = isFinite(value) ? value : 0;
  const data = [{ name: 'progress', value: safeValue, fill: '#2563eb' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" barSize={12} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: '#e2e8f0' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-blue-600">{`${safeValue.toFixed(1)}%`}</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

// --- 主组件 ---
export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchDashboardData = async () => {
      // 保持 loading 为 true 直到所有操作完成
      setLoading(true);
      setError(null);
      setDashboardData(null); // 重置数据状态

      try {
        if (!projectId) throw new Error("URL中缺少项目ID。");
        
        const { data, error: rpcError } = await supabase.rpc('get_project_dashboard_data_final' as any, { 
          p_selected_project_id: projectId, 
          p_report_date: format(reportDate, 'yyyy-MM-dd') 
        });

        if (rpcError) throw rpcError;
        if (!data) throw new Error("数据库未返回项目数据。请确认ID是否正确，或检查RLS策略及函数权限。");

        setDashboardData({
            project_details: data,
            summary_stats: { total_tonnage: 8500.5 } // 模拟的统计数据
        });

      } catch (e: any) {
        console.error("加载数据时发生错误:", e);
        setError(`加载数据时发生错误: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate]);

  // ★★★ 核心修正：渲染逻辑重构 ★★★

  // 第一道防线：处理加载状态。在加载完成前，不执行任何后续逻辑。
  if (loading) {
    return <div className="p-6 flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /> 正在加载...</div>;
  }

  // 第二道防线：处理错误或数据为空的状态。
  if (error || !dashboardData?.project_details) {
    return <div className="p-6 text-center text-red-500">项目数据加载失败或不存在。<br/>{error}</div>;
  }

  // 如果代码执行到这里，我们可以 100% 保证 `dashboardData.project_details` 是一个有效的对象。
  
  // ★★★ 核心修正：移除 useMemo，直接进行计算 ★★★
  // 因为我们已经通过了上面的防线，这里的计算是绝对安全的。
  const { project_details, summary_stats } = dashboardData;
  const progressUnit = '吨';
  const progressCompleted = summary_stats?.total_tonnage || 0;
  const progressPlannedSafe = project_details.planned_total_tons || 1;
  const progressPercentage = (progressCompleted / progressPlannedSafe) * 100;

  // 第三步：渲染最终的、安全的UI
  return (
    <div className="p-6 bg-slate-50 space-y-6">
      <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
      
      <Card className="shadow-sm max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-700">
            <Target className="mr-2 h-5 w-5 text-blue-500"/>
            项目进度 ({project_details.name})
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          <div className="h-40 w-full">
            <CircularProgressChart value={progressPercentage} />
          </div>
          <Progress value={isFinite(progressPercentage) ? progressPercentage : 0} />
          <div className="text-lg font-semibold text-slate-500">
            {formatNumber(progressCompleted, progressUnit)} / <span className="text-slate-800">{formatNumber(progressPlannedSafe, progressUnit)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-slate-500 p-4 bg-yellow-100 border border-yellow-300 rounded-md">
        <p><strong>提示:</strong> 页面已成功恢复！</p>
        <p>当前进度统计（已完成吨数）使用的是模拟数据。下一步我们将为您创建获取真实统计数据的SQL函数。</p>
      </div>
    </div>
  );
}
