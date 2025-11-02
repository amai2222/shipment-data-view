import { useMemo } from 'react';
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
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowKey,
  onRowClick,
  className,
  emptyMessage = "暂无数据"
}: VirtualizedTableProps<T>) {
  const memoizedRows = useMemo(() => {
    return data.map((item, index) => (
      <TableRow 
        key={rowKey(item)}
        className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => onRowClick?.(item)}
      >
        {columns.map((column) => (
          <TableCell 
            key={column.key}
            className={column.className}
            style={column.width ? { width: column.width } : undefined}
          >
            {column.render(item, index)}
          </TableCell>
        ))}
      </TableRow>
    ));
  }, [data, columns, rowKey, onRowClick]);

  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead 
                key={column.key}
                className={column.className}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memoizedRows}
        </TableBody>
      </Table>
    </div>
  );
}