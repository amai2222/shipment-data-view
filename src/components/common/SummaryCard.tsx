// 合计卡片组件
// 用于显示筛选条件下的合计信息

import { useMemo, ReactNode } from "react";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

export interface SummaryItem {
  label: string;
  value: string | number;
  className?: string;
  formatter?: (value: string | number) => ReactNode;
}

interface SummaryCardProps {
  /** 标题（根据筛选条件生成） */
  title: string;
  /** 合计项列表 */
  items: SummaryItem[];
  /** 自定义样式类名 */
  className?: string;
}

export function SummaryCard({
  title,
  items,
  className = ""
}: SummaryCardProps) {
  return (
    <div className={`flex items-center justify-start gap-x-6 rounded-lg border p-4 text-sm font-medium flex-nowrap overflow-x-auto scrollbar-thin ${className}`}>
      <span className="font-bold whitespace-nowrap">{title}:</span>
      {items.map((item, index) => (
        <span key={index} className={`whitespace-nowrap ${item.className || ''}`}>
          {item.label}: {item.formatter ? item.formatter(item.value) : (
            typeof item.value === 'number' ? (
              <CurrencyDisplay value={item.value} className={item.className} />
            ) : (
              <span className={item.className}>{item.value}</span>
            )
          )}
        </span>
      ))}
    </div>
  );
}

// 辅助函数：生成合计卡片标题
export function generateSummaryTitle(
  filters: {
    projectName?: string;
    projectId?: string;
    driverName?: string;
    licensePlate?: string;
    driverPhone?: string;
    startDate?: string;
    endDate?: string;
    [key: string]: unknown;
  } | Record<string, unknown>,
  projects?: { id: string; name: string }[]
): string {
  const parts: string[] = [];
  
  // 处理项目名称
  if (filters.projectName) {
    parts.push(`项目: ${filters.projectName}`);
  } else if (filters.projectId && filters.projectId !== 'all' && projects) {
    const project = projects.find(p => p.id === filters.projectId);
    if (project) {
      parts.push(`项目: ${project.name}`);
    }
  }
  
  // 处理其他筛选条件
  if (filters.driverName) { 
    parts.push(`司机: ${filters.driverName}`); 
  }
  if (filters.licensePlate) { 
    parts.push(`车牌: ${filters.licensePlate}`); 
  }
  if (filters.driverPhone) { 
    parts.push(`电话: ${filters.driverPhone}`); 
  }
  if (filters.startDate && filters.endDate) { 
    parts.push(`日期: ${filters.startDate} 至 ${filters.endDate}`); 
  } else if (filters.startDate) { 
    parts.push(`日期: 从 ${filters.startDate}`); 
  } else if (filters.endDate) { 
    parts.push(`日期: 截至 ${filters.endDate}`); 
  }
  
  if (parts.length === 0) { 
    return "全部记录合计"; 
  }
  return `${parts.join(' | ')} 合计`;
}

