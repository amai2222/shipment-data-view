import { useState, useEffect, useMemo } from "react";
import { SupabaseStorage } from "@/utils/supabase";
import { LogisticsRecord, Project } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { subDays } from "date-fns";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function useDashboardData() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 45),
    to: new Date(),
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allRecords, allProjects] = await Promise.all([
        SupabaseStorage.getLogisticsRecords(),
        SupabaseStorage.getProjects()
      ]);
      
      setRecords(allRecords);
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "数据加载失败",
        description: "无法加载数据，请检查连接。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 安全的日期转换函数
  const getValidDateString = (dateValue: string | Date): string | null => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  // 根据日期范围和项目过滤记录
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // 按日期范围过滤
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter(record => {
        const dateStr = getValidDateString(record.loadingDate);
        if (!dateStr) return false;
        const recordDate = new Date(dateStr);
        return recordDate >= dateRange.from! && recordDate <= dateRange.to!;
      });
    }
    
    // 按项目过滤
    if (selectedProjectId !== "all") {
      filtered = filtered.filter(record => record.projectId === selectedProjectId);
    }
    
    return filtered;
  }, [records, dateRange, selectedProjectId]);

  return {
    records,
    projects,
    dateRange,
    setDateRange,
    selectedProjectId,
    setSelectedProjectId,
    isLoading,
    filteredRecords,
    getValidDateString,
  };
}

