import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ReusablePaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showPageInput?: boolean;
  showTotalInfo?: boolean;
  className?: string;
}

export const ReusablePagination: React.FC<ReusablePaginationProps> = ({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showPageInput = true,
  showTotalInfo = true,
  className = ''
}) => {
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      onPageChange(newPage);
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= pagination.totalPages) {
      handlePageChange(page);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newPageSize = parseInt(value);
    onPageSizeChange(newPageSize);
  };

  return (
    <div className={`flex items-center justify-between space-x-4 py-4 ${className}`}>
      {/* 左侧：每页显示数量选择器 */}
      {showPageSizeSelector && (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">每页显示</span>
          <Select value={pagination.pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">条</span>
        </div>
      )}

      {/* 中间：总数信息 */}
      {showTotalInfo && (
        <div className="flex-1 text-sm text-muted-foreground text-center">
          第 {pagination.currentPage} 页 / 共 {pagination.totalPages} 页 (总计 {pagination.totalCount} 条记录)
        </div>
      )}

      {/* 右侧：分页导航 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1}
        >
          上一页
        </Button>
        
        {showPageInput && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">第</span>
            <Input
              type="number"
              min="1"
              max={pagination.totalPages}
              value={pagination.currentPage}
              onChange={handlePageInputChange}
              className="w-12 h-8 text-center"
            />
            <span className="text-sm text-muted-foreground">页，共 {pagination.totalPages} 页</span>
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages}
        >
          下一页
        </Button>
      </div>
    </div>
  );
};

// 简化版本：只显示分页导航
export const SimplePagination: React.FC<{
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  className?: string;
}> = ({ pagination, onPageChange, className = '' }) => {
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      onPageChange(newPage);
    }
  };

  return (
    <div className={`flex items-center justify-center gap-2 py-4 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(pagination.currentPage - 1)}
        disabled={pagination.currentPage <= 1}
      >
        上一页
      </Button>
      
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">第</span>
        <Input
          type="number"
          min="1"
          max={pagination.totalPages}
          value={pagination.currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= pagination.totalPages) {
              handlePageChange(page);
            }
          }}
          className="w-12 h-8 text-center"
        />
        <span className="text-sm text-muted-foreground">页，共 {pagination.totalPages} 页</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(pagination.currentPage + 1)}
        disabled={pagination.currentPage >= pagination.totalPages}
      >
        下一页
      </Button>
    </div>
  );
};

// 紧凑版本：只显示基本信息
export const CompactPagination: React.FC<{
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  className?: string;
}> = ({ pagination, onPageChange, className = '' }) => {
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      onPageChange(newPage);
    }
  };

  return (
    <div className={`flex items-center justify-between py-2 ${className}`}>
      <div className="text-sm text-muted-foreground">
        第 {pagination.currentPage} 页 / 共 {pagination.totalPages} 页 (总计 {pagination.totalCount} 条记录)
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages}
        >
          下一页
        </Button>
      </div>
    </div>
  );
};

export default ReusablePagination;
