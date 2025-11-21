// ✅ 真正的虚拟化表格组件（使用 react-window）
// 注意：此组件适用于大量数据（100+ 条），小数据集可使用普通表格
import { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VirtualizedTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    render: (item: T, index: number) => React.ReactNode;
    width?: string;
    className?: string;
  }[];
  rowKey: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
  // 虚拟化配置
  height?: number; // 容器高度（默认 400px）
  rowHeight?: number; // 每行高度（默认 50px）
  overscanCount?: number; // 预渲染行数（默认 5）
}

// 虚拟化行组件
function VirtualRow<T>({ 
  index, 
  style, 
  data 
}: ListChildComponentProps & { 
  data: { 
    items: T[]; 
    columns: any[];
    rowKey: (item: T) => string | number;
    onRowClick?: (item: T) => void;
  } 
}) {
  const { items, columns, rowKey, onRowClick } = data;
  const item = items[index];

  const handleClick = useCallback(() => {
    if (onRowClick && item) {
      onRowClick(item);
    }
  }, [onRowClick, item]);

  return (
    <div 
      style={style} 
      className={`flex items-center border-b ${onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={handleClick}
    >
      {columns.map((column, colIndex) => (
        <div 
          key={colIndex}
          className={`flex-shrink-0 px-4 py-2 text-sm ${column.className || ''}`}
          style={{ width: column.width || '150px' }}
        >
          {column.render(item, index)}
        </div>
      ))}
    </div>
  );
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  className,
  emptyMessage = "暂无数据",
  height = 400,
  rowHeight = 50,
  overscanCount = 5
}: VirtualizedTableProps<T>) {
  const listRef = useRef<List>(null);

  // 数据变化时滚动到顶部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [data.length]);

  const itemData = useMemo(() => ({
    items: data,
    columns,
    rowKey,
    onRowClick,
  }), [data, columns, rowKey, onRowClick]);

  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 表头（固定） */}
      <div className="border rounded-t-md overflow-hidden">
        <div className="flex items-center bg-muted/50 font-medium border-b">
          {columns.map((column, index) => (
            <div
              key={index}
              className={`flex-shrink-0 px-4 py-3 text-sm ${column.className || ''}`}
              style={{ width: column.width || '150px' }}
            >
              {column.header}
            </div>
          ))}
        </div>

        {/* ✅ 虚拟化内容区域（只渲染可见行）*/}
        <List
          ref={listRef}
          height={height}
          width="100%"
          itemCount={data.length}
          itemSize={rowHeight}
          itemData={itemData}
          overscanCount={overscanCount}
        >
          {VirtualRow}
        </List>
      </div>

      {/* 数据统计 */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
        共 {data.length} 条记录
      </div>
    </div>
  );
}