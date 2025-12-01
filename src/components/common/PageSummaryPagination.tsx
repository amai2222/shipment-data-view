// 带本页合计信息的分页组件
// 用于运单管理、开票申请管理等页面

import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

export interface PageSummaryItem {
  label: string;
  value: number;
  className?: string;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

interface PageSummaryPaginationProps {
  /** 分页状态 */
  pagination: PaginationState;
  /** 分页状态更新函数 */
  onPaginationChange: (pagination: PaginationState) => void;
  /** 本页合计信息列表 */
  pageSummaryItems?: PageSummaryItem[];
  /** 每页显示条数选项 */
  pageSizeOptions?: number[];
  /** 自定义样式类名 */
  className?: string;
}

export function PageSummaryPagination({
  pagination,
  onPaginationChange,
  pageSummaryItems = [],
  pageSizeOptions = [10, 20, 50, 100],
  className = ""
}: PageSummaryPaginationProps) {
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      onPaginationChange({
        ...pagination,
        currentPage: newPage
      });
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    onPaginationChange({
      ...pagination,
      pageSize: newPageSize,
      currentPage: 1,
      totalPages: Math.ceil(pagination.totalCount / newPageSize) || 1
    });
  };

  return (
    <div className={`flex items-center justify-between py-4 px-6 border-t border-gray-200 bg-white ${className}`}>
      {/* 左侧：本页合计信息 */}
      <div className="flex-1 text-sm text-slate-600">
        <span className="text-slate-600">本页合计:</span>
        {pageSummaryItems.map((item, index) => (
          <span key={index} className={`ml-3 text-slate-700 ${item.className || ''}`}>
            {item.label} <CurrencyDisplay value={item.value} />
          </span>
        ))}
        <span className="ml-3 text-slate-600">共{pagination.totalCount} 条记录</span>
      </div>
      
      {/* 右侧：分页控制 */}
      <div className="flex items-center space-x-4">
        {/* 每页显示条数选择 */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600">每页显示</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-sm text-slate-600">条</span>
        </div>
        
        {/* 分页按钮 */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(pagination.currentPage - 1)} 
            disabled={pagination.currentPage <= 1}
            className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
          >
            上一页
          </Button>
          
          {/* 页码输入 */}
          <div className="flex items-center space-x-1">
            <span className="text-sm text-slate-600">第</span>
            <input
              type="number"
              value={pagination.currentPage}
              onChange={(e) => {
                const page = Number(e.target.value);
                handlePageChange(page);
              }}
              className="w-10 px-1 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              min="1"
              max={pagination.totalPages}
            />
            <span className="text-sm text-slate-600">页,共{pagination.totalPages}页</span>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePageChange(pagination.currentPage + 1)} 
            disabled={pagination.currentPage >= pagination.totalPages}
            className="px-3 py-1 text-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150"
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}

