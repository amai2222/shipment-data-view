// 申请单表格头部组件
// 带选择框的统一表格头部

import { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TableColumn {
  key: string;
  label: string;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

interface RequestTableHeaderProps {
  columns: TableColumn[];
  showCheckbox?: boolean;
  allSelected?: boolean;
  onSelectAll?: (checked: boolean) => void;
}

export function RequestTableHeader({
  columns,
  showCheckbox = true,
  allSelected = false,
  onSelectAll
}: RequestTableHeaderProps) {
  const getAlignClass = (align?: string) => {
    switch (align) {
      case 'right': return 'text-right';
      case 'center': return 'text-center';
      default: return '';
    }
  };

  return (
    <TableHeader>
      <TableRow>
        {showCheckbox && (
          <TableHead className="w-12">
            {onSelectAll && (
              <Checkbox 
                checked={allSelected} 
                onCheckedChange={onSelectAll} 
              />
            )}
          </TableHead>
        )}
        {columns.map(column => (
          <TableHead 
            key={column.key}
            className={`${column.className || ''} ${getAlignClass(column.align)}`}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

