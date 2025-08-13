// 优化的虚拟化表格组件
// 用于处理大量数据的高性能表格

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
// import { useVirtualScrolling } from '@/hooks/usePerformanceOptimization';

interface Column<T> {
  key: keyof T;
  header: string;
  width?: number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface OptimizedVirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  height?: number;
  itemSize?: number;
  loading?: boolean;
  onRowClick?: (row: T, index: number) => void;
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: keyof T) => void;
  overscanCount?: number;
}

function VirtualizedRow<T>({ 
  index, 
  style, 
  data 
}: ListChildComponentProps & { 
  data: { 
    items: T[]; 
    columns: Column<T>[];
    onRowClick?: (row: T, index: number) => void;
  } 
}) {
  const { items, columns, onRowClick } = data;
  const row = items[index];

  const handleClick = useCallback(() => {
    if (onRowClick && row) {
      onRowClick(row, index);
    }
  }, [onRowClick, row, index]);

  if (!row) {
    return (
      <div style={style} className="flex items-center space-x-4 p-4 border-b">
        {columns.map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-4 flex-1" />
        ))}
      </div>
    );
  }

  return (
    <div 
      style={style} 
      className="flex items-center border-b hover:bg-muted/50 cursor-pointer"
      onClick={handleClick}
    >
      {columns.map((column, colIndex) => {
        const value = row[column.key];
        const content = column.render ? column.render(value, row, index) : String(value || '');
        
        return (
          <div 
            key={colIndex}
            className="flex-shrink-0 px-4 py-2 text-sm"
            style={{ width: column.width || 150 }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function OptimizedVirtualTable<T>({
  data,
  columns,
  height = 400,
  itemSize = 50,
  loading = false,
  onRowClick,
  sortField,
  sortDirection,
  onSort,
  overscanCount = 5,
}: OptimizedVirtualTableProps<T>) {
  const listRef = useRef<List>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // 排序数据
  const sortedData = useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [data, sortField, sortDirection]);

  // 处理排序
  const handleSort = useCallback((field: keyof T) => {
    if (onSort) {
      onSort(field);
    }
  }, [onSort]);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, []);

  // 重置滚动位置当数据变化时
  useEffect(() => {
    scrollToTop();
  }, [data.length, scrollToTop]);

  const itemData = useMemo(() => ({
    items: sortedData,
    columns,
    onRowClick,
  }), [sortedData, columns, onRowClick]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex space-x-4 p-4 border-b font-medium">
          {columns.map((column, index) => (
            <Skeleton key={index} className="h-4" style={{ width: column.width || 150 }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex space-x-4 p-4 border-b">
            {columns.map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4" style={{ width: columns[colIndex].width || 150 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      {/* 表头 */}
      <div className="flex items-center border-b bg-muted/50 font-medium">
        {columns.map((column, index) => (
          <div
            key={index}
            className={`flex-shrink-0 px-4 py-3 text-sm ${
              column.sortable ? 'cursor-pointer hover:bg-muted' : ''
            }`}
            style={{ width: column.width || 150 }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            <div className="flex items-center justify-between">
              {column.header}
              {column.sortable && sortField === column.key && (
                <span className="ml-2">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 虚拟化内容 */}
      {sortedData.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          暂无数据
        </div>
      ) : (
        <List
          ref={listRef}
          height={height}
          width="100%"
          itemCount={sortedData.length}
          itemSize={itemSize}
          itemData={itemData}
          overscanCount={overscanCount}
          onScroll={({ scrollOffset }) => setScrollOffset(scrollOffset)}
        >
          {VirtualizedRow}
        </List>
      )}

      {/* 滚动信息 */}
      {sortedData.length > 0 && (
        <div className="flex items-center justify-between p-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>共 {sortedData.length} 条记录</span>
          {scrollOffset > 0 && (
            <Button size="sm" variant="ghost" onClick={scrollToTop}>
              回到顶部
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default OptimizedVirtualTable;