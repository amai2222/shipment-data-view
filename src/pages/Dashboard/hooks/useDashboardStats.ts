import { useMemo } from "react";
import { LogisticsRecord, DailyTransportStats, DailyCostStats, Project } from "@/types";

// 每日运输次数统计
interface DailyCountStats {
  date: string;
  count: number;
}

interface ProjectStats {
  projectId: string;
  project: Project | undefined;
  projectRecords: LogisticsRecord[];
  dailyTransportStats: DailyTransportStats[];
  dailyCostStats: DailyCostStats[];
  dailyCountStats: DailyCountStats[];
  legendTotals: {
    actualTransportTotal: number;
    returnsTotal: number;
    totalCostSum: number;
    totalTrips: number;
  };
}

export function useDashboardStats(
  filteredRecords: LogisticsRecord[],
  projects: Project[],
  selectedProjectId: string,
  getValidDateString: (dateValue: string | Date) => string | null
) {
  // 按项目分组的记录
  const recordsByProject = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, record) => {
      if (!acc[record.projectId]) {
        acc[record.projectId] = [];
      }
      acc[record.projectId].push(record);
      return acc;
    }, {} as Record<string, LogisticsRecord[]>);
    return grouped;
  }, [filteredRecords]);

  const projectStats = useMemo(() => {
    const projectIds = selectedProjectId === "all" 
      ? Object.keys(recordsByProject)
      : [selectedProjectId];
    
    return projectIds.map(projectId => {
      const projectRecords = recordsByProject[projectId] || [];
      const project = projects.find(p => p.id === projectId);
      
      // 每日运输量统计
      const dailyTransportStats: DailyTransportStats[] = (() => {
        const statsMap = new Map<string, { actualTransport: number; returns: number }>();
        
        projectRecords.forEach(record => {
          const date = getValidDateString(record.loadingDate);
          if (!date) return;
          const current = statsMap.get(date) || { actualTransport: 0, returns: 0 };
          
          if (record.transportType === "实际运输") {
            current.actualTransport += record.loadingWeight;
          } else {
            current.returns += record.loadingWeight;
          }
          
          statsMap.set(date, current);
        });
        
        return Array.from(statsMap.entries()).map(([date, stats]) => ({
          date,
          ...stats,
        })).sort((a, b) => a.date.localeCompare(b.date));
      })();

      // 每日费用统计
      const dailyCostStats: DailyCostStats[] = (() => {
        const statsMap = new Map<string, number>();
        
        projectRecords.forEach(record => {
          const date = getValidDateString(record.loadingDate);
          if (!date) return;
          const current = statsMap.get(date) || 0;
          const cost = (record.currentFee || 0) + (record.extraFee || 0);
          statsMap.set(date, current + cost);
        });
        
        return Array.from(statsMap.entries()).map(([date, totalCost]) => ({
          date,
          totalCost,
        })).sort((a, b) => a.date.localeCompare(b.date));
      })();

      // 每日运输次数统计
      const dailyCountStats: DailyCountStats[] = (() => {
        const statsMap = new Map<string, number>();
        
        projectRecords.forEach(record => {
          const date = getValidDateString(record.loadingDate);
          if (!date) return;
          const current = statsMap.get(date) || 0;
          statsMap.set(date, current + 1);
        });
        
        return Array.from(statsMap.entries()).map(([date, count]) => ({
          date,
          count,
        })).sort((a, b) => a.date.localeCompare(b.date));
      })();

      // 图例汇总数据
      const legendTotals = {
        actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + day.actualTransport, 0),
        returnsTotal: dailyTransportStats.reduce((sum, day) => sum + day.returns, 0),
        totalCostSum: dailyCostStats.reduce((sum, day) => sum + day.totalCost, 0),
        totalTrips: dailyCountStats.reduce((sum, day) => sum + day.count, 0),
      };

      return {
        projectId,
        project,
        projectRecords,
        dailyTransportStats,
        dailyCostStats,
        dailyCountStats,
        legendTotals,
      };
    });
  }, [recordsByProject, projects, selectedProjectId, getValidDateString]);

  // 统计概览
  const overviewStats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalWeight = filteredRecords.reduce((sum, record) => sum + record.loadingWeight, 0);
    const totalCost = filteredRecords.reduce((sum, record) => 
      sum + (record.currentFee || 0) + (record.extraFee || 0), 0);
    const actualTransportCount = filteredRecords.filter(r => r.transportType === "实际运输").length;
    
    return {
      totalRecords,
      totalWeight,
      totalCost,
      actualTransportCount,
      returnCount: totalRecords - actualTransportCount,
    };
  }, [filteredRecords]);

  return {
    projectStats,
    overviewStats,
  };
}

