// src/pages/ProjectDashboard.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase"; // 假设您的 Supabase 调用封装在这里
import { Loader2, Building, Calendar, Package, TrendingUp, Target, Briefcase } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';

// --- 数据类型定义 ---
// 和后端返回的JSON结构保持一致

// 最近项目列表的数据结构
interface ProjectInfo {
  id: string;
  name: string;
  partner_name: string;
  start_date: string;
  planned_total_tons: number;
}

// 今日日报的数据结构
interface DailyReport {
  total_tonnage: number;
  driver_receivable: number;
  partner_payable: number;
}

// 7日趋势图的数据点结构
interface TrendData {
  date: string;
  trips: number;
  weight: number;
  receivable: number;
}

// 项目总览统计数据结构
interface OverallStats {
  total_trips: number;
  total_cost: number;
  avg_cost: number;
  total_tonnage: number; // 项目已完成吨数
}

// 主组件
export default function ProjectDashboard() {
  // --- React States ---
  const [projects, setProjects] = useState<ProjectInfo[]>([]); // 存储最近3个项目
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null); // 当前选中的项目
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null); // 今日日报数据
  const [trendData, setTrendData] = useState<TrendData[]>([]); // 7日图表数据
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null); // 项目总览数据
  const [loading, setLoading] = useState(true); // 全局加载状态
  const { toast } = useToast();

  // --- React Effects ---
  // 核心效果钩子：当选中的项目变化时，调用统一的函数获取所有数据
  useEffect(() => {
    // 定义一个异步函数来获取数据
    const fetchData = async (projectId: string | null) => {
      // 如果没有项目ID，则不执行任何操作
      if (!projectId) {
        // 如果项目列表也为空，说明是首次加载且无项目，停止加载动画
        if (projects.length === 0) setLoading(false);
        return;
      }

      setLoading(true); // 开始加载
      try {
        // --- 核心改动：只调用一次后端统一函数 ---
        const dashboardData = await SupabaseStorage.getProjectDashboardData(projectId);

        // 从返回的 JSON 对象中解构数据，并更新所有 state
        if (dashboardData) {
          // 首次加载时，设置项目列表
          if (projects.length === 0) {
            setProjects(dashboardData.recent_projects || []);
          }
          setDailyReport(dashboardData.daily_report);
          setTrendData(dashboardData.seven_day_trend || []);
          setOverallStats(dashboardData.overall_stats);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast({ title: "错误", description: "加载看板数据失败", variant: "destructive" });
      } finally {
        setLoading(false); // 加载结束
      }
    };

    // 首次加载逻辑：如果项目列表为空，先获取一次数据以填充项目列表
    if (projects.length === 0) {
        // 假设第一次调用时，我们不知道该传哪个projectId,
        // 这里的逻辑是：先获取一次数据，用返回的项目列表中的第一个作为默认选中项
        SupabaseStorage.getProjectDashboardData(null).then(initialData => { // 传递 null 或一个默认ID
            if (initialData && initialData.recent_projects && initialData.recent_projects.length > 0) {
                const initialProjects = initialData.recent_projects;
                setProjects(initialProjects);
                setSelectedProject(initialProjects[0]); // 这会触发下一次useEffect
            } else {
                setLoading(false); // 没有项目，停止加载
            }
        }).catch(err => {
            console.error(err);
            setLoading(false);
            toast({ title: "错误", description: "初始化项目列表失败", variant: "destructive" });
        });
    } else if (selectedProject) {
        // 当用户点击切换项目时，用选中的项目ID获取数据
        fetchData(selectedProject.id);
    }
    
  }, [selectedProject]); // 依赖于 selectedProject 的变化

  // --- 辅助函数和计算 ---
  // 格式化数字，添加千位分隔符和单位
  const formatNumber = (val: number | undefined, unit: string = '') => `${(val || 0).toLocaleString()} ${unit}`;

  // 计算项目进度所需的变量
  const completedTons = overallStats?.total_tonnage || 0;
  const plannedTons = selectedProject?.planned_total_tons || 1; // 使用 optional chaining 并设置默认值防止除以0
  const progressPercentage = (completedTons / plannedTons) * 100;

  // --- 渲染部分 ---
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">项目看板</h1>

      {/* 初始加载时的占位符 */}
      {loading && projects.length === 0 ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : projects.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">暂无项目数据</div>
      ) : (
        // 主布局
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧区域 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 最近的项目卡片 */}
            <Card>
              <CardHeader><CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5"/>最近的项目</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {projects.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => setSelectedProject(p)} // 点击切换项目
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedProject?.id === p.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted/50'}`}
                  >
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    <p className="text-sm opacity-80 flex items-center"><Briefcase className="inline h-3 w-3 mr-1"/>合作方: {p.partner_name}</p>
                    <div className="flex justify-between text-xs opacity-70 mt-1">
                      <span><Calendar className="inline h-3 w-3 mr-1"/>起始: {p.start_date}</span>
                      <span><Package className="inline h-3 w-3 mr-1"/>计划: {formatNumber(p.planned_total_tons, '吨')}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 项目进度卡片 */}
            <Card>
                <CardHeader><CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5"/>项目进度 ({selectedProject?.name})</CardTitle></CardHeader>
                <CardContent className="text-center space-y-3 pt-2">
                    <Progress value={progressPercentage} className="h-4" />
                    <div className="text-lg font-semibold text-muted-foreground">
                        {formatNumber(completedTons, '吨')} / <span className="text-foreground">{formatNumber(plannedTons, '吨')}</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{progressPercentage.toFixed(1)}%</p>
                </CardContent>
            </Card>
          </div>

          {/* 右侧区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 今日日报卡片 */}
            <Card>
             <CardHeader><CardTitle>今日日报 ({new Date().toLocaleDateString()})</CardTitle></CardHeader>
             <CardContent className="flex justify-around text-center">
                <div>
                    <p className="text-2xl font-bold">{formatNumber(dailyReport?.total_tonnage, '吨')}</p>
                    <p className="text-sm text-muted-foreground">当日运输吨数</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(dailyReport?.driver_receivable, '元')}</p>
                    <p className="text-sm text-muted-foreground">司机应收</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-red-600">{formatNumber(dailyReport?.partner_payable, '元')}</p>
                    <p className="text-sm text-muted-foreground">合作方应付</p>
                </div>
             </CardContent>
            </Card>
            {/* 项目总览数据卡片 */}
            <div className="grid grid-cols-3 gap-6">
                <Card><CardHeader><CardTitle className="text-sm font-medium">项目总车次</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.total_trips, '车')}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium">项目总成本</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.total_cost, '元')}</p></CardContent></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium">平均吨成本</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.avg_cost, '元')}</p></CardContent></Card>
            </div>
          </div>

          {/* 底部图表区域 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>项目近7日进度 ({selectedProject?.name})</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" label={{ value: '吨 / 车', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '元', angle: -90, position: 'insideRight' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === '总重量' ? '吨' : '元'}`, name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="trips" name="车次" stroke="#8884d8" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name="总重量" stroke="#82ca9d" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="receivable" name="应收总额" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
