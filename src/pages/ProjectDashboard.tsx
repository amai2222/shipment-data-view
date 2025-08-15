// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [FINAL-ISOLATION-TEST / LWMzA] 最终隔离测试版。移除可疑组件，验证数据计算和页面渲染。

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ★★★ 核心修改: 我们暂时不导入 Progress 组件，以防它本身有问题 ★★★
// import { Progress } from "@/components/ui/progress"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

// --- 类型定义 (简化版，仅用于本次测试) ---
interface ProjectDetails { id: string; name: string; planned_total_tons: number; billing_type_id: number; }
interface SummaryStats { total_trips: number; total_tonnage: number; }
interface DashboardData { 
  project_details: { selected: ProjectDetails | null; } | null;
  summary_stats: SummaryStats | null; 
}

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形进度图组件 (保持不变，但我们会注释掉它的使用) ---
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
  const [reportDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) { setLoading(false); return; }
        // ★★★ 我们调用 v3 极简函数，确保后端数据源绝对稳定 ★★★
        const { data, error } = await supabase.rpc('get_project_dashboard_data_v3' as any, { 
          p_selected_project_id: projectId, 
          p_report_date: format(reportDate, 'yyyy-MM-dd') 
        });
        if (error) throw error;
        // 为了匹配测试，我们手动构造一个临时的 dashboardData 结构
        setDashboardData({
            project_details: { selected: data },
            summary_stats: { total_trips: 100, total_tonnage: 5000 } // 模拟数据
        });
      } catch (error) {
        console.error("隔离测试捕获错误:", error);
      } finally {
        setLoading(false);
      }
    };
    // 为了确保 v3 函数存在，我们先创建一个极简版的
    const createV3Function = async () => {
        // (这个函数体是空的，只是为了防止IDE报错，实际创建在Supabase后台)
    };
    createV3Function();
    fetchDashboardData();
  }, [projectId, reportDate]);

  if (loading) {
    return <div className="p-6"><Loader2 className="h-12 w-12 animate-spin" /> 正在加载...</div>;
  }

  const selectedProjectDetails = dashboardData?.project_details?.selected;

  if (!selectedProjectDetails) {
    return <div className="p-6 text-red-500">项目数据加载失败或不存在。</div>;
  }

  // --- 数据计算逻辑 (保持不变) ---
  const unitConfig = useMemo(() => {
    const billingType = selectedProjectDetails.billing_type_id;
    const stats = dashboardData?.summary_stats;
    const completed = billingType === 2 ? stats?.total_trips : stats?.total_tonnage;
    return {
      progressUnit: billingType === 2 ? '车' : (billingType === 3 ? '立方' : '吨'),
      progressCompleted: completed || 0,
      progressPlanned: selectedProjectDetails.planned_total_tons || 1,
    };
  }, [selectedProjectDetails, dashboardData]);

  const progressPlannedSafe = unitConfig.progressPlanned || 1;
  const progressPercentage = (unitConfig.progressCompleted / progressPlannedSafe) * 100;

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      {/* ★★★ 版本指纹 ★★★ */}
      <div style={{ border: '2px solid green', padding: '10px', textAlign: 'center', backgroundColor: '#f0fff4' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'green' }}>隔离测试页面 (LWMzA)</h1>
        <p>如果能看到此页面，说明数据加载和计算正常。</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader><CardTitle><Target className="mr-2 h-5 w-5 inline-block"/>项目进度 ({selectedProjectDetails.name})</CardTitle></CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          
          {/* ★★★ 核心修改: 用文本替换嫌疑组件 ★★★ */}
          <div style={{ padding: '10px', border: '1px dashed blue' }}>
            <p>本应传递给 CircularProgressChart 的值是:</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'blue' }}>{progressPercentage}</p>
          </div>
          
          <div style={{ padding: '10px', border: '1px dashed blue' }}>
            <p>本应传递给 Progress 的值是:</p>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'blue' }}>{progressPercentage}</p>
          </div>

          <div className="text-lg font-semibold text-slate-500">
            {formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)} / <span className="text-slate-800">{formatNumber(progressPlannedSafe, unitConfig.progressUnit)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
