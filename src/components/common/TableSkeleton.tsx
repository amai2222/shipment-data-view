// 通用表格骨架屏组件
// 用于防止页面加载时的布局抖动

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  /** 行数，默认10行 */
  rowCount?: number;
  /** 列数，默认8列 */
  colCount?: number;
  /** 是否显示选择框列，默认false */
  showCheckbox?: boolean;
}

export function TableSkeleton({ 
  rowCount = 10, 
  colCount = 8,
  showCheckbox = false 
}: TableSkeletonProps) {
  const totalCols = showCheckbox ? colCount + 1 : colCount;
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showCheckbox && (
            <TableHead className="w-12">
              <Skeleton className="h-4 w-4" />
            </TableHead>
          )}
          {Array.from({ length: colCount }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }).map((_, i) => (
          <TableRow key={i}>
            {showCheckbox && (
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
            )}
            {Array.from({ length: colCount }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

