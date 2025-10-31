import { useNavigate } from 'react-router-dom';
import { Loader2 } from "lucide-react";
import { useProjectDashboardData } from "./Dashboard/hooks/useProjectDashboardData";
import { ProjectProgress } from "./Dashboard/components/ProjectProgress";
import { DailyReportCards } from "./Dashboard/components/DailyReportCards";
import { ProjectTrendChart } from "./Dashboard/components/ProjectTrendChart";
import { DriverReportTable } from "./Dashboard/components/DriverReportTable";

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const {
    projectId,
    dashboardData,
    loading,
    reportDate,
    setReportDate,
    visibleLines,
    handleLegendClick,
    allProjects,
    selectedProjectDetails,
    unitConfig,
    progressPercentage,
  } = useProjectDashboardData();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dashboardData || !selectedProjectDetails) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="text-center py-10 text-slate-500">
          项目数据不存在或加载失败。请检查项目ID是否正确。
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* 项目进度 */}
        <div className="lg:col-span-2">
          <ProjectProgress
            projectId={projectId}
            selectedProject={selectedProjectDetails}
            allProjects={allProjects}
            reportDate={reportDate}
            setReportDate={setReportDate}
            onProjectChange={(newId) => navigate(`/project/${newId}`)}
            unitConfig={unitConfig}
            progressPercentage={progressPercentage}
          />
        </div>
        
        {/* 日报与汇总 */}
        <div className="lg:col-span-3">
          <DailyReportCards
            dailyReport={dashboardData.daily_report}
            summaryStats={dashboardData.summary_stats}
            reportDate={reportDate}
            partnerName={selectedProjectDetails.partner_name}
            unit={unitConfig.unit}
          />
        </div>
        
        {/* 近7日进度 */}
        <div className="lg:col-span-5">
          <ProjectTrendChart
            data={dashboardData.seven_day_trend}
            projectName={selectedProjectDetails.name}
            unit={unitConfig.unit}
            visibleLines={visibleLines}
            onLegendClick={handleLegendClick}
          />
        </div>
        
        {/* 司机工作量报告 */}
        <div className="lg:col-span-5">
          <DriverReportTable
            data={dashboardData.driver_report_table}
            projectName={selectedProjectDetails.name}
            reportDate={reportDate}
            unit={unitConfig.unit}
            billingTypeId={unitConfig.billingTypeId}
          />
        </div>
      </div>
    </div>
  );
}
