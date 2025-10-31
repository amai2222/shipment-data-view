import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useDashboardData } from "./Dashboard/hooks/useDashboardData";
import { useDashboardStats } from "./Dashboard/hooks/useDashboardStats";
import { FilterSection } from "./Dashboard/components/FilterSection";
import { OverviewStats } from "./Dashboard/components/OverviewStats";
import { ProjectHeader } from "./Dashboard/components/ProjectHeader";
import { TransportChart } from "./Dashboard/components/TransportChart";
import { TripChart } from "./Dashboard/components/TripChart";
import { CostChart } from "./Dashboard/components/CostChart";

export default function Dashboard() {
  const {
    projects,
    dateRange,
    setDateRange,
    selectedProjectId,
    setSelectedProjectId,
    isLoading,
    filteredRecords,
    getValidDateString,
  } = useDashboardData();

  const { projectStats, overviewStats } = useDashboardStats(
    filteredRecords,
    projects,
    selectedProjectId,
    getValidDateString
  );

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="数据看板" 
        description="运输数据统计分析与可视化"
        icon={BarChart3}
        iconColor="text-blue-600"
      />

      {/* 筛选器 */}
      <FilterSection
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        projects={projects}
      />

      {/* 统计概览 */}
      <OverviewStats
        totalRecords={overviewStats.totalRecords}
        totalWeight={overviewStats.totalWeight}
        totalCost={overviewStats.totalCost}
        actualTransportCount={overviewStats.actualTransportCount}
        returnCount={overviewStats.returnCount}
      />

      {/* 按项目分类显示图表 */}
      {projectStats.map((projectData) => (
        <div key={projectData.projectId} className="space-y-6">
          {/* 项目分隔标题 */}
          <ProjectHeader project={projectData.project} />

          {/* 每日运输量统计图表 */}
          <TransportChart
            data={projectData.dailyTransportStats}
            project={projectData.project}
            actualTransportTotal={projectData.legendTotals.actualTransportTotal}
            returnsTotal={projectData.legendTotals.returnsTotal}
          />

          {/* 运输日报 - 折线图 */}
          <TripChart
            data={projectData.dailyCountStats}
            project={projectData.project}
            totalTrips={projectData.legendTotals.totalTrips}
          />

          {/* 每日运输费用分析图表 */}
          <CostChart
            data={projectData.dailyCostStats}
            project={projectData.project}
            totalCostSum={projectData.legendTotals.totalCostSum}
          />
        </div>
      ))}
    </div>
  );
}
