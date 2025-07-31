// --- 文件: src/components/columns.tsx ---

"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogisticsRecord } from "@/types";

type GetColumnsOptions = {
    onViewDetails: (shipment: LogisticsRecord) => void;
    onEdit: (shipment: LogisticsRecord) => void;
    onDelete: (shipmentId: string) => void;
}

export const getColumns = ({ onViewDetails, onEdit, onDelete }: GetColumnsOptions): ColumnDef<LogisticsRecord>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "project_name",
    header: "项目名称",
  },
  {
    accessorKey: "license_plate",
    header: "车牌号",
  },
  {
    accessorKey: "driver_name",
    header: "司机姓名",
  },
  {
    accessorKey: "payable_cost",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        应付成本<ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("payable_cost"));
      const formatted = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(amount);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "created_at",
    header: "创建时间",
    cell: ({ row }) => new Date(row.getValue("created_at")).toLocaleDateString(),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const record = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">打开菜单</span><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewDetails(record)}>查看详情</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(record)}>编辑运单</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onDelete(record.id)}>删除运单</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
