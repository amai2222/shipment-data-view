// 统一分页控制组件
// 用于所有需要分页的页面

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PaginationControlProps {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function PaginationControl({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = ""
}: PaginationControlProps) {
  if (totalPages === 0) return null;

  return (
    <div className={`flex items-center justify-center gap-4 py-2 ${className}`}>
      {/* 每页显示 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">每页显示</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">条</span>
      </div>

      {/* 上一页 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="h-8 px-3"
      >
        上一页
      </Button>

      {/* 页码信息 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">第</span>
        <Input
          type="number"
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= totalPages) {
              onPageChange(page);
            }
          }}
          className="w-12 h-8 text-center"
          min={1}
          max={totalPages}
        />
        <span className="text-sm text-muted-foreground">
          页,共{totalPages}页
          {totalCount !== undefined && ` (共${totalCount}条)`}
        </span>
      </div>

      {/* 下一页 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="h-8 px-3"
      >
        下一页
      </Button>
    </div>
  );
}

