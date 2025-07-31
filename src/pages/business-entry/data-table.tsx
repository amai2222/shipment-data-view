// FILE: /src/pages/business-entry/data-table.tsx

"use client"

import {
  ColumnDef,
  flexRender,
  Table as TableType,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  table: TableType<TData>;
  loading: boolean; // 新增 loading 属性
}

export function DataTable<TData, TValue>({
  columns,
  table,
  loading, // 接收 loading 属性
}: DataTableProps<TData, TValue>) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : loading ? ( // 如果正在加载
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  正在加载数据...
                </TableCell>
              </TableRow>
            ) : ( // 如果加载完成但没有数据
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  无结果。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// 附加子组件，方便导出
DataTable.Toolbar = DataTableToolbar;
DataTable.Pagination = DataTablePagination;
